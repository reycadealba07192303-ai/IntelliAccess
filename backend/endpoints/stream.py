from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import threading
import time
import os
from datetime import datetime

# Optional imports for AI and Camera
try:
    import numpy as np
    import cv2
    OPENCV_AVAILABLE = True
except Exception as e:
    print(f"Warning: 'cv2' or 'numpy' failed to load: {e}. Camera stream disabled.")
    OPENCV_AVAILABLE = False

try:
    from ultralytics import YOLO
    AI_AVAILABLE = True
except Exception as e:
    print(f"Warning: 'ultralytics' failed to load: {e}. Vehicle detection disabled.")
    AI_AVAILABLE = False

# Force-disable YOLO on Raspberry Pi ARM (PyTorch uses AVX2 which crashes on ARM)
import platform
_is_arm = platform.machine().startswith('arm') or platform.machine().startswith('aarch')
if _is_arm:
    print("[CAMERA] ARM CPU detected. Disabling YOLO (PyTorch not ARM-compatible).")
    AI_AVAILABLE = False

try:
    import pytesseract
    import re as _re
    OCR_AVAILABLE = True
    print("[CAMERA] Tesseract OCR available (ARM-compatible plate reading active).")
except Exception as e:
    print(f"Warning: 'pytesseract' not installed: {e}. Install with: pip install pytesseract && sudo apt install tesseract-ocr")
    OCR_AVAILABLE = False

try:
    from picamera import PiCamera
    PICAMERA_AVAILABLE = True
except Exception as e:
    print(f"Warning: 'picamera' failed to load: {e}. Raspberry Pi camera disabled.")
    PICAMERA_AVAILABLE = False

try:
    from mongo_client import vehicles_collection, access_logs_collection, denied_logs_collection, users_collection, log_notification
    DB_AVAILABLE = True
except ImportError:
    print("Warning: Database connection to MongoDB not found. Logs will not be saved.")
    DB_AVAILABLE = False

router = APIRouter()

# Global variables for models and camera
camera = None
model = None
reader = None

# Detection settings
DETECTION_INTERVAL = 5  # Run detection every 5 frames (approx 0.3s)
frame_counter = 0
last_detections = []  # Store last detections to draw between intervals

import queue
ocr_queue = queue.Queue(maxsize=1) # Only store latest frame for OCR to avoid backlog
ocr_worker_active = False

# Cooldown tracking (Per-plate dictionary)
# Format: { "ABC-123": timestamp }
plate_cooldowns = {}
LOG_COOLDOWN_SECONDS = 60 

# Latest Scan Result for frontend polling
latest_scan_result = None
latest_frame_bytes = None  # Global buffer for the latest JPEG frame
latest_frame_raw = None    # Global buffer for the latest raw CV2 frame

# Ensure captures directory exists (Absolute Path)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAPTURES_DIR = os.path.join(BASE_DIR, "static", "captures")
os.makedirs(CAPTURES_DIR, exist_ok=True)

from utils.sms import send_access_sms
try:
    from utils.buzzer import buzz_granted, buzz_denied
    BUZZER_AVAILABLE = True
except Exception:
    BUZZER_AVAILABLE = False
    def buzz_granted(): pass
    def buzz_denied(): pass
def log_plate_detection(plate_text: str, frame=None):
    global latest_scan_result, plate_cooldowns, CAPTURES_DIR
    
    # Clean up the text: remove non-alphanumeric (keep hyphens and spaces)
    import re
    if plate_text:
        plate_text = re.sub(r'[^A-Za-z0-9\-]', '', plate_text).upper()
    
    # Don't log if there is no text or no database available
    if not plate_text or not plate_text.strip() or not DB_AVAILABLE:
        return
        
    # Allow partial plates, just ensure it has at least 2 characters (e.g. letters only)
    if len(plate_text.replace(" ", "")) < 2:
        return
        
    current_time = time.time()
    
    # Cooldown logic (PER PLATE)
    # If THIS specific plate was logged less than 60s ago, ignore it.
    if plate_text in plate_cooldowns:
        last_time = plate_cooldowns[plate_text]
        if (current_time - last_time) < LOG_COOLDOWN_SECONDS:
            return
            
    # Update frontend polling object REGARDLESS of cooldown
    # (So the user still sees the green box on screen)
        
    try:
        # Check if authorized
        status = "Denied"
        vehicle_info = None
        
        # 1. Query the vehicles collection using regex for partial matching
        # Users often enter plates like "ABC 123" or "ABC-123" or "ABC123". 
        # The AI reads "ABC123". To match it against "ABC 123" in the database,
        # we construct a regex pattern that allows optional spaces or hyphens between every character.
        search_plate = plate_text.replace(" ", "").replace("-", "")
        
        # Build wildcard pattern like ^C[\s\-]*A[\s\-]*X[\s\-]*3[\s\-]*2[\s\-]*0[\s\-]*0$
        regex_pattern = "^" + "[\\s\\-]*".join(list(search_plate)) + "$"
        
        vehicle = vehicles_collection.find_one({"plate_number": {"$regex": regex_pattern, "$options": "i"}})
        
        # If not found, try a looser search just in case
        if not vehicle:
             loose_regex = "[\\s\\-]*".join(list(search_plate))
             vehicle = vehicles_collection.find_one({"plate_number": {"$regex": loose_regex, "$options": "i"}})
             
        # Fuzzy Match Fallback for common AI OCR errors 
        # (e.g. reading 1123VBC instead of 123VBC due to background noise)
        if not vehicle:
            import difflib
            all_vehicles = list(vehicles_collection.find({}))
            best_match = None
            highest_ratio = 0.0
            
            for v in all_vehicles:
                db_plate = v.get("plate_number", "").replace(" ", "").replace("-", "").upper()
                if not db_plate:
                    continue
                
                # SequenceMatcher returns a ratio from 0.0 (no match) to 1.0 (exact match)
                ratio = difflib.SequenceMatcher(None, search_plate, db_plate).ratio()
                
                if ratio > highest_ratio:
                    highest_ratio = ratio
                    best_match = v
                    
            # A ratio of >= 0.70 allows for 1-2 character errors/noise on a typical 6-7 char plate
            if highest_ratio >= 0.70 and best_match:
                vehicle = best_match
                print(f"[STREAM DETECT] AI OCR '{search_plate}' fuzzy matched to DB '{best_match.get('plate_number')}' (ratio {highest_ratio:.2f})")
        
        if vehicle:
            vehicle["id"] = str(vehicle["_id"])
            del vehicle["_id"]
            vehicle_info = vehicle
            
            # Additional layer to guarantee we grab the right owner details
            if "owner_name" not in vehicle_info or vehicle_info["owner_name"] == "Unknown":
                from bson import ObjectId
                if vehicle.get("owner_id"):
                    try:
                        owner_record = users_collection.find_one({"_id": ObjectId(vehicle["owner_id"])})
                        if owner_record:
                            vehicle_info["owner_name"] = owner_record.get("name", "Unknown")
                            vehicle_info["owner_role"] = owner_record.get("role", "GUEST")
                    except Exception as ex:
                        print(f"Failed to lookup owner in log_plate_detection: {ex}")
            
            # Check rigorous status, making it case-insensitive and stripping whitespace
            v_status = vehicle.get("status", "").strip().upper()
            if v_status == "ACTIVE":
                status = "Authorized"
            elif v_status == "PENDING":
                 status = "Denied (Pending)"
            elif v_status == "BLACKLISTED":
                 status = "Denied (Blacklisted)"
        else:
             status = "Denied (Unregistered)"
             
        # Save frame capture
        image_url = None
        # NumPy array check: if frame is not None is ambiguous for multi-element arrays
        has_frame = frame is not None and hasattr(frame, 'shape')
        
        if has_frame:
             try:
                 filename = f"capture_{int(current_time)}.jpg"
                 filepath = os.path.join(CAPTURES_DIR, filename)
                 
                 # Ensure directory exists one more time just in case of disk issues
                 if not os.path.exists(CAPTURES_DIR):
                     os.makedirs(CAPTURES_DIR, exist_ok=True)
                     
                 success = cv2.imwrite(filepath, frame)
                 if success:
                     image_url = f"/static/captures/{filename}"
                     print(f"[STREAM DETECT] Image saved successfully: {filepath}")
                 else:
                     # Check if we have write permissions
                     if not os.access(os.path.dirname(filepath), os.W_OK):
                        print(f"[STREAM DETECT] CRITICAL: No write permission for {CAPTURES_DIR}")
                     else:
                        print(f"[STREAM DETECT] Failed to save image to: {filepath} (Reason unknown)")
             except Exception as write_err:
                 print(f"[STREAM DETECT] Error during image write: {write_err}")
             
        # Check last action for this vehicle to determine Entry vs Exit
        action = "Entry"
        owner_phone = None
        if vehicle_info:
            
            # Fetch the actual user document to get the phone number
            if vehicle_info.get("owner_id"):
                from bson import ObjectId
                owner_doc = users_collection.find_one({"_id": ObjectId(vehicle_info["owner_id"])})
                if owner_doc:
                    owner_phone = owner_doc.get("phone")
            
            last_log = access_logs_collection.find_one(
                {"vehicle_id": vehicle_info.get("id")},
                sort=[("timestamp", -1)]
            )
            
            if last_log:
                last_log_action = last_log.get("action")
                last_log_time_str = last_log.get("timestamp")
                
                if last_log_time_str:
                    try:
                        last_time_obj = datetime.fromisoformat(last_log_time_str.replace("Z", "+00:00"))
                        time_diff = (datetime.now(last_time_obj.tzinfo) - last_time_obj).total_seconds()
                        
                        # MANDATORY 1-MINUTE COOLDOWN BETWEEN ANY STATE CHANGE
                        if time_diff < 60:
                            print(f"[STREAM DETECT] Ignored. Vehicle {plate_text} recently {last_log_action.lower()}ed ({time_diff:.1f}s ago).")
                            action = "Ignored"
                        else:
                            # TICKET TOGGLE: Entry -> Exit, Exit -> Entry
                            action = "Exit" if last_log_action == "Entry" else "Entry"
                            
                    except Exception as e:
                        print(f"Time parsing error: {e}")
                        action = "Entry"
                else:
                    action = "Entry"
            else:
                # No history? Start with Entry.
                action = "Entry"
        # Insert access log
        log_entry_id = f"ignored_{int(current_time)}"
        try:
            if action != "Ignored":
                log_data = {
                    "plate_detected": plate_text,
                    "action": action, 
                    "status": "GRANTED" if status == "Authorized" else "DENIED",
                    "gate": "Main Gate Entry",
                    "timestamp": datetime.now().isoformat(),
                    "image_url": image_url
                }
                
                # Determine vehicle ID if authorized
                if vehicle_info:
                    log_data["vehicle_id"] = vehicle_info.get("id")
                    
                if status == "Authorized":
                    result = access_logs_collection.insert_one(log_data)
                else:
                    result = denied_logs_collection.insert_one(log_data)
                    
                log_entry_id = str(result.inserted_id)
                
                # --- START SMS INTEGRATION ---
                # If the entry was granted and we found a phone number, send the SMS
                if status == "Authorized" and owner_phone and vehicle_info:
                    owner_name = vehicle_info.get("owner_name", "Unknown")
                    
                    # Format time nicely for the SMS (e.g. 08:05 PM)
                    current_time_str = datetime.now().strftime("%I:%M %p")
                    
                    # Added notification for the dashboard
                    log_notification(
                        title=f"Vehicle {action}",
                        message=f"Your vehicle {plate_text} {action.lower()}ed the university at {current_time_str}.",
                        user_id=vehicle_info.get("owner_id"),
                        type="alert"
                    )
                    
                    # Send SMS for both Entry and Exit
                    print(f"[STREAM DETECT] Triggering {action} SMS to {owner_name} ({owner_phone})")
                    send_access_sms(
                        phone_number=owner_phone,
                        owner_name=owner_name,
                        plate_number=plate_text,
                        time_str=current_time_str,
                        action=action
                    )
                # --- END SMS INTEGRATION ---
            else:
                status = "Cooldown Active"

            
        except Exception as e:
            print(f"Error saving log: {e}")
        
        # Fire buzzer based on access result
        if BUZZER_AVAILABLE:
            if status == "Authorized":
                buzz_granted()
            else:
                buzz_denied()
        
        print(f"\n[STREAM DETECT] Logged Plate: {plate_text} | Status: {status}")
        
        # Update frontend polling object
        latest_scan_result = {
            "id": log_entry_id, # Add unique ID so frontend knows it's a new event
            "timestamp": current_time,
            "plate_number": plate_text,
            "access_granted": status == "Authorized",
            "access_status": "GRANTED" if status == "Authorized" else status.upper(),
            "vehicle_info": vehicle_info,
            "image_url": image_url
        }
        
        # Update per-plate cooldown
        plate_cooldowns[plate_text] = current_time
        
        # Cleanup old cooldowns to save memory (older than 10 mins)
        if len(plate_cooldowns) > 100:
            plate_cooldowns = {p: t for p, t in plate_cooldowns.items() if (current_time - t) < 600}
        
    except Exception as e:
         print(f"Error logging plate detection: {e}")

from pydantic import BaseModel
from typing import Optional
class RemoteResultRequest(BaseModel):
    plate_number: str
    image_base64: Optional[str] = None

@router.post("/remote-process")
async def remote_process_plate(req: RemoteResultRequest):
    """Bridge for PC Brain to trigger Pi Hardware (Steps 7-10)."""
    print(f"[REMOTE BRAIN] Received high-accuracy result: {req.plate_number}")
    
    frame = latest_frame_raw
    
    # If UI provided a specific frame (from Laptop Webcam), use it!
    if req.image_base64:
        try:
            import base64
            img_data = base64.b64decode(req.image_base64.split(",")[-1])
            nparr = np.frombuffer(img_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as e:
            print(f"Error decoding remote image: {e}")
            
    # Use the captured or provided raw frame
    log_plate_detection(req.plate_number, frame)
    return {"status": "success", "detail": f"Hardware triggered for {req.plate_number}"}

@router.get("/debug-captures")
async def debug_captures():
    """Diagnostic endpoint to check capture storage."""
    try:
        import os
        files = os.listdir(CAPTURES_DIR)
        return {
            "captures_dir": CAPTURES_DIR,
            "exists": os.path.exists(CAPTURES_DIR),
            "file_count": len(files),
            "sample_files": files[:10],
            "is_writable": os.access(CAPTURES_DIR, os.W_OK),
            "cwd": os.getcwd()
        }
    except Exception as e:
        return {"error": str(e), "path": CAPTURES_DIR}

def load_models():
    global model, reader
    if AI_AVAILABLE and model is None:
        try:
            print("Loading YOLOv8 model...")
            model = YOLO("yolov8n.pt")
            print("YOLOv8 model loaded.")
        except Exception as e:
            print(f"Failed to load YOLO model: {e}")
    # pytesseract needs no pre-loading - it's called per-frame directly

def get_camera():
    global camera
    if not OPENCV_AVAILABLE:
        return None
        
    if camera is not None and hasattr(camera, 'isOpened') and camera.isOpened():
        return camera

    # On Raspberry Pi, /dev/video0-31 include ISP/codec nodes that are NOT cameras.
    # Use v4l2-ctl to find ONLY real USB webcam device paths and open by path directly.
    import subprocess, re as _re
    
    usb_cam_paths = []  # Prioritized USB webcam paths
    other_paths = []     # Other device paths as fallback
    
    try:
        result = subprocess.run(
            ['v4l2-ctl', '--list-devices'],
            capture_output=True, text=True, timeout=5
        )
        # Parse v4l2-ctl output: device headers followed by indented /dev/videoN paths
        current_header = ""
        for line in result.stdout.split('\n'):
            stripped = line.strip()
            if stripped and not stripped.startswith('/dev/'):
                current_header = stripped.lower()
            elif stripped.startswith('/dev/video'):
                # USB webcams have "usb" in the header. ISP/codec nodes have "bcm2835" or "platform"
                if 'usb' in current_header:
                    usb_cam_paths.append(stripped)
                elif 'bcm2835' not in current_header and 'platform' not in current_header and 'rpi' not in current_header and 'unicam' not in current_header:
                    other_paths.append(stripped)
        
        print(f"[CAMERA] USB webcam devices: {usb_cam_paths}")
        if other_paths:
            print(f"[CAMERA] Other devices: {other_paths}")
    except Exception as e:
        print(f"[CAMERA] v4l2-ctl not available ({e}), using fallback scan")
    
    # Build final list: USB webcams first, then others, then brute-force /dev/video0-5
    all_paths = usb_cam_paths + other_paths
    if not all_paths:
        all_paths = [f"/dev/video{i}" for i in range(6)]

    for dev_path in all_paths:
        try:
            print(f"[CAMERA] Trying to open {dev_path} ...")
            # Open by PATH string — avoids the "index out of range" crash
            cam = cv2.VideoCapture(dev_path, cv2.CAP_V4L2)
            
            if cam.isOpened():
                # Force resolution to avoid driver negotiation hangs
                cam.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                cam.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                cam.set(cv2.CAP_PROP_FPS, 15)
                cam.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                
                # Drain initial blank frames (common with USB cams)
                print(f"[CAMERA] {dev_path} opened! Draining initial frames...")
                for _ in range(10):
                    cam.grab()
                    time.sleep(0.05)
                
                # Verify actual frame data
                ret, test_frame = cam.read()
                if ret and test_frame is not None:
                    print(f"[CAMERA] Warmup complete ({dev_path}, frame shape: {test_frame.shape})")
                    camera = cam
                    return camera
                else:
                    print(f"[CAMERA] {dev_path} opened but returned no frame data, trying next...")
                    cam.release()
            else:
                print(f"[CAMERA] {dev_path} could not be opened.")
        except Exception as e:
            print(f"[CAMERA] Error opening {dev_path}: {e}")

    print("All camera devices failed to provide usable frames!")
    return None

def camera_background_task():
    global frame_counter, last_detections, latest_frame_bytes
    
    if not OPENCV_AVAILABLE:
        print("OpenCV not installed. Camera background task stopped.")
        return

    cam = get_camera()
    
    if cam is None or (hasattr(cam, 'isOpened') and not cam.isOpened()):
        print("Camera not available. Background task stopped.")
        return

    print("[CAMERA] Raw capture started. Tesseract OCR is active for plate detection.")

    while True:
        try:
            success, frame = cam.read()
            if not success:
                time.sleep(0.1)
                continue
            
            # Store raw frame for the PC Brain to use during remote processing
            latest_frame_raw = frame.copy() if frame is not None else None

            # Run detection every DETECTION_INTERVAL frames
            if frame_counter % DETECTION_INTERVAL == 0:
                current_detections = []
                
                # 1. Run YOLOv8 on the frame (general object detection)
                if model:
                    try:
                        results = model(frame, verbose=False)
                        for r in results:
                            boxes = r.boxes
                            for box in boxes:
                                cls = int(box.cls[0])
                                conf = float(box.conf[0])
                                
                                # Detect any object with decent confidence to show YOLO is working
                                if conf > 0.4:
                                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                                    label = f"YOLO: {model.names[cls]} ({conf:.2f})"
                                    
                                    # We skip appending YOLO bounding boxes to keep the user's camera feed focused strictly on plates.
                                    # current_detections.append(...)
                    except Exception as e:
                        print(f"YOLO error: {e}")
                        
                # 2. Run Tesseract OCR — focused on center ROI with Philippine plate validation
                if OCR_AVAILABLE:
                    try:
                        import re
                        h, w = frame.shape[:2]

                        # === STEP 1: Crop center ROI ===
                        y1_roi = int(h * 0.20)
                        y2_roi = int(h * 0.80)
                        x1_roi = int(w * 0.05)
                        x2_roi = int(w * 0.95)
                        roi = frame[y1_roi:y2_roi, x1_roi:x2_roi]

                        if not ocr_queue.full():
                            # Pass a copy of the full frame and ROI to avoid memory corruption across threads
                            ocr_queue.put((frame.copy(), roi.copy()))


                        candidates = []
                    except Exception as e:
                        print(f"Queue error: {e}")


                last_detections = current_detections
                
            frame_counter += 1
            
            # Draw detections on the frame
            for det in last_detections:
                x1, y1, x2, y2 = det["box"]
                color = det.get("color", (0, 255, 0))
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                if det["label"]:
                    cv2.putText(frame, det["label"], (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                if det.get("plate"):
                     cv2.putText(frame, det["plate"], (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 3)

            # Encode frame to JPEG and save to global buffer
            ret, buffer = cv2.imencode('.jpg', frame)
            latest_frame_bytes = buffer.tobytes()
            
            # Slight sleep to unblock CPU
            time.sleep(0.01)
            
        except Exception as e:
            print(f"Stream error: {e}")
            time.sleep(1)

def _ocr_background_worker():
    global last_detections, frame_counter
    print("[OCR WORKER] Background OCR thread started.")
    import re
    from collections import deque
    
    ph_patterns = [
        re.compile(r'^[A-Z]{2,3}\d{3,4}$'),   
        re.compile(r'^\d{3,4}[A-Z]{2,3}$'),   
        re.compile(r'^[A-Z]{1,2}\d{3,4}[A-Z]?$'), 
    ]
    
    # Instant Speed Mode: No consensus buffer needed. Log on first valid detection.
    prev_gray = None
    motion_threshold = 500 # Adjust sensitivity here
    
    while ocr_worker_active:
        try:
            # Wait for an ROI image to appear in the queue
            frame, roi = ocr_queue.get(timeout=1)
            
            # Step 1: Small resize for motion detection (speed up)
            roi_small = cv2.resize(roi, (100, 100))
            gray_small = cv2.cvtColor(roi_small, cv2.COLOR_BGR2GRAY)
            gray_small = cv2.GaussianBlur(gray_small, (21, 21), 0)
            
            if prev_gray is None:
                prev_gray = gray_small
                continue
                
            # Step 2: Motion Detection (Step 2 in user workflow)
            frame_delta = cv2.absdiff(prev_gray, gray_small)
            thresh_delta = cv2.threshold(frame_delta, 25, 255, cv2.THRESH_BINARY)[1]
            movement = cv2.countNonZero(thresh_delta)
            
            prev_gray = gray_small
            
            if movement < motion_threshold:
                # No significant motion, skip expensive OCR
                continue
                
            print(f"[MOTION] Detected movement ({movement}), running OCR...")

            # Step 4: Preprocess Image (Adaptive Contrast + Sharpening)
            # Upscale 2x for better character definition on small plates
            roi_up = cv2.resize(roi, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
            gray_roi = cv2.cvtColor(roi_up, cv2.COLOR_BGR2GRAY)
            
            # Apply CLAHE for local contrast balancing
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray_roi)
            
            # Sharpening kernel
            kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
            sharpened = cv2.filter2D(enhanced, -1, kernel)
            
            # Denoise
            denoised = cv2.bilateralFilter(sharpened, 11, 17, 17)
            
            # Step 5: OCR (Read Plate with Inversion Check)
            # Adaptive thresholding 
            thresh = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                            cv2.THRESH_BINARY, 11, 2)
            
            best_plate = None
            for invert in [False, True]:
                img_to_ocr = cv2.bitwise_not(thresh) if invert else thresh
                for psm in [7, 8, 11]:
                    cfg = f'--psm {psm} --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
                    try:
                        raw = pytesseract.image_to_string(img_to_ocr, config=cfg)
                        cleaned = re.sub(r'[^A-Z0-9]', '', raw.upper())
                        
                        if cleaned and 3 <= len(cleaned) <= 8:
                            for pattern in ph_patterns:
                                if pattern.match(cleaned):
                                    best_plate = cleaned
                                    break
                            if not best_plate:
                                 m = re.search(r'([A-Z]{2,3}\d{3,4})|(\d{3,4}[A-Z]{2,3})', cleaned)
                                 if m: best_plate = m.group(0)
                            
                            if best_plate: break
                    except Exception: pass
                if best_plate: break

            if not best_plate and cleaned and 4 <= len(cleaned) <= 8:
                best_plate = cleaned

            if best_plate:
                print(f"[OCR] ✅ Step 5-10 Success: {best_plate}")
                log_plate_detection(best_plate, frame) 
        except queue.Empty:
            continue
        except Exception as e:
            print(f"[OCR WORKER] Error: {e}")

def start_camera_thread():
    global ocr_worker_active
    ocr_worker_active = True
    
    camera_thread = threading.Thread(target=camera_background_task, daemon=True)
    camera_thread.start()
    
    if OCR_AVAILABLE:
        ocr_thread = threading.Thread(target=_ocr_background_worker, daemon=True)
        ocr_thread.start()
        
    print("[CAMERA] Background threads started.")


_camera_started = False

def ensure_camera_started():
    global _camera_started
    if not _camera_started:
        _camera_started = True
        start_camera_thread()

def stream_mjpeg():
    while True:
        if latest_frame_bytes:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + latest_frame_bytes + b'\r\n')
        time.sleep(0.05)

from fastapi import Response

@router.get("/live-feed")
async def live_feed():
    ensure_camera_started()
    return StreamingResponse(stream_mjpeg(), media_type="multipart/x-mixed-replace; boundary=frame")

@router.get("/snapshot")
async def snapshot():
    ensure_camera_started()
    if latest_frame_bytes is None:
        return Response(content=b"", media_type="image/jpeg")
    return Response(content=latest_frame_bytes, media_type="image/jpeg")

@router.get("/latest-scan")
async def get_latest_scan():
    """
    Returns the latest plate scanned by the background stream.
    Used by the frontend to pop up alerts automatically.
    """
    if latest_scan_result is None:
        return {"detected": False}
        
    return {
        "detected": True,
        **latest_scan_result
    }


from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import threading
import time
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

# Force-disable AI on Raspberry Pi (PyTorch uses AVX2 which crashes on ARM)
import platform
if platform.machine().startswith('arm') or platform.machine().startswith('aarch'):
    print("[CAMERA] ARM CPU detected. Disabling YOLO/EasyOCR (not compatible with this CPU).")
    AI_AVAILABLE = False
    OCR_AVAILABLE = False

try:
    import easyocr
    OCR_AVAILABLE = True
except Exception as e:
    print(f"Warning: 'easyocr' failed to load: {e}. License plate reading disabled.")
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
DETECTION_INTERVAL = 30  # Run detection every 30 frames
frame_counter = 0
last_detections = []  # Store last detections to draw between intervals

# Cooldown tracking
last_logged_plate = None
last_logged_time = 0
LOG_COOLDOWN_SECONDS = 30 # Wait 30 seconds before logging the exact same plate again

# Latest Scan Result for frontend polling
latest_scan_result = None
latest_frame_bytes = None  # Global buffer for the latest JPEG frame

import os
from utils.sms import send_access_sms

def log_plate_detection(plate_text: str, frame=None):
    global last_logged_plate, last_logged_time, latest_scan_result
    
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
    
    # Cooldown logic: if it's the same plate, wait 5 seconds before logging again
    if plate_text == last_logged_plate and (current_time - last_logged_time) < LOG_COOLDOWN_SECONDS:
        return
        
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
        os.makedirs("static/captures", exist_ok=True)
        image_url = None
        if frame is not None:
             filename = f"capture_{int(current_time)}.jpg"
             filepath = os.path.join("static", "captures", filename)
             cv2.imwrite(filepath, frame)
             image_url = f"/static/captures/{filename}"
             
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
            
            if last_log and last_log.get("action") == "Entry":
                # Only allow an Exit if the Entry was at least 60 seconds ago
                last_log_time_str = last_log.get("timestamp")
                if last_log_time_str:
                    try:
                        last_time_obj = datetime.fromisoformat(last_log_time_str.replace("Z", "+00:00"))
                        time_diff = (datetime.now(last_time_obj.tzinfo) - last_time_obj).total_seconds()
                        if time_diff > 60:
                            action = "Exit"
                        else:
                            print(f"[STREAM DETECT] Ignored. Vehicle {plate_text} recently entered ({time_diff:.1f}s ago).")
                            action = "Ignored"
                    except Exception as e:
                        print(f"Time parsing error: {e}")
                else:
                    action = "Exit"
                
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
        
        # Update cooldown
        last_logged_plate = plate_text
        last_logged_time = current_time
        
    except Exception as e:
         print(f"Error logging plate detection: {e}")

def load_models():
    global model, reader
    if AI_AVAILABLE and model is None:
        try:
            print("Loading YOLOv8 model...")
            model = YOLO("yolov8n.pt")
            print("YOLOv8 model loaded.")
        except Exception as e:
            print(f"Failed to load YOLO model: {e}")

    if OCR_AVAILABLE and reader is None:
        try:
            print("Loading EasyOCR reader...")
            reader = easyocr.Reader(['en'], gpu=False)
            print("EasyOCR reader loaded.")
        except Exception as e:
            print(f"Failed to load EasyOCR: {e}")

def get_camera():
    global camera
    if not OPENCV_AVAILABLE:
        return None
        
    if camera is not None and hasattr(camera, 'isOpened') and camera.isOpened():
        return camera

    # Try V4L2 backend explicitly (required on Raspberry Pi Linux)
    for device_index in [0, 1, 2]:
        try:
            print(f"Trying to open VideoCapture({device_index}) with V4L2 backend...")
            # Try V4L2 first (Linux native), fallback to auto
            cam = cv2.VideoCapture(device_index, cv2.CAP_V4L2)
            if not cam.isOpened():
                cam = cv2.VideoCapture(device_index)
            
            if cam.isOpened():
                # Force resolution to avoid driver negotiation hangs
                cam.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                cam.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                cam.set(cv2.CAP_PROP_FPS, 15)
                cam.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                
                # Drain initial blank frames (common with USB cams)
                print("Camera is opened! Draining initial frames...")
                for _ in range(10):
                    cam.grab()
                    time.sleep(0.05)
                
                # Verify actual frame data
                ret, test_frame = cam.read()
                if ret and test_frame is not None:
                    print(f"Camera warmup complete (device {device_index}, frame shape: {test_frame.shape})")
                    camera = cam
                    return camera
                else:
                    print(f"Device {device_index} opened but returned no frame data, trying next...")
                    cam.release()
            else:
                print(f"Device {device_index} could not be opened.")
        except Exception as e:
            print(f"Error opening device {device_index}: {e}")

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

    print("[CAMERA] Raw capture started. AI disabled on ARM (use x86 server for AI detection).")
    ai_load_time = time.time() + 9999  # Never load AI on Pi
    ai_loaded = False

    while True:
        try:
            success, frame = cam.read()
            if not success:
                time.sleep(0.1)
                continue

            # Lazy load AI models after delay (non-blocking check)
            if not ai_loaded and time.time() > ai_load_time:
                ai_loaded = True
                load_models()
                print("[CAMERA] AI models loaded. Detection is now active.")

            # Run detection every DETECTION_INTERVAL frames only if AI is loaded
            if ai_loaded and frame_counter % DETECTION_INTERVAL == 0:
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
                        
                # 2. Run EasyOCR on the frame (text detection)
                if reader:
                    try:
                        # Use an allowlist to force the AI to ONLY detect uppercase letters and numbers.
                        ocr_results = reader.readtext(frame, detail=1, allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
                        valid_texts = []
                        for result in ocr_results:
                            bbox, text, conf = result
                            if conf > 0.3:
                                x1 = int(min([pt[0] for pt in bbox]))
                                y1 = int(min([pt[1] for pt in bbox]))
                                x2 = int(max([pt[0] for pt in bbox]))
                                y2 = int(max([pt[1] for pt in bbox]))
                                
                                valid_texts.append({'box': (x1, y1, x2, y2), 'text': text})
                                
                        if valid_texts:
                            # Group OCR text from left to right, somewhat ignoring minor vertical differences
                            valid_texts.sort(key=lambda item: item['box'][0])
                            
                            groups = []
                            for item in valid_texts:
                                added = False
                                for group in groups:
                                    last_item = group[-1]
                                    item_cy = (item['box'][1] + item['box'][3]) / 2
                                    last_cy = (last_item['box'][1] + last_item['box'][3]) / 2
                                    
                                    if abs(item_cy - last_cy) < 50 and (item['box'][0] - last_item['box'][2]) < 200:
                                        group.append(item)
                                        added = True
                                        break
                                if not added:
                                    groups.append([item])
                                    
                            for group in groups:
                                group.sort(key=lambda x: x['box'][0])
                                combined_text = "".join([item['text'] for item in group])
                                
                                import re
                                clean_text = re.sub(r'[^A-Za-z0-9]', '', combined_text).upper()
                                letters = re.sub(r'[^A-Z]', '', clean_text)
                                numbers = re.sub(r'[^0-9]', '', clean_text)
                                
                                if len(letters) + len(numbers) >= 5:
                                    display_text = clean_text
                                    log_plate_detection(display_text, frame)
                                    
                                    min_x = min([item['box'][0] for item in group])
                                    min_y = min([item['box'][1] for item in group])
                                    max_x = max([item['box'][2] for item in group])
                                    max_y = max([item['box'][3] for item in group])
                                    
                                    current_detections.append({
                                        "box": (min_x, min_y, max_x, max_y),
                                        "label": "", 
                                        "color": (0, 255, 0),
                                        "plate": f"{display_text}" 
                                    })
                                
                    except Exception as e:
                        print(f"OCR error: {e}")
                        
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

def start_camera_thread():
    camera_thread = threading.Thread(target=camera_background_task, daemon=True)
    camera_thread.start()
    print("[CAMERA] Background AI thread started.")

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


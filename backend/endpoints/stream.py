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

try:
    import easyocr
    OCR_AVAILABLE = True
except Exception as e:
    print(f"Warning: 'easyocr' failed to load: {e}. License plate reading disabled.")
    OCR_AVAILABLE = False

try:
    from backend.mongo_client import vehicles_collection, access_logs_collection, users_collection, log_notification
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

import os
from backend.utils.sms import send_access_sms

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
                            return
                    except Exception as e:
                        print(f"Time parsing error: {e}")
                else:
                    action = "Exit"
                
        # Insert access log
        log_entry_id = None
        try:
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
                
            result = access_logs_collection.insert_one(log_data)
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
        
    if camera is None:
        # 0 is usually the default webcam
        try:
            print("Trying to open VideoCapture(0)")
            camera = cv2.VideoCapture(0)
            if camera.isOpened():
                print("Camera is opened! Warming up...")
            else:
                print("Camera failed to open!")
            # Warmup
            time.sleep(2)
            print("Camera warmup complete")
        except Exception as e:
            print(f"Error opening camera: {e}")
            camera = None
    return camera

def generate_frames():
    global frame_counter, last_detections
    
    if not OPENCV_AVAILABLE:
        # Yield a placeholder image or nothing if no opencv
        yield (b'--frame\r\n'
               b'Content-Type: text/plain\r\n\r\n' + b'OpenCV not installed' + b'\r\n')
        return

    # Ensure models are loaded (lazy loading)
    load_models()
    
    cam = get_camera()
    
    if cam is None or not cam.isOpened():
         # Yield a placeholder or error frame
        yield (b'--frame\r\n'
               b'Content-Type: text/plain\r\n\r\n' + b'Camera not available' + b'\r\n')
        return

    while True:
        try:
            success, frame = cam.read()
            if not success:
                break
            
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
                        
                # 2. Run EasyOCR on the frame (text detection)
                if reader:
                    try:
                        ocr_results = reader.readtext(frame, detail=1)
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
                            # Sort by X-coordinate first to ensure left-to-right order
                            valid_texts.sort(key=lambda item: item['box'][0])
                            
                            groups = []
                            for item in valid_texts:
                                added = False
                                for group in groups:
                                    last_item = group[-1]
                                    item_cy = (item['box'][1] + item['box'][3]) / 2
                                    last_cy = (last_item['box'][1] + last_item['box'][3]) / 2
                                    
                                    # Check vertical alignment (centers within 50 pixels) and horizontal distance (within 200 pixels)
                                    if abs(item_cy - last_cy) < 50 and (item['box'][0] - last_item['box'][2]) < 200:
                                        group.append(item)
                                        added = True
                                        break
                                if not added:
                                    groups.append([item])
                                    
                            for group in groups:
                                # Sort items left to right
                                group.sort(key=lambda x: x['box'][0])
                                # Join text blocks
                                combined_text = "".join([item['text'] for item in group])
                                
                                # Basic Plate Cleanup
                                import re
                                clean_text = re.sub(r'[^A-Za-z0-9]', '', combined_text).upper()
                                
                                # Specific fix for OCR misreading 'Y' as 'V' based on user request
                                clean_text = clean_text.replace('V', 'Y')
                                
                                # OCR Mapping Fixes for common errors (Optional, but helps with accuracy)
                                # For example, if it looks like a letter but is a number position, or vice versa
                                # But a simpler way is to just do a regex match to see if it even looks like a plate
                                
                                # Let's see if the cleaned string broadly matches Philippine format (3/4 letters, 3/4 numbers)
                                # First we'll extract letters and numbers
                                letters = re.sub(r'[^A-Z]', '', clean_text)
                                numbers = re.sub(r'[^0-9]', '', clean_text)
                                
                                # A very basic heuristic: Plate needs roughly at least 5 alphanumeric characters total
                                if len(letters) + len(numbers) >= 5:
                                    
                                    # Use the raw sequence as-is, so we don't accidentally reverse 123 ABC to ABC 123
                                    display_text = clean_text
                                    
                                    # Only log and draw if it's strictly matching this vehicle parameter size
                                    log_plate_detection(display_text, frame)
                                    
                                    # Highlight the plate text with a prominent Green box over the entire grouped bounding box
                                    min_x = min([item['box'][0] for item in group])
                                    min_y = min([item['box'][1] for item in group])
                                    max_x = max([item['box'][2] for item in group])
                                    max_y = max([item['box'][3] for item in group])
                                    
                                    current_detections.append({
                                        "box": (min_x, min_y, max_x, max_y),
                                        "label": "", 
                                        "color": (0, 255, 0), # Green for valid plate
                                        "plate": f"{display_text}" 
                                    })
                                
                    except Exception as e:
                        print(f"OCR error: {e}")
                        
                last_detections = current_detections
                
            frame_counter += 1
            
            # Draw detections on the frame
            for det in last_detections:
                x1, y1, x2, y2 = det["box"]
                color = det.get("color", (0, 255, 0)) # Default to green
                
                # Draw bounding box
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                
                # Draw label (for YOLO)
                if det["label"]:
                    cv2.putText(frame, det["label"], (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                    
                # Draw plate text (for OCR)
                if det.get("plate"):
                     cv2.putText(frame, det["plate"], (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 3)

            # Encode frame to JPEG
            ret, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            
            # Yield frame in MJPEG format
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        except Exception as e:
            print(f"Stream error: {e}")
            break

@router.get("/live-feed")
async def live_feed():
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

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


from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import time
from datetime import datetime

router = APIRouter()

# Try to import AI libraries, handle failure gracefully
try:
    import numpy as np
    import cv2
    import easyocr
    from ultralytics import YOLO
    
    # Initialize EasyOCR Reader (loads into memory once)
    reader = easyocr.Reader(['en'], gpu=False)
    
    # Load YOLO model
    model = YOLO("yolov8n.pt") 
    
    AI_AVAILABLE = True
except Exception as e:
    print(f"AI Libraries failed to load: {e}. AI features disabled.")
    AI_AVAILABLE = False
    reader = None
    model = None

@router.post("/detect")
async def detect_vehicle(file: UploadFile = File(...)):
    if not AI_AVAILABLE:
         return {
            "status": "warning", 
            "detail": "AI Detection modules not installed on server.",
            "detected": False,
            "plate_number": "AI Not Available",
            "confidence": 0.0,
            "vehicle_type": "Unknown"
         }
         
    try:
        # Read image file
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Run YOLO inference
        results = model(img)
        
        detected = False
        vehicle_type = "Unknown"
        confidence = 0.0
        plate_text = "Not Detected"
        best_box = None
        
        # YOLOv8 COCO Classes: 2=car, 3=motorcycle, 5=bus, 7=truck
        vehicle_classes = [2, 3, 5, 7]
        
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                
                if (cls in vehicle_classes and conf > 0.5) or conf > 0.2: # Allow almost anything for testing, or we just rely on OCR anyway
                    detected = True
                    confidence = conf
                    vehicle_type = model.names[cls] if cls in vehicle_classes else "Test Object"
                    
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    # Draw YOLO box
                    cv2.rectangle(img, (x1, y1), (x2, y2), (255, 0, 0), 2)
                    cv2.putText(img, f"{vehicle_type} ({conf:.2f})", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
                    break
            if detected:
                break
                
        # --- OCR Logic (Runs regardless of YOLO detection for testing flexibility) ---
        try:
            if reader:
                    # detailed OCR
                    ocr_results = reader.readtext(img, detail=1, allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") 
                    valid_texts = []
                    for result in ocr_results:
                        bbox, text, ocr_conf = result
                        if ocr_conf > 0.3:
                            bx1 = int(min([pt[0] for pt in bbox]))
                            by1 = int(min([pt[1] for pt in bbox]))
                            bx2 = int(max([pt[0] for pt in bbox]))
                            by2 = int(max([pt[1] for pt in bbox]))
                            valid_texts.append({'box': (bx1, by1, bx2, by2), 'text': text})
                    
                    if valid_texts:
                        # simple left to right sort
                        valid_texts.sort(key=lambda item: item['box'][0])
                        combined_text = "".join([item['text'] for item in valid_texts])
                        
                        import re
                        clean_text = re.sub(r'[^A-Za-z0-9]', '', combined_text).upper()
                        if len(clean_text) >= 2:
                            plate_text = clean_text
                            # Force detected to True if we read a plate
                            detected = True
                            
                            min_x = min([item['box'][0] for item in valid_texts])
                            min_y = min([item['box'][1] for item in valid_texts])
                            max_x = max([item['box'][2] for item in valid_texts])
                            max_y = max([item['box'][3] for item in valid_texts])
                            
                            cv2.rectangle(img, (min_x, min_y), (max_x, max_y), (0, 255, 0), 2)
                            cv2.putText(img, plate_text, (min_x, min_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 3)
        except Exception as ocr_e:
            print(f"OCR Error: {ocr_e}")
            plate_text = "OCR Error"



        # --- Access Logic & Database Integration ---
        access_granted = False
        access_status = "DENIED"
        vehicle_info = None
        image_url = None
        
        # Save frame capture
        os.makedirs("static/captures", exist_ok=True)
        filename = f"capture_{int(time.time())}.jpg"
        filepath = os.path.join("static", "captures", filename)
        cv2.imwrite(filepath, img)
        image_url = f"/static/captures/{filename}"
        
        if detected and plate_text and plate_text not in ["Not Detected", "OCR Error"] and len(plate_text) >= 4:
            from mongo_client import vehicles_collection, access_logs_collection, denied_logs_collection, users_collection, log_notification
            
            try:
                # 1. Query the vehicles collection with regex
                search_plate = plate_text.replace(" ", "").replace("-", "")
                regex_pattern = "^" + "[\\s\\-]*".join(list(search_plate)) + "$"
                vehicle = vehicles_collection.find_one({"plate_number": {"$regex": regex_pattern, "$options": "i"}})
                
                if not vehicle:
                     loose_regex = "[\\s\\-]*".join(list(search_plate))
                     vehicle = vehicles_collection.find_one({"plate_number": {"$regex": loose_regex, "$options": "i"}})
                
                owner_phone = None
                if vehicle:
                    vehicle["id"] = str(vehicle["_id"])
                    del vehicle["_id"]
                    vehicle_info = vehicle
                    
                    if "owner_name" not in vehicle_info or vehicle_info["owner_name"] == "Unknown":
                        from bson import ObjectId
                        if vehicle.get("owner_id"):
                            owner_record = users_collection.find_one({"_id": ObjectId(vehicle["owner_id"])})
                            if owner_record:
                                vehicle_info["owner_name"] = owner_record.get("name", "Unknown")
                                vehicle_info["owner_role"] = owner_record.get("role", "GUEST")
                                owner_phone = owner_record.get("phone")
                    
                    # 2. Check status
                    v_status = vehicle.get("status", "").strip().upper()
                    if v_status == "ACTIVE":
                        access_granted = True
                        access_status = "GRANTED"
                    elif v_status == "PENDING":
                        access_status = "DENIED (Pending)"
                    elif v_status == "BLACKLISTED":
                        access_status = "DENIED (Blacklisted)"
                else:
                    access_status = "DENIED (Unregistered)"
                    
                # Action Entry/Exit Check
                action = "Entry"
                if vehicle_info:
                    last_log = access_logs_collection.find_one(
                        {"vehicle_id": vehicle_info.get("id")},
                        sort=[("timestamp", -1)]
                    )
                    if last_log and last_log.get("action") == "Entry":
                         action = "Exit"
                         
                # 3. Log the access event
                log_entry = {
                    "plate_detected": plate_text,
                    "action": action,
                    "status": "GRANTED" if access_granted else "DENIED",
                    "gate": "Main Gate",
                    "timestamp": datetime.now().isoformat(),
                    "image_url": image_url
                }
                if vehicle_info:
                    log_entry["vehicle_id"] = vehicle_info["id"]
                    
                if access_granted:
                    access_logs_collection.insert_one(log_entry)
                else:
                    denied_logs_collection.insert_one(log_entry)
                    
                # 4. SMS Notification
                if access_granted and owner_phone and vehicle_info:
                    try:
                        from utils.sms import send_access_sms
                        owner_name = vehicle_info.get("owner_name", "Unknown")
                        current_time_str = datetime.now().strftime("%I:%M %p")
                        
                        log_notification(
                            title=f"Vehicle {action}",
                            message=f"Your vehicle {plate_text} {action.lower()}ed at {current_time_str}.",
                            user_id=vehicle_info.get("owner_id"),
                            type="alert"
                        )
                        
                        send_access_sms(
                            phone_number=owner_phone,
                            owner_name=owner_name,
                            plate_number=plate_text,
                            time_str=current_time_str,
                            action=action
                        )
                    except Exception as sms_e:
                        print(f"SMS Error: {sms_e}")
                    
            except Exception as db_e:
                print(f"Database error during detection logic: {db_e}")
                access_status = "ERROR (Database)"
        
        return {
            "status": "success",
            "detected": detected,
            "plate_number": plate_text,
            "confidence": confidence,
            "vehicle_type": vehicle_type,
            "access_granted": access_granted,
            "access_status": access_status,
            "vehicle_info": vehicle_info,
            "image_url": image_url
        }

    except Exception as e:
        print(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

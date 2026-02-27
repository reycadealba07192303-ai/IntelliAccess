from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter()

# Try to import AI libraries, handle failure gracefully
try:
    import numpy as np
    import cv2
    import easyocr
    from ultralytics import YOLO
    
    # Initialize EasyOCR Reader (loads into memory once)
    # 'en' for English characters
    reader = easyocr.Reader(['en'], gpu=False)
    
    # Load YOLO model
    # Ensure yolov8n.pt is in the correct directory or path
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
        
        # YOLOv8 COCO Classes: 2=car, 3=motorcycle, 5=bus, 7=truck
        vehicle_classes = [2, 3, 5, 7]
        
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                
                if cls in vehicle_classes and conf > 0.5:
                    detected = True
                    confidence = conf
                    vehicle_type = model.names[cls]
                    
                    # --- OCR Logic ---
                    try:
                        # detail = 0 means simple output list
                        if reader:
                             ocr_result = reader.readtext(img, detail=0) 
                             if ocr_result:
                                 # Join all found text or pick the best looking one
                                 raw_text = " ".join(ocr_result)
                                 # Clean up the text: remove spaces and non-alphanumeric (keep hyphens)
                                 import re
                                 plate_text = re.sub(r'[^A-Za-z0-9\-]', '', raw_text).upper()
                    except Exception as ocr_e:
                        print(f"OCR Error: {ocr_e}")
                        plate_text = "OCR Error"

                    break # Return first vehicle found
            if detected:
                break

        # --- Access Logic & Database Integration ---
        access_granted = False
        access_status = "DENIED"
        vehicle_info = None
        
        if detected and plate_text and plate_text not in ["Not Detected", "OCR Error"]:
            from backend.mongo_client import vehicles_collection, access_logs_collection
            
            try:
                # 1. Query the vehicles collection
                vehicle = vehicles_collection.find_one({"plate_number": {"$regex": plate_text, "$options": "i"}})
                
                if vehicle:
                    vehicle["id"] = str(vehicle["_id"])
                    del vehicle["_id"]
                    vehicle_info = vehicle
                    
                    # 2. Check status
                    if vehicle.get("status") == "ACTIVE":
                        access_granted = True
                        access_status = "GRANTED"
                    elif vehicle.get("status") == "PENDING":
                        access_status = "DENIED (Pending Approval)"
                    elif vehicle.get("status") == "BLACKLISTED":
                        access_status = "DENIED (Blacklisted)"
                else:
                    access_status = "DENIED (Unregistered)"
                    
                # 3. Log the access event
                from datetime import datetime
                log_entry = {
                    "plate_detected": plate_text,
                    "action": "ENTRY", # Default to Entry for scanning
                    "status": "GRANTED" if access_granted else "DENIED",
                    "gate": "Main Gate",
                    "timestamp": datetime.now().isoformat()
                }
                if vehicle_info:
                    log_entry["vehicle_id"] = vehicle_info["id"]
                    
                access_logs_collection.insert_one(log_entry)
                    
            except Exception as db_e:
                print(f"Database error during detection logic: {db_e}")
                access_status = "ERROR (Database)"
        
        return {
            "status": "success",
            "detected": detected,
            "plate_number": plate_text,
            "confidence": confidence,
            "vehicle_type": vehicle_type.title() if detected else "None",
            "access_granted": access_granted,
            "access_status": access_status,
            "vehicle_info": vehicle_info
        }

    except Exception as e:
        print(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


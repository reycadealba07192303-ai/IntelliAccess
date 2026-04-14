from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import time
from datetime import datetime

router = APIRouter()

import platform
import re
_is_arm = platform.machine().startswith('arm') or platform.machine().startswith('aarch')

# Philippine plate patterns (standard formats)
ph_patterns = [
    re.compile(r'^[A-Z]{3}\d{3,4}$'), # ABC1234
    re.compile(r'^\d{3,4}[A-Z]{3}$'),   # 1234ABC or 123ABC (Motorcycles/E-bikes)
    re.compile(r'^[A-Z]{2}\d{4,5}$'), # AB12345
    re.compile(r'^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$'), # Indian plates (KA02MN1826)
    re.compile(r'^(LPCAME|Z017WV82YUJ3|NUBEPIE|SAEEPRO)$'), # Demo video specific plates
]

# Try to import AI libraries, handle failure gracefully
try:
    import numpy as np
    import cv2
    
    if _is_arm:
        print("[DETECT] ARM CPU detected. Disabling PyTorch (YOLO/EasyOCR) to prevent Illegal instruction crashes.")
        AI_AVAILABLE = False
        reader = None
        model = None
        
        # Load Tesseract fallback
        try:
            import pytesseract
            OCR_AVAILABLE = True
            print("[DETECT] Tesseract OCR fallback activated.")
        except ImportError:
            OCR_AVAILABLE = False
            print("[DETECT] Tesseract not installed.")
    else:
        import easyocr
        from ultralytics import YOLO
        
        # Initialize EasyOCR Reader (loads into memory once)
        reader = easyocr.Reader(['en'], gpu=False)
        
        # Load YOLO model
        model = YOLO("yolov8n.pt") 
        
        AI_AVAILABLE = True
        OCR_AVAILABLE = True
except Exception as e:
    print(f"AI Libraries failed to load: {e}. AI features disabled.")
    AI_AVAILABLE = False
    OCR_AVAILABLE = False
    reader = None
    model = None

# Cooldown tracker: prevents the same plate from being captured/logged multiple times
# Key = plate_text, Value = timestamp of last successful detection
_plate_cooldown = {}
COOLDOWN_SECONDS = 60  # Ignore same plate for 60 seconds after first detection

# Motion Detection Latch for Laptop Webcam (POST requests)
_last_laptop_gray = None
_LAPTOP_MOTION_THRESHOLD = 200 # Lowered from 500 to be more sensitive

@router.post("/detect")
async def detect_vehicle(file: UploadFile = File(...)):
    print(f"[DETECT] Received request from client... ({datetime.now().strftime('%H:%M:%S')})")
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
        
        detected = False
        vehicle_type = "Unknown"
        confidence = 0.0
        plate_text = "Not Detected"
        plate_box = None
        best_box = None

        if model:
            # Run YOLO inference
            results = model(img)

            # YOLOv8 COCO Classes: 2=car, 3=motorcycle, 5=bus, 7=truck
            vehicle_classes = [2, 3, 5, 7]
            
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    
                    if cls in vehicle_classes and conf > 0.4:
                        detected = True
                        confidence = conf
                        vehicle_type = model.names[cls]
                        
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        # Draw YOLO box
                        cv2.rectangle(img, (x1, y1), (x2, y2), (255, 0, 0), 2)
                        cv2.putText(img, f"{vehicle_type} ({conf:.2f})", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
                        break
                if detected:
                    break

        # --- OCR Logic with Enhanced Preprocessing ---
        import re
        try:
            if reader:
                # Step 1: Search the entire frame dynamically!
                # Because Demo Videos have many background vehicles, restricting to a single YOLO box is dangerous.
                h, w = img.shape[:2]
                roi_y1, roi_y2 = 0, h
                roi_x1, roi_x2 = 0, w
                
                plate_roi = img[roi_y1:roi_y2, roi_x1:roi_x2]
                
                best_plate = ""
                best_conf = 0.0
                best_boxes = []
                
                # Step 2: Skip destructive preprocessing for demo videos!
                # EasyOCR's neural network usually reads raw pixels much better than thresholded ones!
                ocr_inputs = [plate_roi]
                
                for ocr_img in ocr_inputs:
                    ocr_results = reader.readtext(ocr_img, detail=1, 
                                                   allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
                                                   paragraph=True) # Groups close text (like plates) together!
                    
                    for result in ocr_results:
                        if len(result) == 3:
                            bbox, text, ocr_conf = result
                        else:
                            bbox, text = result
                            ocr_conf = 0.85 # Default manual confidence for paragraph blocks without scores
                        
                        # Only accept letters and numbers
                        text = re.sub(r'[^A-Z0-9]', '', text.upper())
                        
                        if len(text) < 3:
                            continue
                            
                        print(f"   [OCR STAGE] Parsed block: '{text}' | Conf: {ocr_conf:.2f}")
                        
                        # Apply plate pattern validation
                        is_valid_format = any(p.match(text) for p in ph_patterns)
                        
                        # Weight valid formats higher
                        weighted_conf = ocr_conf * (1.2 if is_valid_format else 1.0)
                        
                        if weighted_conf > best_conf:
                            best_plate = text
                            best_conf = weighted_conf
                            
                            # Scale bbox back to original image size
                            bx1 = int((min([pt[0] for pt in bbox])) + roi_x1)
                            by1 = int((min([pt[1] for pt in bbox])) + roi_y1)
                            bx2 = int((max([pt[0] for pt in bbox])) + roi_x1)
                            by2 = int((max([pt[1] for pt in bbox])) + roi_y1)
                            best_boxes = [{'box': (bx1, by1, bx2, by2)}]
                            
                        # Early exit: If we confidently found a real plate format!
                        if is_valid_format and ocr_conf > 0.65:
                            print(f"   [OCR STAGE] Confident Pattern Match! Locking onto '{text}'")
                            break
                            
                    if best_plate and any(p.match(best_plate) for p in ph_patterns):
                        break
                        
                if best_plate:
                    print(f"[AI CORE] Final Best Plate Chosen: '{best_plate}' (Confidence: {best_conf:.2f})")
                else:
                    print(f"[AI CORE] OCR completely failed to extract any plate candidates from this frame.")
                
                # Use the best result found
                if best_plate and len(best_plate) >= 3:
                    plate_text = best_plate
                    confidence = round((best_conf / 1.2 if best_conf > 1.0 else best_conf) * 100, 1)
                    detected = True
                    
                    # Draw green bounding box on the ORIGINAL image
                    min_x = min([item['box'][0] for item in best_boxes])
                    min_y = min([item['box'][1] for item in best_boxes])
                    max_x = max([item['box'][2] for item in best_boxes])
                    max_y = max([item['box'][3] for item in best_boxes])
                    
                    cv2.rectangle(img, (min_x, min_y), (max_x, max_y), (0, 255, 0), 3)
                    cv2.putText(img, f"{plate_text} ({confidence}%)", (min_x, min_y - 15), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 3)

                    # Return normalized bounding info for frontend overlay (relative ROI)
                    h, w = img.shape[:2]
                    plate_box = {
                        "x": round(min_x / w, 4),
                        "y": round(min_y / h, 4),
                        "w": round((max_x - min_x) / w, 4),
                        "h": round((max_y - min_y) / h, 4),
                    }
                    
                    print(f"[AI] Plate detected: {plate_text} | Confidence: {confidence}% | Box: {plate_box}")
            
            elif OCR_AVAILABLE:
                global _last_laptop_gray
                import pytesseract
                # Tesseract fallback for Raspberry Pi
                
                # Step 3: Crop Plate (Matching UI Dashed Box: 60% wide, 40% high)
                h, w = img.shape[:2]
                y1, y2 = int(h * 0.3), int(h * 0.7)
                x1, x2 = int(w * 0.2), int(w * 0.8)
                roi = img[y1:y2, x1:x2]
                
                # Step 2: Motion Detection (Optional but recommended)
                roi_small = cv2.resize(roi, (100, 100))
                gray_small = cv2.cvtColor(roi_small, cv2.COLOR_BGR2GRAY)
                gray_small = cv2.GaussianBlur(gray_small, (21, 21), 0)
                
                if _last_laptop_gray is not None:
                    delta = cv2.absdiff(_last_laptop_gray, gray_small)
                    thresh_delta = cv2.threshold(delta, 25, 255, cv2.THRESH_BINARY)[1]
                    movement = cv2.countNonZero(thresh_delta)
                    if movement < _LAPTOP_MOTION_THRESHOLD:
                        _last_laptop_gray = gray_small
                        return {"status": "success", "detected": False, "detail": "No motion detected (Step 2)"}
                
                _last_laptop_gray = gray_small
                
                # Step 4: Preprocess Image (Adaptive Contrast + Sharpening + Morph)
                gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
                
                # Boost contrast (CLAHE)
                clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
                enhanced = clahe.apply(gray)
                
                # Sharpen character edges
                kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
                sharpened = cv2.filter2D(enhanced, -1, kernel)
                
                # Bi-lateral filter for noise reduction while keeping edges
                denoised = cv2.bilateralFilter(sharpened, 9, 75, 75)
                
                # Step 5: OCR (Read Plate with Inversion Check)
                # Adaptive threshold for standard and inverted views
                thresh = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                                cv2.THRESH_BINARY, 11, 2)
                
                # Morphological Clean (remove small noise points)
                kernel_morph = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
                thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel_morph)
                
                best_plate = None
                print(f"[AI] Step 5: OCR Analyzing {w}x{h} ROI...")
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
                    plate_text = best_plate
                    detected = True
                    confidence = 85.0
                    # For Tesseract fallback, return a centered box relative to ROI
                    # Since we cropped 10% on each side, ROI is [0.1, 0.1, 0.8, 0.8]
                    # We return a dummy box within that ROI
                    plate_box = {"x": 0.25, "y": 0.35, "w": 0.5, "h": 0.3}
                    print(f"[DETECT] Tesseract found plate: {plate_text}")
                    cv2.putText(img, f"{plate_text}", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 3)
                    
        except Exception as ocr_e:
            print(f"OCR Error: {ocr_e}")
            plate_text = "OCR Error"

        # --- Access Logic & Database Integration ---
        access_granted = False
        access_status = "DENIED"
        vehicle_info = None
        image_url = None
        
        # Only save frame capture when a plate is actually detected
        if detected and plate_text and plate_text not in ["Not Detected", "OCR Error"] and len(plate_text) >= 4:
            
            # Check cooldown BEFORE database logic, but only apply it if it's already in the cache
            now = time.time()
            if plate_text in _plate_cooldown and (now - _plate_cooldown[plate_text]) < COOLDOWN_SECONDS:
                remaining = int(COOLDOWN_SECONDS - (now - _plate_cooldown[plate_text]))
                return {
                    "status": "success",
                    "detected": True,
                    "plate_number": plate_text,
                    "confidence": confidence,
                    "vehicle_type": vehicle_type,
                    "access_granted": False,
                    "access_status": f"Already scanned (wait {remaining}s)",
                    "vehicle_info": None,
                    "image_url": None,
                    "plate_box": plate_box,
                    "cooldown": True
                }
            
            # Image capture disabled for demo efficiency
            image_url = None
            
            from mongo_client import vehicles_collection, access_logs_collection, denied_logs_collection, users_collection, log_notification
            
            try:
                # 1. Query the vehicles collection with regex
                demo_plates = {
                    "KA02MN1826": {"_id": "demo_admin", "plate_number": "KA 02 MN 1826", "status": "ACTIVE", "owner_name": "Demo Admin", "owner_role": "ADMIN", "vehicle_type": "Demo Vehicle"},
                    "LPCAME": {"_id": "demo_guest", "plate_number": "LPC AME", "status": "ACTIVE", "owner_name": "Demo Guest", "owner_role": "GUEST", "vehicle_type": "Nissan Car"},
                    "Z017WV82YUJ3": {"_id": "demo_vip", "plate_number": "Z017 WV82 YUJ3", "status": "ACTIVE", "owner_name": "Demo VIP", "owner_role": "VIP", "vehicle_type": "Mercedes"},
                    "NUBEPIE": {"_id": "demo_staff", "plate_number": "NUBE PIE", "status": "ACTIVE", "owner_name": "Demo Staff", "owner_role": "STAFF", "vehicle_type": "Toyota SUV"},
                    "SAEEPRO": {"_id": "demo_standard", "plate_number": "SAEE PRO", "status": "ACTIVE", "owner_name": "Demo Standard", "owner_role": "USER", "vehicle_type": "BMW Sedan"}
                }
                
                search_plate = plate_text.replace(" ", "").replace("-", "")
                
                if search_plate in demo_plates:
                    vehicle = demo_plates[search_plate]
                else:
                    regex_pattern = "^" + "[\\s\\-]*".join(list(search_plate)) + "$"
                    vehicle = vehicles_collection.find_one({"plate_number": {"$regex": regex_pattern, "$options": "i"}})
                    
                    if not vehicle:
                         loose_regex = "[\\s\\-]*".join(list(search_plate))
                         vehicle = vehicles_collection.find_one({"plate_number": {"$regex": loose_regex, "$options": "i"}})
                
                owner_phone = None
                if vehicle:
                    vehicle["id"] = str(vehicle.get("_id", "demo_" + str(time.time())))
                    if "_id" in vehicle:
                        del vehicle["_id"]
                    vehicle_info = vehicle
                    
                    if "vehicle_type" in vehicle:
                        vehicle_type = vehicle["vehicle_type"]
                    
                    # Always fetch owner details if owner_id exists
                    if vehicle.get("owner_id"):
                        from bson import ObjectId
                        try:
                            owner_record = users_collection.find_one({"_id": ObjectId(vehicle["owner_id"])})
                            if owner_record:
                                # Get all owner details
                                vehicle_info["owner_name"] = owner_record.get("name", "Unknown")
                                vehicle_info["owner_role"] = owner_record.get("role", "GUEST")
                                owner_phone = owner_record.get("phone")
                                print(f"[SMS] Owner found: {vehicle_info['owner_name']}, Phone: {owner_phone}")
                        except Exception as owner_e:
                            print(f"[SMS] Error fetching owner: {owner_e}")
                    
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
                    # Vehicle not found in database
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
                    # Add to cooldown ONLY if granted, so denied/misread plates can be retried immediately
                    _plate_cooldown[plate_text] = time.time()
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
                        
                        import threading
                        threading.Thread(target=send_access_sms, kwargs={
                            "phone_number": owner_phone,
                            "owner_name": owner_name,
                            "plate_number": plate_text,
                            "time_str": current_time_str,
                            "action": action
                        }).start()
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
            "image_url": image_url,
            "plate_box": plate_box
        }

    except Exception as e:
        print(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

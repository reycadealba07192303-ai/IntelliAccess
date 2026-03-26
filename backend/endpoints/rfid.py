from fastapi import APIRouter, HTTPException
from mongo_client import vehicles_collection, access_logs_collection, denied_logs_collection, log_notification
from utils.rfid import get_rfid_reader
from datetime import datetime
import time

router = APIRouter()

@router.post("/read")
def read_rfid_tag():
    """Read RFID tag and check if it matches a registered vehicle"""
    reader = get_rfid_reader()

    if not reader.connect():
        raise HTTPException(status_code=500, detail="RFID reader not available")

    try:
        # Wait for tag for 10 seconds
        tag_id = reader.wait_for_tag(timeout=10)

        if not tag_id:
            return {"status": "no_tag", "message": "No RFID tag detected"}

        # Check if tag exists in database
        vehicle = vehicles_collection.find_one({"rfid_tag": tag_id})

        if vehicle:
            # Log access granted
            log_entry = {
                "vehicle_id": str(vehicle["_id"]),
                "plate_number": vehicle.get("plate_number"),
                "rfid_tag": tag_id,
                "access_type": "rfid",
                "status": "granted",
                "timestamp": datetime.now(),
                "method": "RFID"
            }
            access_logs_collection.insert_one(log_entry)

            # Notify
            log_notification(f"RFID Access Granted: {vehicle.get('plate_number', 'Unknown')}")

            return {
                "status": "granted",
                "vehicle": {
                    "id": str(vehicle["_id"]),
                    "plate_number": vehicle.get("plate_number"),
                    "model": vehicle.get("model"),
                    "color": vehicle.get("color")
                }
            }
        else:
            # Log access denied
            log_entry = {
                "rfid_tag": tag_id,
                "access_type": "rfid",
                "status": "denied",
                "timestamp": datetime.now(),
                "reason": "Unknown RFID tag",
                "method": "RFID"
            }
            denied_logs_collection.insert_one(log_entry)

            # Notify
            log_notification(f"RFID Access Denied: Unknown tag {tag_id}")

            return {"status": "denied", "message": "Unknown RFID tag"}

    finally:
        reader.disconnect()

@router.post("/connect")
def connect_rfid_reader():
    """Connect to RFID reader"""
    reader = get_rfid_reader()
    if reader.connect():
        return {"status": "connected", "port": reader.port}
    else:
        raise HTTPException(status_code=500, detail="Failed to connect to RFID reader")

@router.post("/disconnect")
def disconnect_rfid_reader():
    """Disconnect from RFID reader"""
    reader = get_rfid_reader()
    reader.disconnect()
    return {"status": "disconnected"}
from fastapi import APIRouter, HTTPException
from mongo_client import vehicles_collection, access_logs_collection, denied_logs_collection, log_notification
from utils.rfid import get_rfid_reader, rfid_is_connected, latest_rfid_scan
from datetime import datetime
import time

router = APIRouter()

@router.get("/status")
def get_rfid_status():
    """Get the connection status of the RFID reader"""
    from utils.rfid import rfid_is_connected, rfid_polling_active
    return {
        "connected": rfid_is_connected,
        "polling": rfid_polling_active
    }

@router.get("/latest-scan")
def get_latest_rfid_scan():
    """Get the latest tag scanned by the background RFID loop"""
    from utils.rfid import latest_rfid_scan
    if latest_rfid_scan is None:
        return {"detected": False}
    return {
        "detected": True,
        **latest_rfid_scan
    }

@router.post("/read")
def read_rfid_tag():
    """Manual read trigger for RFID tag (used for registration/testing)"""
    reader = get_rfid_reader()

    # If it's already polling in background, we shouldn't open serial again
    # But for registration, we might want a clean read. 
    # Let's try to use the current connection if available.
    
    if not reader.serial or not reader.serial.is_open:
        if not reader.connect():
            raise HTTPException(status_code=500, detail="RFID reader not available")

    try:
        # Wait for tag for 5 seconds
        tag_id = reader.wait_for_tag(timeout=5)

        if not tag_id:
            return {"status": "no_tag", "message": "No RFID tag detected"}

        return {"status": "success", "tag_id": tag_id}

    finally:
        # We don't disconnect if background polling is supposed to stay active
        from utils.rfid import rfid_polling_active
        if not rfid_polling_active:
            reader.disconnect()

@router.post("/connect")
def connect_rfid_reader():
    """Manually connect to RFID reader"""
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
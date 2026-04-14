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
    """Manual read trigger for RFID tag (used for registration/testing).
    Uses the background polling thread's shared state to avoid serial port conflicts.
    """
    import utils.rfid as rfid_module

    # If background polling is active, wait for it to detect a NEW tag
    if rfid_module.rfid_polling_active:
        # Capture current tag to detect when a NEW one is scanned
        current = rfid_module.latest_rfid_scan
        old_tag = current.get("rfid_tag") if current else None

        # Poll shared state for up to 10 seconds
        start = time.time()
        while time.time() - start < 10:
            latest = rfid_module.latest_rfid_scan
            if latest:
                new_tag = latest.get("rfid_tag")
                if new_tag and new_tag != old_tag:
                    return {"status": "success", "tag_id": new_tag}
            time.sleep(0.2)

        return {"status": "no_tag", "message": "No RFID tag detected. Tap sticker on the reader and try again."}

    # Fallback: direct serial read if background polling is NOT active
    reader = get_rfid_reader()
    if not reader.serial or not reader.serial.is_open:
        if not reader.connect():
            raise HTTPException(status_code=500, detail="RFID reader not available")
    try:
        tag_id = reader.wait_for_tag(timeout=10)
        if not tag_id:
            return {"status": "no_tag", "message": "No RFID tag detected. Tap sticker on the reader and try again."}
        return {"status": "success", "tag_id": tag_id}
    finally:
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
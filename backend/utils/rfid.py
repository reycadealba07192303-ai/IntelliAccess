try:
    import serial
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False

import time
import threading
from typing import Optional
from datetime import datetime
from utils.access_utils import is_on_cooldown, set_cooldown, trigger_hardware_success, trigger_hardware_denied, trigger_hardware_restricted

# ─── Shared State (used by both Camera AI and RFID modules) ───────────────────
# This is the single source of truth for the last access event regardless of method
latest_rfid_scan = None          # Latest RFID scan result (mirrors latest_scan_result in stream.py)
rfid_is_connected = False         # Whether RFID reader is alive
rfid_last_tag = None              # Last raw tag string read
rfid_polling_active = False       # Whether background thread is running

LOG_COOLDOWN_SECONDS = 30         # Same cooldown as Camera module

class RFIDReader:
    def __init__(self, port: str = '/dev/serial0', baudrate: int = 115200):
        """
        Initialize RFID reader
        Args:
            port: Serial port (e.g., '/dev/serial0' or '/dev/ttyUSB0' on Pi)
            baudrate: Baud rate for serial communication
        """
        self.port = port
        self.baudrate = baudrate
        self.serial = None

    def connect(self) -> bool:
        """Connect to RFID reader"""
        global rfid_is_connected
        if not SERIAL_AVAILABLE:
            print("Serial module not available. Install pyserial to use RFID reader.")
            return False
        try:
            self.serial = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=1
            )
            rfid_is_connected = True
            print(f"[RFID] Reader connected on {self.port}")
            return True
        except Exception as e:
            rfid_is_connected = False
            print(f"[RFID] Failed to connect to RFID reader: {e}")
            return False

    def disconnect(self):
        """Disconnect from RFID reader"""
        global rfid_is_connected
        if self.serial and self.serial.is_open:
            self.serial.close()
            rfid_is_connected = False
            print("[RFID] Reader disconnected")

    # M5Stack UHF RFID inventory command (YRM100 protocol - single inventory)
    INVENTORY_CMD = bytes([0xBB, 0x00, 0x22, 0x00, 0x00, 0x22, 0x7E])

    def send_inventory_command(self):
        """Send a single-inventory command to the M5Stack UHF reader."""
        if self.serial and self.serial.is_open:
            try:
                # Clear buffer of stale data before sending new command
                self.serial.reset_input_buffer()
                self.serial.write(self.INVENTORY_CMD)
            except Exception as e:
                print(f"[RFID] Error sending inventory command: {e}")

    def read_tag(self) -> Optional[str]:
        """
        Send an inventory command and read the UHF tag EPC response.
        Returns the EPC tag ID as a hex string, or None if no tag detected.
        """
        if not self.serial or not self.serial.is_open:
            return None
        try:
            # Send scan command to M5Stack UHF reader
            self.send_inventory_command()
            time.sleep(0.15)  # wait for reader to respond

            if self.serial.in_waiting > 0:
                raw = self.serial.read(self.serial.in_waiting)
                
                # Robust frame parsing: Find the first 0xBB in the raw buffer
                # Then look for the next 0x7E or just trust the length field
                if b'\xBB' in raw:
                    idx = raw.find(b'\xBB')
                    frame = raw[idx:]
                    
                    # Split by 0x7E to handle multiple or trailing data
                    sub_frames = frame.split(b'\x7E')
                    for f in sub_frames:
                        if len(f) >= 9 and f[0] == 0xBB:
                            if len(f) > 2 and f[2] == 0x22:  # Inventory response
                                # PC bits at index 6,7
                                pc_high = f[6]
                                epc_words = (pc_high & 0xF8) >> 3
                                epc_bytes_len = epc_words * 2
                                
                                epc_start = 8
                                epc_end = epc_start + epc_bytes_len
                                
                                if len(f) >= epc_end:
                                    epc_bytes = f[epc_start:epc_end]
                                    tag_id = epc_bytes.hex().upper()
                                    # Strict validation: Only allow if it's high-quality hex and reasonable length
                                    if len(tag_id) >= 8 and all(c in '0123456789ABCDEF' for c in tag_id):
                                        return tag_id
                            else:
                                # Fallback: assume EPC starts at 7, stops 2 bytes from end (CRC)
                                if len(f) > 9:
                                    epc_bytes = f[7:-2]
                                    tag_id = epc_bytes.hex().upper()
                                    if len(tag_id) >= 8 and all(c in '0123456789ABCDEF' for c in tag_id):
                                        return tag_id

                # We removed the UTF-8 fallback to avoid garbage data (noise)
        except Exception as e:
            print(f"[RFID] Error reading tag: {e}")
        return None

    def wait_for_tag(self, timeout: int = 10) -> Optional[str]:
        """
        Wait for an RFID tag to be detected (blocking, for manual API calls).
        Args:
            timeout: Maximum time to wait in seconds
        Returns: Tag ID or None
        """
        start_time = time.time()
        while time.time() - start_time < timeout:
            tag = self.read_tag()
            if tag:
                return tag
            time.sleep(0.1)
        return None


def _process_rfid_tag(tag_id: str):
    """
    Called by the background polling loop when a tag is detected.
    Looks up vehicle in DB, logs access, and updates shared state.
    Same deduplication logic as camera module.
    """
    global latest_rfid_scan, rfid_last_tag

    # Import here to avoid circular imports
    try:
        from mongo_client import vehicles_collection, access_logs_collection, denied_logs_collection, users_collection, log_notification
        DB_AVAILABLE = True
    except ImportError:
        print("[RFID] Database not available. Cannot log RFID scan.")
        DB_AVAILABLE = False
        return

    # Import shared cooldown state from stream module for deduplication
    try:
        import endpoints.stream as stream_module
        last_logged_plate = stream_module.last_logged_plate
        last_logged_time = stream_module.last_logged_time
    except Exception:
        last_logged_plate = None
        last_logged_time = 0

    current_time = time.time()

    # Check cooldown using shared utility
    if is_on_cooldown(tag_id):
        return

    # Database lookup...
    if not DB_AVAILABLE:
        return

    try:
        # Look up vehicle by rfid_tag field (Case-insensitive and stripped)
        clean_tag = tag_id.strip()
        vehicle = vehicles_collection.find_one({
            "rfid_tag": {"$regex": f"^{clean_tag}$", "$options": "i"}
        })
    
        # [STRICT VALIDATION] If not registered, we ignore it to prevent noise
        # But we still log it once as "Denied" for security visibility if requested
        if not vehicle:
            print(f"[RFID] Unregistered tag detected: {tag_id}. Updating shared state for registration UI.")
            
            # Log as unregistered event
            log_data = {
                "plate_detected": "Unregistered RFID",
                "rfid_tag": tag_id,
                "action": "Attempt",
                "status": "DENIED",
                "gate": "Main Gate Entry",
                "method": "RFID",
                "timestamp": datetime.now().isoformat(),
                "image_url": None
            }
            denied_logs_collection.insert_one(log_data)
            
            # [FIX] Update shared state so registration UI can see this new tag
            latest_rfid_scan = {
                "timestamp": current_time,
                "plate_number": "Unregistered Tag",
                "rfid_tag": tag_id,
                "access_granted": False,
                "access_status": "DENIED (UNREGISTERED)",
                "vehicle_info": None,
                "method": "RFID"
            }
            return

        # If we reach here, the vehicle IS registered
        status = "Denied"
        vehicle_info = None
        owner_phone = None

        vehicle["id"] = str(vehicle["_id"])
        del vehicle["_id"]
        vehicle_info = vehicle

        v_status = vehicle.get("status", "").strip().upper()
        if v_status == "ACTIVE":
            status = "Authorized"
        elif v_status == "PENDING":
            status = "Denied (Pending)"
        elif v_status == "BLACKLISTED":
            status = "Denied (Blacklisted)"

        # Get owner phone for SMS
        if vehicle_info.get("owner_id"):
            try:
                from bson import ObjectId
                owner_doc = users_collection.find_one({"_id": ObjectId(vehicle_info["owner_id"])})
                if owner_doc:
                    owner_phone = owner_doc.get("phone")
                    if "owner_name" not in vehicle_info:
                        vehicle_info["owner_name"] = owner_doc.get("name", "Unknown")
            except Exception as ex:
                print(f"[RFID] Failed to lookup owner: {ex}")
                
        # Check Vehicle-ID based cooldown
        vehicle_id = vehicle["id"] 
        if is_on_cooldown(vehicle_id):
            print(f"[RFID] Ignoring {tag_id} - recently logged via ID {vehicle_id}")
            return

        # Check Entry/Exit
        action = "Entry"
        if vehicle_info:
            last_log = access_logs_collection.find_one(
                {"vehicle_id": vehicle_info.get("id")},
                sort=[("timestamp", -1)]
            )
            if last_log and last_log.get("action") == "Entry":
                last_log_time_str = last_log.get("timestamp")
                if last_log_time_str:
                    try:
                        last_time_obj = datetime.fromisoformat(last_log_time_str.replace("Z", "+00:00"))
                        time_diff = (datetime.now(last_time_obj.tzinfo) - last_time_obj).total_seconds()
                        if 60 < time_diff < 43200: # Between 1 minute and 12 hours -> natural Exit
                            action = "Exit"
                        elif time_diff >= 43200: # Greater than 12 hours -> Assumed to be new day Entry
                            action = "Entry"
                        else:
                            print(f"[RFID] Ignored. Vehicle recently entered ({time_diff:.1f}s ago).")
                            return
                    except Exception:
                        action = "Exit"

        # Save frame capture by grabbing the latest frame from the camera stream
        image_url = None
        try:
            import endpoints.stream as stream_module
            import cv2
            import os
            
            frame = stream_module.latest_frame_raw
            if frame is not None:
                # Use shared captures directory
                STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "captures")
                if not os.path.exists(STATIC_DIR):
                    os.makedirs(STATIC_DIR, exist_ok=True)
                
                filename = f"rfid_capture_{int(time.time())}.jpg"
                filepath = os.path.join(STATIC_DIR, filename)
                
                # Save the frame
                if cv2.imwrite(filepath, frame):
                    image_url = f"/static/captures/{filename}"
                    print(f"[RFID] Snapshot captured for tag {tag_id} at {image_url}")
            else:
                print("[RFID] No camera frame available for snapshot.")
        except Exception as cam_err:
            print(f"[RFID] Snapshot error: {cam_err}")

        # Log the event
        current_time_str = datetime.now().strftime("%I:%M %p")
        log_data = {
            "plate_detected": vehicle_info.get("plate_number", tag_id),
            "rfid_tag": tag_id,
            "action": action,
            "status": "GRANTED" if status == "Authorized" else "DENIED",
            "gate": "Main Gate Entry",
            "method": "RFID",
            "timestamp": datetime.now().isoformat(),
            "vehicle_id": vehicle_info.get("id"),
            "image_url": image_url
        }

        if status == "Authorized":
            result = access_logs_collection.insert_one(log_data)
        else:
            result = denied_logs_collection.insert_one(log_data)
        log_entry_id = str(result.inserted_id)

        # Update cooldowns
        set_cooldown(tag_id)
        set_cooldown(vehicle_info.get("id"))
        if vehicle_info.get("plate_number"):
            set_cooldown(vehicle_info["plate_number"])

        # Trigger Hardware
        if status == "Authorized":
            trigger_hardware_success()
        else:
            # For registered but denied, we use a distinct pattern (3 short beeps)
            trigger_hardware_restricted()

        # Send notification + SMS if authorized
        if status == "Authorized":
            log_notification(
                title=f"RFID {action}",
                message=f"Vehicle {vehicle_info.get('plate_number', tag_id)} {action.lower()}ed via RFID at {current_time_str}.",
                user_id=vehicle_info.get("owner_id"),
                type="alert"
            )
            if owner_phone:
                try:
                    from utils.sms import send_access_sms
                    print(f"[RFID] Triggering {action} SMS to {owner_phone} for vehicle {vehicle_info.get('plate_number')}")
                    send_access_sms(
                        phone_number=owner_phone,
                        owner_name=vehicle_info.get("owner_name", "Unknown"),
                        plate_number=vehicle_info.get("plate_number", tag_id),
                        time_str=current_time_str,
                        action=action
                    )
                except Exception as e:
                    print(f"[RFID] SMS error: {e}")
            else:
                print(f"[RFID] SMS skipped: No phone number found for owner of vehicle {vehicle_info.get('plate_number')}")

        print(f"[RFID] Logged Tag: {tag_id} | Vehicle: {vehicle_info.get('plate_number', 'Unknown')} | Status: {status}")

        # Update shared scan state (frontend polls /rfid/latest-scan)
        latest_rfid_scan = {
            "id": log_entry_id,
            "timestamp": current_time,
            "plate_number": vehicle_info.get("plate_number", tag_id),
            "rfid_tag": tag_id,
            "access_granted": status == "Authorized",
            "access_status": "GRANTED" if status == "Authorized" else status.upper(),
            "vehicle_info": vehicle_info,
            "image_url": None,
            "method": "RFID"
        }

    except Exception as e:
        print(f"[RFID] Error processing tag: {e}")


def _background_polling_loop(reader: 'RFIDReader'):
    """
    Runs in a background thread. Continuously polls the RFID reader
    for new tags and processes them automatically.
    """
    global rfid_polling_active
    print("[RFID] Background polling started.")
    while rfid_polling_active:
        try:
            tag = reader.read_tag()
            if tag:
                print(f"[RFID] Tag detected: {tag}")
                _process_rfid_tag(tag)
        except Exception as e:
            print(f"[RFID] Polling error: {e}")
        time.sleep(0.2)  # poll every 200ms
    print("[RFID] Background polling stopped.")


def start_rfid_background_polling():
    """
    Attempts to connect the RFID reader and starts the background polling thread.
    Called once at backend startup.
    """
    global rfid_polling_active
    reader = get_rfid_reader()
    if reader.connect():
        rfid_polling_active = True
        t = threading.Thread(target=_background_polling_loop, args=(reader,), daemon=True)
        t.start()
        print("[RFID] Background polling thread launched.")
    else:
        print("[RFID] Could not start background polling (reader not connected).")


# Global RFID reader instance
rfid_reader = RFIDReader()

def get_rfid_reader() -> RFIDReader:
    """Get the global RFID reader instance"""
    return rfid_reader
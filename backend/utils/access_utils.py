import time
import threading

# Shared state for access cooldowns to prevent double-logging (Camera + RFID)
# Keys can be Plate Numbers or Vehicle IDs
access_cooldowns = {}
cooldown_lock = threading.Lock()

LOG_COOLDOWN_SECONDS = 60

def is_on_cooldown(identifier: str) -> bool:
    """Check if a plate or vehicle ID is currently on cooldown."""
    if not identifier:
        return False
    
    with cooldown_lock:
        current_time = time.time()
        if identifier in access_cooldowns:
            last_time = access_cooldowns[identifier]
            if (current_time - last_time) < LOG_COOLDOWN_SECONDS:
                return True
        return False

def set_cooldown(identifier: str):
    """Mark a plate or vehicle ID as just logged."""
    if not identifier:
        return
    
    with cooldown_lock:
        access_cooldowns[identifier] = time.time()

def trigger_hardware_success():
    """Trigger the buzzer and Green LED for authorized access."""
    try:
        from utils.buzzer import buzz_granted
        from utils.led_utils import led_granted
        buzz_granted()
        led_granted()
    except Exception as e:
        print(f"[HARDWARE] Error triggering success hardware: {e}")

def trigger_hardware_denied():
    """Trigger the buzzer and Blue LED for denied access."""
    try:
        from utils.buzzer import buzz_denied
        from utils.led_utils import led_denied
        buzz_denied()
        led_denied()
    except Exception as e:
        print(f"[HARDWARE] Error triggering denied hardware: {e}")

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
    """Trigger the buzzer/relay for authorized access."""
    try:
        from endpoints.stream import buzz_granted
        buzz_granted()
    except Exception as e:
        print(f"[HARDWARE] Error triggering success buzz: {e}")

def trigger_hardware_denied():
    """Trigger the buzzer for denied access."""
    try:
        from endpoints.stream import buzz_denied
        buzz_denied()
    except Exception as e:
        print(f"[HARDWARE] Error triggering denied buzz: {e}")

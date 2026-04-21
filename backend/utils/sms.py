import os
import requests
import threading
import time
from mongo_client import log_notification

# Cooldown to prevent spamming the same number (in seconds)
_sms_cooldowns = {}
SMS_COOLDOWN_LIMIT = 45 # 45 seconds between messages to same number

# Use the API Key previously provided by the user
SMS_API_PH_KEY = os.getenv("SMS_API_PH_KEY", "sk-2b10vkgzpm562uaxjjjyh6yaenufhlvl")

def _send_sms_thread(phone_number: str, message: str, owner_name: str = "Owner"):
    """
    Internal function to send the SMS using SMS API PH synchronously.
    Intended to be run in a separate thread so it doesn't block the video stream.
    """
    if not phone_number or len(phone_number) < 10:
        print(f"[SMS WARNING] Invalid or missing phone number: '{phone_number}'")
        return

    # [COOLDOWN CHECK] Prevent spamming
    current_time = time.time()
    if phone_number in _sms_cooldowns:
        elapsed = current_time - _sms_cooldowns[phone_number]
        if elapsed < SMS_COOLDOWN_LIMIT:
            print(f"[SMS COOLDOWN] SMS to {phone_number} skipped. Only {elapsed:.1f}s elapsed.")
            return
            
    _sms_cooldowns[phone_number] = current_time

    # Ensure it's in the +639... format as per documentation
    cleaned_phone = phone_number.replace(" ", "").replace("-", "").replace("+", "")
    
    if cleaned_phone.startswith("09") and len(cleaned_phone) == 11:
        cleaned_phone = "+63" + cleaned_phone[1:]
    elif cleaned_phone.startswith("9") and len(cleaned_phone) == 10:
        cleaned_phone = "+63" + cleaned_phone
    elif cleaned_phone.startswith("639") and len(cleaned_phone) == 12:
        cleaned_phone = "+" + cleaned_phone
         
    url = "https://smsapiph.onrender.com/api/v1/send/sms"
    
    headers = {
        "x-api-key": SMS_API_PH_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "recipient": cleaned_phone,
        "message": message
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=12)
        if response.status_code == 200 or response.status_code == 201:
            print(f"[SMS SUCCESS] SMS sent to {owner_name} ({cleaned_phone})")
        elif response.status_code == 429:
            print(f"[SMS RATE-LIMIT] API rejected message to {cleaned_phone}: Too Many Requests.")
            log_notification(
                title="SMS Rate Limit Reached",
                message=f"Could not send SMS to {owner_name} due to API traffic limits. Please wait 20s between scans.",
                type="alert"
            )
        else:
            error_msg = f"Failed to send SMS to {owner_name} ({cleaned_phone}). Status: {response.status_code}, Response: {response.text}"
            print(f"[SMS ERROR] {error_msg}")
            log_notification(
                title="SMS Delivery Failed",
                message=f"SMS error for {owner_name}: {response.text}",
                type="alert"
            )
    except Exception as e:
        error_msg = f"SMS API error for {cleaned_phone}: {e}"
        print(f"[SMS EXCEPTION] {error_msg}")
        log_notification(
            title="SMS System Error",
            message=f"Network error while sending SMS to {owner_name}.",
            type="alert"
        )

def send_access_sms(phone_number: str, owner_name: str, plate_number: str, time_str: str, action: str):
    """
    Fires off SMS sending in a background thread for Vehicle Entry or Exit.
    """
    action_str = "entered" if action.lower() == "entry" else "exited"
        
    message = f"IntelliAccess: Vehicle {plate_number} {action_str} the campus at {time_str}. If not you, contact Security."
    
    # Start a new thread so the main video stream isn't stalled by network requests
    thread = threading.Thread(target=_send_sms_thread, args=(phone_number, message, owner_name))
    thread.daemon = True
    thread.start()

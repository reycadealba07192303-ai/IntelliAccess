import os
import requests
import threading

# Use the API Key previously provided by the user
SMS_API_PH_KEY = os.getenv("SMS_API_PH_KEY", "sk-2b10etxbzawur9btl08miuxyohnsnexu")

def _send_sms_thread(phone_number: str, message: str):
    """
    Internal function to send the SMS using SMS API PH synchronously.
    Intended to be run in a separate thread so it doesn't block the video stream.
    """
    if not phone_number or len(phone_number) < 10:
        print(f"[SMS WARNING] Invalid or missing phone number: '{phone_number}'")
        return

    # Ensure it's in the +639 format which the API usually prefers based on the docs payload example
    cleaned_phone = phone_number.replace(" ", "").replace("-", "")
    if cleaned_phone.startswith("09") and len(cleaned_phone) == 11:
        cleaned_phone = "+63" + cleaned_phone[1:]
    elif cleaned_phone.startswith("9") and len(cleaned_phone) == 10:
         cleaned_phone = "+63" + cleaned_phone
         
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
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code == 200 or response.status_code == 201:
            print(f"[SMS SUCCESS] SMS API PH sent to {cleaned_phone}")
        else:
            print(f"[SMS ERROR] Failed to send to {cleaned_phone}. Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print(f"[SMS EXCEPTION] SMS API PH could not send SMS to {cleaned_phone}: {e}")

def send_access_sms(phone_number: str, owner_name: str, plate_number: str, time_str: str, action: str):
    """
    Fires off SMS sending in a background thread for Vehicle Entry or Exit.
    """
    action_str = action.lower() + "ed" # entry -> entryed (we'll fix below)
    if action.lower() == "entry":
        action_str = "entered"
        
    message = f"IntelliAccess: Vehicle {plate_number} {action_str} the campus at {time_str}. If not you, remove this vehicle in your Dashboard."
    
    # Start a new thread so the main video stream isn't stalled by network requests
    thread = threading.Thread(target=_send_sms_thread, args=(phone_number, message))
    thread.daemon = True
    thread.start()

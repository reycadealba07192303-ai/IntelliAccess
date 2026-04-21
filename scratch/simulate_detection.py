import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Ensure we can import from backend
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from mongo_client import users_collection, vehicles_collection
from utils.sms import send_access_sms
from utils.email_utils import send_access_email

load_dotenv()

def simulate_scan():
    print("\n--- IntelliAccess: Detection Simulation ---")
    
    # Target your specific email for the sample
    target_email = "intelliaccessssu@gmail.com"
    target_phone = "09948097112" # Based on your previous screenshots
    
    # Simulation Data
    owner_name = "Reyca De Alba"
    plate_number = "REYC-2026"
    current_time_str = datetime.now().strftime("%I:%M %p")
    action = "Entry"

    print(f"Simulating {action} for {owner_name}...")
    print(f"Target Email: {target_email}")
    print(f"Target Phone: {target_phone}")
    print(f"Plate: {plate_number}")

    # 1. Trigger SMS
    print("\n[STEP 1] Triggering SMS simulation...")
    send_access_sms(
        phone_number=target_phone,
        owner_name=owner_name,
        plate_number=plate_number,
        time_str=current_time_str,
        action=action
    )

    # 2. Trigger Email (The Sample you want to see)
    print("[STEP 2] Triggering Email simulation (Sample)...")
    send_access_email(
        recipient_email=target_email,
        owner_name=owner_name,
        plate_number=plate_number,
        time_str=current_time_str,
        action=action
    )

    print("\n[DONE] Both notifications have been fired in the background.")
    print("Waiting 5 seconds for background threads to finish...")
    import time
    time.sleep(5)
    print("Check your Gmail now!")

if __name__ == "__main__":
    simulate_scan()

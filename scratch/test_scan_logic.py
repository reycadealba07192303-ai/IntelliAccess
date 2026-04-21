import os
import sys
import time
from datetime import datetime
from dotenv import load_dotenv
from bson import ObjectId

# Ensure we can import from backend
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from mongo_client import users_collection, vehicles_collection, access_logs_collection
from utils.sms import send_access_sms
from utils.email_utils import send_access_email

load_dotenv()

def diagnostic_scan(plate_to_test):
    print(f"\n--- Diagnostic Scan Logic Check for: {plate_to_test} ---")
    
    # 1. Fetch Vehicle
    print(f"[1/4] Looking up vehicle '{plate_to_test}' in DB...")
    vehicle = vehicles_collection.find_one({"plate_number": plate_to_test})
    
    if not vehicle:
        print(f"[FAIL] Vehicle '{plate_to_test}' not found in database.")
        return

    print(f"[SUCCESS] Vehicle found. Status: {vehicle.get('status')}")
    
    # 2. Fetch Owner
    owner_id = vehicle.get("owner_id")
    print(f"[2/4] Owner ID found: {owner_id}. Looking up user...")
    
    if not owner_id:
        print("[FAIL] This vehicle has NO owner_id assigned.")
        return

    # Convert to ObjectId for lookup
    owner_doc = users_collection.find_one({"_id": ObjectId(owner_id) if isinstance(owner_id, str) else owner_id})
    
    if not owner_doc:
        print(f"[FAIL] User with ID {owner_id} not found in users collection.")
        return

    owner_name = owner_doc.get("name", "Unknown")
    owner_phone = owner_doc.get("phone")
    owner_email = owner_doc.get("email")
    print(f"[SUCCESS] Owner: {owner_name} | Email: {owner_email} | Phone: {owner_phone}")

    # 3. Decision Logic (Mirror of stream.py)
    print(f"\n[3/4] Simulation Decision Logic:")
    status = "Authorized" if vehicle.get("status") == "Active" else "Denied"
    current_time_str = datetime.now().strftime("%I:%M %p")
    
    if status == "Authorized":
        print(f" -> Access would be GRANTED.")
        print(f" -> Should trigger SMS to: {owner_phone}")
        print(f" -> Should trigger Email to: {owner_email}")
    else:
        print(f" -> Access would be DENIED. No notifications would be sent.")
        return

    # 4. Final Trigger Test
    print(f"\n[4/4] Final Dispatch Test (Actually sending NOW)...")
    if owner_phone:
        send_access_sms(owner_phone, owner_name, plate_to_test, current_time_str, "Entry")
    if owner_email:
        send_access_email(owner_email, owner_name, plate_to_test, current_time_str, "Entry")

    print("\n--- Diagnostic Finished ---")
    print("If you see [SUCCESS] above but didn't get an email, check your .env file on the Pi.")

if __name__ == "__main__":
    test_plate = "123VBC"
    diagnostic_scan(test_plate)

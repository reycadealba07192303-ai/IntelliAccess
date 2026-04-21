import os
import sys
from bson import ObjectId
from dotenv import load_dotenv

# Ensure we can import from backend
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from mongo_client import users_collection, vehicles_collection

load_dotenv()

def reassign_vehicle():
    print("\n--- Reassigning Vehicle 123VBC ---")
    
    # 1. Get the target user
    target_email = "intelliaccessssu@gmail.com"
    user = users_collection.find_one({"email": target_email})
    
    if not user:
        print(f"[FAIL] Target user {target_email} not found.")
        return
    
    user_id_str = str(user["_id"])
    
    # 2. Update the vehicle
    # We update both the owner_id and the owner_name for consistency
    result = vehicles_collection.update_one(
        {"plate_number": "123VBC"},
        {"$set": {
            "owner_id": user_id_str,
            "owner_name": user.get("name", "IntelliAccess"),
            "status": "Active" # Make sure it's active
        }}
    )
    
    if result.matched_count > 0:
        print(f"[SUCCESS] Vehicle 123VBC has been reassigned to {user_id_str} ({target_email}).")
        print("Now, any scan for 123VBC will trigger notifications to your Gmail.")
    else:
        print("[FAIL] Vehicle 123VBC not found in database.")

if __name__ == "__main__":
    reassign_vehicle()

import os
import sys
from bson import ObjectId
from dotenv import load_dotenv

# Ensure we can import from backend
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from mongo_client import users_collection, vehicles_collection

load_dotenv()

def reassign_test_vehicles():
    print("\n--- Final Vehicle Reassignment (123BBC & 123VBC) ---")
    
    # 1. Get the target user (IntelliAccess admin)
    target_email = "intelliaccessssu@gmail.com"
    user = users_collection.find_one({"email": target_email})
    
    if not user:
        print(f"[FAIL] Target user {target_email} not found.")
        return
    
    user_id_str = str(user["_id"])
    user_name = user.get("name", "IntelliAccess")
    
    # 2. Re-assign both versions of the test plate
    plates_to_move = ["123BBC", "123VBC"]
    
    for plate in plates_to_move:
        # We update both the owner_id and the owner_name for consistency
        result = vehicles_collection.update_many(
            {"plate_number": plate},
            {"$set": {
                "owner_id": user_id_str, # Store as string ID since that's what backend expects
                "owner_name": user_name,
                "status": "Active" 
            }}
        )
        print(f"[INFO] Plate {plate}: Matched {result.matched_count}, Modified {result.modified_count}")

    print(f"\n[SUCCESS] Vehicles reassigned to {user_name} ({target_email}).")
    print("Now, any scan for these plates will trigger notifications to YOUR Gmail.")

if __name__ == "__main__":
    reassign_test_vehicles()

import os
import sys
from bson import ObjectId
from dotenv import load_dotenv

# Ensure we can import from backend
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from mongo_client import users_collection, vehicles_collection, access_logs_collection

load_dotenv()

def audit_database():
    print("\n--- IntelliAccess: Database Relationship Audit ---")
    
    # 2. Check for ALL vehicles
    print("\n--- ALL REGISTERED VEHICLES ---")
    all_v = list(vehicles_collection.find({}))
    if not all_v:
        print("[FAIL] No vehicles found in database.")
    else:
        for v in all_v:
            o_id = v.get("owner_id")
            owner_name = "MISSING OWNER"
            if o_id:
                o_doc = users_collection.find_one({"_id": ObjectId(o_id) if isinstance(o_id, str) else o_id})
                owner_name = o_doc.get("name") if o_doc else "OWNER NOT FOUND IN USERS"
            
            print(f" - Plate: {v.get('plate_number')} | RFID: {v.get('rfid_tag')} | Owner: {owner_name} ({o_id})")

    # 3. Check for recent logs for these vehicles
    print("\nChecking recent access logs...")
    v_ids = [str(v["_id"]) for v in all_vehicles]
    recent_logs = list(access_logs_collection.find({"vehicle_id": {"$in": v_ids}}).sort("timestamp", -1).limit(5))
    
    if not recent_logs:
        print("[INFO] No recent access logs found for these vehicles.")
    else:
        for log in recent_logs:
            print(f" - {log.get('timestamp')} | {log.get('plate_detected')} | {log.get('action')}")

    print("\n--- Audit Complete ---")

if __name__ == "__main__":
    audit_database()

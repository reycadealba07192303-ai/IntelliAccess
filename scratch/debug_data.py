from mongo_client import users_collection, vehicles_collection
import json

def debug_data():
    print("--- Users ---")
    users = list(users_collection.find({}, {"name": 1, "phone": 1, "role": 1}))
    for u in users:
        u["id"] = str(u["_id"])
        del u["_id"]
    print(json.dumps(users, indent=2))
    
    print("\n--- Vehicles ---")
    vehicles = list(vehicles_collection.find({}, {"plate_number": 1, "owner_id": 1, "status": 1}))
    for v in vehicles:
        v["id"] = str(v["_id"])
        del v["_id"]
    print(json.dumps(vehicles, indent=2))

if __name__ == "__main__":
    debug_data()

from backend.mongo_client import users_collection, vehicles_collection, access_logs_collection

print("--- NEW USERS ---")
for u in users_collection.find().sort('_id', -1).limit(2):
    print(f"Name: {u.get('name')}, Phone: {u.get('phone')}, ID: {u['_id']}")

print("\n--- NEW VEHICLES ---")
for v in vehicles_collection.find().sort('_id', -1).limit(2):
    print(f"Plate: {v.get('plate_number')}, Owner: {v.get('owner_id')}")

print("\n--- NEW LOGS ---")
for l in access_logs_collection.find().sort('_id', -1).limit(10):
    print(f"Plate: {l.get('plate_detected')}, Status: {l.get('status')}, Action: {l.get('action')}, Time: {l.get('timestamp')}")

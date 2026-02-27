import sys
sys.path.append('.')
from backend.mongo_client import vehicles_collection

print("--- ALL VEHICLES ---")
for v in vehicles_collection.find():
    print(f"Plate: {v.get('plate_number')} | Status: {v.get('status')} | ID: {v.get('_id')}")
print("--------------------")

from mongo_client import vehicles_collection
vehicles_collection.update_one(
    {"plate_number": "KA 02 MN 1826"},
    {"$set": {"plate_number": "KA 02 MN 1826", "status": "ACTIVE", "make": "Demo Video", "model": "AI Scan", "color": "White"}},
    upsert=True
)
print("Demo plate injected successfully.")

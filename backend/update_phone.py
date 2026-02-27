from backend.mongo_client import users_collection

result = users_collection.update_many(
    {"name": "Reyca Dela Cruz De Alba"},
    {"$set": {"phone": "+639948097112"}}
)
print(f"Updated {result.modified_count} users to use the new phone number.")

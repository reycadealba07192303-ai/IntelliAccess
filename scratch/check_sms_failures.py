from mongo_client import notifications_collection
import json

def check_failed_sms():
    query = {"title": {"$regex": "SMS", "$options": "i"}}
    failed = list(notifications_collection.find(query).sort("created_at", -1).limit(10))
    for f in failed:
        f["_id"] = str(f["_id"])
    print(json.dumps(failed, indent=2))

if __name__ == "__main__":
    check_failed_sms()

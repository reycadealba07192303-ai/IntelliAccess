from mongo_client import notifications_collection
import json

def check_all_notifs():
    notifs = list(notifications_collection.find().sort("created_at", -1).limit(20))
    for n in notifs:
        n["_id"] = str(n["_id"])
    print(json.dumps(notifs, indent=2))

if __name__ == "__main__":
    check_all_notifs()

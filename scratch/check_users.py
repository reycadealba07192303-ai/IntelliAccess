from mongo_client import users_collection
import json
from bson import ObjectId

def check_users():
    users = list(users_collection.find({}, {"name": 1, "phone": 1, "role": 1}))
    for u in users:
        u["_id"] = str(u["_id"])
    print(json.dumps(users, indent=2))

if __name__ == "__main__":
    check_users()

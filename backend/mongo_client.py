import os
import json
import uuid
import threading
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

LOCAL_DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "local_db")
if not os.path.exists(LOCAL_DB_DIR):
    os.makedirs(LOCAL_DB_DIR, exist_ok=True)

class MockObjectId:
    def __init__(self, val=None):
        self._val = val if val else uuid.uuid4().hex
    def __str__(self):
        return self._val
    def __repr__(self):
        return f"ObjectId('{self._val}')"
    def __eq__(self, other):
        if isinstance(other, MockObjectId):
            return self._val == other._val
        return str(self) == str(other)

# Patch bson.ObjectId so existing code doesn't crash when it imports it
try:
    import bson
    bson.ObjectId = MockObjectId
except ImportError:
    class MockBsonModule:
        ObjectId = MockObjectId
    import sys
    sys.modules['bson'] = MockBsonModule()

class InsertOneResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id

class LocalCollection:
    def __init__(self, name):
        self.name = name
        self.filepath = os.path.join(LOCAL_DB_DIR, f"{name}.json")
        self.lock = threading.Lock()
        if not os.path.exists(self.filepath):
            self._write_data([])

    def _read_data(self):
        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _write_data(self, data):
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def _match(self, item, query):
        import re
        for k, v in query.items():
            item_val = item.get(k, "")
            if isinstance(v, dict):
                # Handle {$regex: "...", $options: "..."}
                if "$regex" in v:
                    pattern = v["$regex"]
                    flags = 0
                    if v.get("$options") == "i":
                        flags = re.IGNORECASE
                    try:
                        if not re.search(pattern, str(item_val), flags):
                            return False
                    except re.error:
                        return False
            else:
                if str(item_val) != str(v):
                    return False
        return True

    def find(self, query=None):
        with self.lock:
            data = self._read_data()
            if query is None or query == {}:
                return data
            return [item for item in data if self._match(item, query)]

    def find_one(self, query, sort=None):
        with self.lock:
            data = self._read_data()
            
            # Simple simulation of sort, specifically for timestamp
            if sort and isinstance(sort, list) and len(sort) > 0:
                sort_key, sort_dir = sort[0]
                data.sort(key=lambda x: x.get(sort_key, ""), reverse=(sort_dir == -1))
                
            for item in data:
                if self._match(item, query):
                    return item
            return None

    def insert_one(self, doc):
        with self.lock:
            data = self._read_data()
            if "_id" not in doc:
                doc["_id"] = str(MockObjectId())
            else:
                doc["_id"] = str(doc["_id"])
            data.append(doc)
            self._write_data(data)
            return InsertOneResult(doc["_id"])

    def update_one(self, query, update):
        with self.lock:
            data = self._read_data()
            for item in data:
                if self._match(item, query):
                    if "$set" in update:
                        for k, v in update["$set"].items():
                            item[k] = v
                    else:
                        for k, v in update.items():
                            item[k] = v
                    self._write_data(data)
                    return True
            return False

    def delete_one(self, query):
        with self.lock:
            data = self._read_data()
            initial_len = len(data)
            data = [item for item in data if not self._match(item, query)]
            if len(data) < initial_len:
                self._write_data(data)
                return True
            return False

    def count_documents(self, query=None):
        return len(self.find(query))

users_collection = LocalCollection("users")
vehicles_collection = LocalCollection("vehicles")
access_logs_collection = LocalCollection("access_logs")
denied_logs_collection = LocalCollection("denied_logs")
notifications_collection = LocalCollection("notifications")
cameras_collection = LocalCollection("cameras")

def log_notification(title: str, message: str, user_id: str = None, type: str = "system"):
    try:
        doc = {
            "title": title,
            "message": message,
            "user_id": user_id,
            "type": type,
            "read": False,
            "created_at": datetime.utcnow().isoformat()
        }
        notifications_collection.insert_one(doc)
    except Exception as e:
        print(f"Failed to log notification: {e}")

print("✅ MongoDB successfully bypassed! Local JSON mock client initialized securely at ./local_db/")

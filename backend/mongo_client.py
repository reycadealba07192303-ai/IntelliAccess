import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
client = MongoClient(MONGODB_URI)

# Use a database named 'intelliaccess'
db = client['intelliaccess']

# Define collection references
users_collection = db['users']
vehicles_collection = db['vehicles']
access_logs_collection = db['access_logs']
notifications_collection = db['notifications']
cameras_collection = db['cameras']
from datetime import datetime

def log_notification(title: str, message: str, user_id: str = None, type: str = "system"):
    """
    Helper function to insert a notification into the global timeline.
    If user_id is provided, it's specific to that user. 
    If user_id is None, it's a global system/admin notification.
    Type can be: 'system', 'user', 'alert', 'update'
    """
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

print("MongoDB client initialized.")

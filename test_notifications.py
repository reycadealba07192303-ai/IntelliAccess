import sys
sys.path.append('.')
from backend.mongo_client import notifications_collection

for n in notifications_collection.find().sort('_id', -1).limit(6):
    print(f"Title: {n.get('title')}, UserID: {n.get('user_id')}, Read: {n.get('read')}")

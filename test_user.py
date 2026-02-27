import sys
sys.path.append('.')
from backend.mongo_client import users_collection
from bson import ObjectId

user = users_collection.find_one({'_id': ObjectId('699f9eddf5000a92e5edb1c5')})
print(f"User Name: {user.get('name') if user else 'Not found'}")

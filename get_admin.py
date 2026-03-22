import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
MONGODB_URI = os.getenv("MONGODB_URI")
client = MongoClient(MONGODB_URI)
db = client['intelliaccess']
users_collection = db['users']

admin = users_collection.find_one({"role": "ADMIN"})
if admin:
    print(f"Email: {admin.get('email')}")
    print(f"Password: {admin.get('password')}")
else:
    print("No admin user found.")

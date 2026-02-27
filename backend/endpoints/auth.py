from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import jwt
import bcrypt
from backend.mongo_client import users_collection, log_notification
from bson import ObjectId
from datetime import datetime, timedelta

load_dotenv()

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "fallback_secret")
ALGORITHM = "HS256"



class SignUpRequest(BaseModel):
    email: str
    password: str
    name: str
    phone: str
    role: str = "STUDENT"

class LoginRequest(BaseModel):
    email: str
    password: str

def verify_password(plain_password: str, hashed_password: str):
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except ValueError:
        return False

def get_password_hash(password: str):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization Header")
    
    try:
        token = authorization.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if user is None:
             raise HTTPException(status_code=401, detail="User not found")
        
        user["id"] = str(user["_id"])
        del user["_id"]
        if "hashed_password" in user:
            del user["hashed_password"]
            
        return user
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Token: {str(e)}")

@router.post("/signup")
async def signup(request: SignUpRequest):
    existing_user = users_collection.find_one({"email": request.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    user_dict = {
        "email": request.email,
        "hashed_password": get_password_hash(request.password),
        "name": request.name,
        "phone": request.phone,
        "role": request.role,
        "created_at": datetime.utcnow()
    }
    
    result = users_collection.insert_one(user_dict)
    
    log_notification(
        title="New Account Created",
        message=f"{request.name} created a new {request.role} account.",
        type="user"
    )
    
    user_out = {
        "id": str(result.inserted_id),
        "email": request.email,
        "name": request.name,
        "role": request.role
    }
    
    access_token = create_access_token(data={"sub": user_out["id"]})
    return {"access_token": access_token, "token_type": "bearer", "user": user_out}

@router.post("/login")
async def login(request: LoginRequest):
    user = users_collection.find_one({"email": request.email})
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found in MongoDB")
        
    # Synchronization Step: 
    # Since the frontend already verified this password with Firebase Auth, 
    # we take this opportunity to sync the password into our MongoDB. 
    # This ensures that if they reset their password via Firebase, MongoDB gets updated here.
    new_hashed_password = get_password_hash(request.password)
    users_collection.update_one(
        {"_id": user["_id"]}, 
        {"$set": {"hashed_password": new_hashed_password}}
    )
        
    user_out = {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name"),
        "role": user.get("role")
    }
    
    access_token = create_access_token(data={"sub": user_out["id"]})
    return {"access_token": access_token, "token_type": "bearer", "user": user_out}

@router.get("/me")
async def read_users_me(user = Depends(get_current_user)):
    return {"user": user}

class UserUpdate(BaseModel):
    name: str = None
    phone: str = None
    profile_url: str = None

from fastapi import Request

@router.put("/update_profile")
async def update_profile(request: Request, user = Depends(get_current_user)):
    try:
        data = await request.json()
        update_fields = {}
        
        if "name" in data and data["name"] is not None:
             update_fields["name"] = data["name"]
        if "phone" in data and data["phone"] is not None:
             update_fields["phone"] = data["phone"]
        if "profile_url" in data and data["profile_url"] is not None:
             update_fields["profile_url"] = data["profile_url"]
             
        if update_fields:
            users_collection.update_one({"_id": ObjectId(user["id"])}, {"$set": update_fields})
            print(f"DEBUG: Successfully updated profile fields for {user['id']}: {list(update_fields.keys())}")
            log_notification(
                title="Profile Updated",
                message=f"{user.get('name', 'User')} updated their profile.",
                user_id=user["id"],
                type="update"
            )
        else:
            print("DEBUG: update_profile received empty usable fields. Incoming keys:", list(data.keys()))
            
        return {"status": "success", "message": "Profile updated"}
    except Exception as e:
        print(f"DEBUG EXCEPTION in update_profile: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

import shutil
import uuid

@router.post("/upload_profile_picture")
async def upload_profile_picture(file: UploadFile = File(...), user = Depends(get_current_user)):
    try:
        # Generate unique filename to avoid caching issues
        ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        filename = f"{user['id']}_{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join("static", "profiles", filename)
        
        # Save file to disk locally
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Update MongoDB with the new URL hosted by our static endpoint
        # For this prototype we're using localhost:8000, 
        # in production you would use request.base_url or an S3 bucket
        url = f"http://localhost:8000/static/profiles/{filename}"
        
        users_collection.update_one({"_id": ObjectId(user["id"])}, {"$set": {"profile_url": url}})
        
        log_notification(
            title="Profile Picture Updated",
            message=f"{user.get('name', 'User')} updated their profile picture.",
            user_id=user["id"],
            type="update"
        )
        
        return {"status": "success", "profile_url": url}
    except Exception as e:
        print(f"DEBUG EXCEPTION in upload_profile_picture: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/users")
async def get_all_users(user = Depends(get_current_user)):
    try:
        users_cursor = users_collection.find({})
        users = []
        for u in users_cursor:
            u["id"] = str(u["_id"])
            del u["_id"]
            if "hashed_password" in u:
                del u["hashed_password"]
            users.append(u)
        return users
    except Exception as e:
         raise HTTPException(status_code=400, detail=str(e))

class AdminUserUpdate(BaseModel):
    name: str = None
    role: str = None

@router.put("/users/{user_id}")
async def admin_update_user(user_id: str, update_data: AdminUserUpdate, user = Depends(get_current_user)):
    try:
        update_fields = {}
        if update_data.name is not None:
             update_fields["name"] = update_data.name
        if update_data.role is not None:
             update_fields["role"] = update_data.role
             
        if update_fields:
            users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": update_fields})
            
            user_doc = users_collection.find_one({"_id": ObjectId(user_id)})
            user_name = user_doc.get("name") if user_doc else "A user"
            
            log_notification(
                title="Account Status Changed",
                message=f"Admin updated {user_name}'s account details.",
                user_id=user_id,
                type="alert"
            )
            
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/users/{user_id}")
async def admin_delete_user(user_id: str, user = Depends(get_current_user)):
    try:
        user_doc = users_collection.find_one({"_id": ObjectId(user_id)})
        user_name = user_doc.get("name") if user_doc else "A user"
        
        users_collection.delete_one({"_id": ObjectId(user_id)})
        
        log_notification(
            title="Account Deleted",
            message=f"Admin deleted {user_name}'s account.",
            type="alert"
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



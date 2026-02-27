from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import pymongo
from .auth import get_current_user
from backend.mongo_client import notifications_collection

router = APIRouter()

@router.get("/")
async def get_all_notifications(limit: int = 20, offset: int = 0, target_user_id: Optional[str] = None, user = Depends(get_current_user)):
    """Admin route to get all system notifications"""
    try:
        # Check if admin (optional depending on how strict we want to be)
        if user.get("role", "").lower() != "admin":
            raise HTTPException(status_code=403, detail="Not authorized")
            
        query = {}
        if target_user_id:
            query["user_id"] = target_user_id
            
        cursor = notifications_collection.find(query).sort("created_at", pymongo.DESCENDING).skip(offset).limit(limit)
        notifications = []
        from bson import ObjectId
        from backend.mongo_client import users_collection
        
        for n in cursor:
            n["id"] = str(n["_id"])
            del n["_id"]
            
            # Fetch user profile picture if user_id exists
            if n.get("user_id"):
                try:
                    notif_user = users_collection.find_one({"_id": ObjectId(n["user_id"])})
                    if notif_user:
                        n["profile_url"] = notif_user.get("profile_url")
                except Exception as e:
                    print(f"DEBUG: Invalid user_id ObjectId {n.get('user_id')}: {e}")
                    
            notifications.append(n)
        return notifications
    except Exception as e:
         print(f"DEBUG EXCEPTION get_all_notifications: {str(e)}")
         raise HTTPException(status_code=400, detail=str(e))

@router.get("/me")
async def get_my_notifications(limit: int = 20, offset: int = 0, user = Depends(get_current_user)):
    """User route to get personal and system notifications"""
    try:
        # Get notifications specific to this user only
        query = {
            "user_id": user["id"]
        }
        cursor = notifications_collection.find(query).sort("created_at", pymongo.DESCENDING).skip(offset).limit(limit)
        notifications = []
        from bson import ObjectId
        from backend.mongo_client import users_collection
        
        for n in cursor:
            n["id"] = str(n["_id"])
            del n["_id"]
            
            # Fetch user profile picture if user_id exists
            if n.get("user_id"):
                try:
                    notif_user = users_collection.find_one({"_id": ObjectId(n["user_id"])})
                    if notif_user:
                        n["profile_url"] = notif_user.get("profile_url")
                except Exception as e:
                    print(f"DEBUG: Invalid user_id ObjectId {n.get('user_id')} in get_my_notifications: {e}")
                    
            notifications.append(n)
        return notifications
    except Exception as e:
         print(f"DEBUG EXCEPTION get_my_notifications: {str(e)}")
         raise HTTPException(status_code=400, detail=str(e))

@router.put("/mark-all-read")
async def mark_all_read(user = Depends(get_current_user)):
    try:
        query = {
            "user_id": user["id"]
        }
        notifications_collection.update_many(query, {"$set": {"read": True}})
        return {"status": "success"}
    except Exception as e:
         print(f"DEBUG EXCEPTION mark_all_read: {str(e)}")
         raise HTTPException(status_code=400, detail=str(e))

@router.put("/{notification_id}/read")
async def mark_notification_read(notification_id: str, user = Depends(get_current_user)):
    try:
        from bson import ObjectId
        # Set read to true
        notifications_collection.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"read": True}}
        )
        return {"status": "success"}
    except Exception as e:
         raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, user = Depends(get_current_user)):
    try:
        from bson import ObjectId
        notifications_collection.delete_one({"_id": ObjectId(notification_id)})
        return {"status": "success"}
    except Exception as e:
        print(f"DEBUG EXCEPTION delete_notification: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from .auth import get_current_user
from backend.mongo_client import cameras_collection
from pydantic import BaseModel
from bson import ObjectId

class CameraModel(BaseModel):
    name: str
    location: str
    url: str
    status: Optional[str] = "Offline"

router = APIRouter()

@router.get("/")
async def get_all_cameras(user = Depends(get_current_user)):
    """Get all camera feeds configured in the system"""
    try:
        cursor = cameras_collection.find().sort("id", 1)
        cameras = []
        for c in cursor:
            c["_id"] = str(c["_id"])
            cameras.append(c)
            
        # If no cameras exist, initialize the default one since it's hardcoded currently
        if len(cameras) == 0:
            default_camera = {
                "id": 1,
                "name": "Main Gate Entry",
                "status": "Live",
                "location": "Entrance A",
                "url": "https://images.unsplash.com/photo-1563630423918-b58f07336ac9?q=80&w=800&auto=format&fit=crop"
            }
            inserted = cameras_collection.insert_one(default_camera)
            default_camera["_id"] = str(inserted.inserted_id)
            cameras.append(default_camera)
            
        return cameras
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/")
async def add_camera(camera: CameraModel, user = Depends(get_current_user)):
    try:
        # Determine the next int ID (although MongoDB uses _id, the frontend currently expects 'id')
        highest_cam = cameras_collection.find_one(sort=[("id", -1)])
        next_id = 1
        if highest_cam and "id" in highest_cam:
            next_id = highest_cam["id"] + 1

        new_camera = {
            "id": next_id,
            "name": camera.name,
            "location": camera.location,
            "url": camera.url,
            "status": camera.status
        }
        
        result = cameras_collection.insert_one(new_camera)
        new_camera["_id"] = str(result.inserted_id)
        return new_camera
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{camera_id}")
async def delete_camera(camera_id: str, user = Depends(get_current_user)):
    try:
        result = cameras_collection.delete_one({"_id": ObjectId(camera_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Camera not found")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

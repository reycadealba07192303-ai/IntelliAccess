from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from .auth import get_current_user
from backend.mongo_client import vehicles_collection, log_notification

router = APIRouter()

class VehicleCreate(BaseModel):
    plate_number: str
    rfid_tag: Optional[str] = None
    model: str
    color: Optional[str] = None
    body_type: Optional[str] = None
    owner_id: Optional[str] = None

@router.post("/")
async def create_vehicle(vehicle: VehicleCreate, user = Depends(get_current_user)):
    try:
        vehicle_dict = vehicle.dict(exclude_unset=True)
        vehicle_dict["status"] = "Active"
        
        # Assign owner_id from the authenticated user
        if user and "id" in user:
            vehicle_dict["owner_id"] = user["id"]
            
        result = vehicles_collection.insert_one(vehicle_dict)
        vehicle_dict["id"] = str(result.inserted_id)
        
        user_name = user.get("name") if user else "Admin"
        owner_id = vehicle_dict.get("owner_id")
        
        if owner_id and user and owner_id != user.get("id"):
             msg = f"A new vehicle {vehicle.model} ({vehicle.plate_number}) was registered for you by Admin ({user_name})."
        else:
             msg = f"You successfully registered a new vehicle {vehicle.model} ({vehicle.plate_number})."
             
        log_notification(
            title="Vehicle Registered",
            message=msg,
            user_id=owner_id,
            type="user"
        )
        
        del vehicle_dict["_id"]
        return [vehicle_dict]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/verify")
async def verify_vehicle(plate_number: str):
    try:
        vehicle = vehicles_collection.find_one({"plate_number": plate_number})
        if vehicle:
            vehicle["id"] = str(vehicle["_id"])
            del vehicle["_id"]
            return {"status": "authorized", "vehicle": vehicle}
        else:
            return {"status": "unauthorized"}
    except Exception as e:
         return {"status": "error", "message": str(e)}

@router.get("/")
async def get_vehicles(user = Depends(get_current_user)):
    try:
        user_id = user.get("id") if user else None
        role = user.get("role", "").upper() if user else ""
        
        # Admins can see all vehicles; otherwise, users see only their own.
        if role == "ADMIN":
            query = {}
        else:
            query = {"owner_id": user_id} if user_id else {}
            
        vehicles_cursor = vehicles_collection.find(query)
        vehicles = []
        from bson import ObjectId
        from backend.mongo_client import users_collection
        
        for v in vehicles_cursor:
            v["id"] = str(v["_id"])
            del v["_id"]
            
            # Hydrate owner information
            if v.get("owner_id"):
                try:
                    owner_doc = users_collection.find_one({"_id": ObjectId(v["owner_id"])})
                    if owner_doc:
                        v["owner"] = {
                            "full_name": owner_doc.get("name", "Unknown"),
                            "role": owner_doc.get("role", "GUEST")
                        }
                except:
                    pass
            
            vehicles.append(v)
        return vehicles
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

from bson import ObjectId

class VehicleUpdate(BaseModel):
    status: Optional[str] = None
    plate_number: Optional[str] = None
    model: Optional[str] = None
    color: Optional[str] = None

@router.put("/{vehicle_id}")
async def update_vehicle(vehicle_id: str, vehicle_update: VehicleUpdate, user = Depends(get_current_user)):
    try:
        from bson import ObjectId
        vehicle_doc = vehicles_collection.find_one({"_id": ObjectId(vehicle_id)})
        plate = vehicle_doc.get("plate_number") if vehicle_doc else "Unknown"
        owner_id = vehicle_doc.get("owner_id") if vehicle_doc else None
        
        update_fields = vehicle_update.dict(exclude_unset=True)
        if update_fields:
            vehicles_collection.update_one(
                {"_id": ObjectId(vehicle_id)}, 
                {"$set": update_fields}
            )
        
        user_name = user.get("name") if user else "Admin"
        if owner_id and owner_id != user.get("id"):
             msg = f"Your vehicle {plate} was updated by Admin ({user_name})."
        else:
             msg = f"You updated your vehicle {plate}."
             
        log_notification(
            title="Vehicle Updated",
            message=msg,
            user_id=owner_id,
            type="update"
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, user = Depends(get_current_user)):
    try:
        from bson import ObjectId
        vehicle_doc = vehicles_collection.find_one({"_id": ObjectId(vehicle_id)})
        plate = vehicle_doc.get("plate_number") if vehicle_doc else "Unknown"
        owner_id = vehicle_doc.get("owner_id") if vehicle_doc else None
        
        vehicles_collection.delete_one({"_id": ObjectId(vehicle_id)})
        
        user_name = user.get("name") if user else "Admin"
        if owner_id and owner_id != user.get("id"):
             msg = f"Your vehicle {plate} was deleted by Admin ({user_name})."
        else:
             msg = f"You deleted your vehicle {plate}."
             
        log_notification(
            title="Vehicle Deleted",
            message=msg,
            user_id=owner_id,
            type="alert"
        )
        return {"status": "success"}
    except Exception as e:
         raise HTTPException(status_code=400, detail=str(e))


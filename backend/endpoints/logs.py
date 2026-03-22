from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .auth import get_current_user
from mongo_client import access_logs_collection, vehicles_collection, users_collection, log_notification
import pymongo
from bson import ObjectId

router = APIRouter()

class AccessLogCreate(BaseModel):
    vehicle_id: Optional[str] = None
    plate_detected: str
    action: str
    status: str
    gate: str

@router.post("")
def create_log(log: AccessLogCreate):
    try:
        log_data = log.dict()
        log_data["timestamp"] = datetime.utcnow().isoformat()
        result = access_logs_collection.insert_one(log_data)
        log_data["id"] = str(result.inserted_id)
        if "_id" in log_data:
            del log_data["_id"]
            
        # Add to Recent Activity if vehicle exists
        if log.vehicle_id:
            vehicle = vehicles_collection.find_one({"_id": ObjectId(log.vehicle_id)})
            if vehicle and vehicle.get("owner_id"):
                time_str = datetime.utcnow().strftime("%I:%M %p")
                action_str = log.action.lower() + "ed" # e.g., entered, exited
                if log.action.lower() == "entry":
                    action_str = "entered"

                log_notification(
                    title=f"Vehicle {log.action}",
                    message=f"Your vehicle {log.plate_detected} {action_str} the university manually at {time_str}.",
                    user_id=vehicle["owner_id"],
                    type="alert"
                )
                
        return [log_data]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("")
def get_logs(limit: int = 10, offset: int = 0, owner_id: Optional[str] = None, user = Depends(get_current_user)):
    try:
        from bson import ObjectId
        from mongo_client import vehicles_collection, users_collection, denied_logs_collection
        import pymongo
        
        query = {}
        if owner_id:
            user_vehicles = list(vehicles_collection.find({"owner_id": owner_id}, {"_id": 1, "plate_number": 1}))
            vehicle_ids = [str(v["_id"]) for v in user_vehicles]
            plates = [v.get("plate_number") for v in user_vehicles if v.get("plate_number")]
            
            if vehicle_ids or plates:
                query = {
                    "$or": [
                        {"vehicle_id": {"$in": vehicle_ids}},
                        {"plate_detected": {"$in": plates}}
                    ]
                }
            else:
                query = {"_id": "none"}
        
        # Fetch from BOTH access_logs (granted) and denied_logs (denied)
        granted_cursor = access_logs_collection.find(query).sort("timestamp", pymongo.DESCENDING).limit(limit * 2)
        denied_cursor = denied_logs_collection.find(query if not owner_id else {}).sort("timestamp", pymongo.DESCENDING).limit(limit * 2)
        
        all_logs = []
        
        # Process granted logs
        for l in granted_cursor:
            l["id"] = str(l["_id"])
            del l["_id"]
            l["created_at"] = l.get("timestamp")
            
            if l.get("vehicle_id"):
                v = vehicles_collection.find_one({"_id": ObjectId(l["vehicle_id"])})
                if v:
                    v_info = {"model": v.get("model", "Unknown")}
                    if v.get("owner_id"):
                        try:
                            u = users_collection.find_one({"_id": ObjectId(v["owner_id"])})
                            if u:
                                v_info["owner"] = {
                                    "full_name": u.get("name", "Unknown"),
                                    "role": u.get("role", "GUEST")
                                }
                        except:
                            pass
                    l["vehicle"] = v_info
            all_logs.append(l)
        
        # Process denied logs
        for l in denied_cursor:
            l["id"] = str(l["_id"])
            del l["_id"]
            l["created_at"] = l.get("timestamp")
            
            # Try to enrich denied logs with vehicle info if available
            if l.get("vehicle_id"):
                try:
                    v = vehicles_collection.find_one({"_id": ObjectId(l["vehicle_id"])})
                    if v:
                        v_info = {"model": v.get("model", "Unknown")}
                        if v.get("owner_id"):
                            try:
                                u = users_collection.find_one({"_id": ObjectId(v["owner_id"])})
                                if u:
                                    v_info["owner"] = {
                                        "full_name": u.get("name", "Unknown"),
                                        "role": u.get("role", "GUEST")
                                    }
                            except:
                                pass
                        l["vehicle"] = v_info
                except:
                    pass
            all_logs.append(l)
        
        # Sort all merged logs by timestamp descending and apply limit/offset
        all_logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return all_logs[offset:offset + limit]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/me")
def get_my_logs(limit: int = 10, offset: int = 0, user = Depends(get_current_user)):
    try:
        from bson import ObjectId
        from mongo_client import vehicles_collection
        
        my_vehicles_cursor = vehicles_collection.find({"owner_id": user["id"]})
        my_v_ids = [str(v["_id"]) for v in my_vehicles_cursor]
        
        cursor = access_logs_collection.find({"vehicle_id": {"$in": my_v_ids}}).sort("timestamp", pymongo.DESCENDING).skip(offset).limit(limit)
        logs = []
        for l in cursor:
            l["id"] = str(l["_id"])
            del l["_id"]
            l["created_at"] = l.get("timestamp")
            logs.append(l)
        return logs
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

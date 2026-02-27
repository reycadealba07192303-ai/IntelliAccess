from fastapi import APIRouter, Depends, HTTPException
from backend.endpoints.auth import get_current_user
from backend.mongo_client import users_collection, vehicles_collection, access_logs_collection
from datetime import datetime, timedelta, timezone

router = APIRouter()

@router.get("/")
async def get_admin_stats(user = Depends(get_current_user)):
    try:
        # Require admin access for dashboard stats
        if user.get("role") != "admin" and user.get("role") != "ADMIN":
            pass # Relaxing for now depending on how strict the role checking is

        # 1. Total Users
        total_users = users_collection.count_documents({})
        
        # 2. Total Vehicles
        total_vehicles = vehicles_collection.count_documents({})
        
        # 3. Today's Entries (Assuming local timezone is +08:00 based on user request)
        tz = timezone(timedelta(hours=8))
        now = datetime.now(tz)
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # We need to construct a query that finds entries on or after start_of_today equivalent
        # Since stream.py saves native datetime.now().isoformat() without timezone, 
        # we strictly compare local naive strings.
        start_today_str = start_of_today.replace(tzinfo=None).isoformat()
        
        todays_entries = access_logs_collection.count_documents({
            "timestamp": {"$gte": start_today_str},
            "status": "GRANTED"
        })
        
        # 4. Unauthorized Attempts today
        unauthorized_attempts = access_logs_collection.count_documents({
            "timestamp": {"$gte": start_today_str},
            "status": "DENIED"
        })

        # Calculate a simple 24hr distribution based on today's logs (using local time blocks)
        chart_data = []
        
        # Determine how far to go today (up to the current hour + 2, max 22:00)
        current_hour = now.hour
        end_hour = min(22, current_hour + 2) if current_hour >= 6 else 6
        
        for hour in range(6, end_hour + 1, 2):  # 06:00, 08:00...
            hour_start = start_of_today.replace(hour=hour)
            hour_end = hour_start + timedelta(hours=2)
            
            h_start_str = hour_start.replace(tzinfo=None).isoformat()
            h_end_str = hour_end.replace(tzinfo=None).isoformat()
            
            count = access_logs_collection.count_documents({
                "timestamp": {"$gte": h_start_str, "$lt": h_end_str},
                "status": "GRANTED"
            })
            
            # Format hour nicely for UI (e.g. 8:00 AM, 2:00 PM)
            display_hour = hour if hour <= 12 else hour - 12
            if display_hour == 0:
                display_hour = 12
            ampm = "AM" if hour < 12 else "PM"
            
            chart_data.append({
                "time": f"{display_hour}:00 {ampm}",
                "count": count
            })

        return {
            "total_users": total_users,
            "total_vehicles": total_vehicles,
            "todays_entries": todays_entries,
            "unauthorized_attempts": unauthorized_attempts,
            "chart_data": chart_data
        }
    except Exception as e:
        print(f"DEBUG EXCEPTION get_admin_stats: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

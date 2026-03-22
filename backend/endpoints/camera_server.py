"""
Backend Camera Server Integration
Handles continuous camera scanning on the server side
Allows admin remote access from any device
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
import threading
import cv2
import time
from datetime import datetime
import os
import json

router = APIRouter()

# Global camera manager
class CameraManager:
    def __init__(self):
        self.cameras = {}  # camera_id -> camera config
        self.scanning_threads = {}  # camera_id -> thread
        self.latest_results = {}  # camera_id -> latest detection
        self.is_running = False
        self.lock = threading.Lock()
    
    def add_camera(self, camera_id: str, source: int | str):
        """Add a camera source (0 for webcam, or RTSP URL)"""
        with self.lock:
            self.cameras[camera_id] = {
                "id": camera_id,
                "source": source,
                "active": False,
                "frame_count": 0,
                "last_detection": None,
                "is_streaming": False
            }
    
    def start_scanning(self, camera_id: str):
        """Start continuous scanning for a camera"""
        if camera_id not in self.cameras:
            raise ValueError(f"Camera {camera_id} not found")
        
        with self.lock:
            if self.cameras[camera_id]["active"]:
                return  # Already running
            
            self.cameras[camera_id]["active"] = True
        
        # Start scanning thread
        thread = threading.Thread(
            target=self._scan_camera_loop,
            args=(camera_id,),
            daemon=True
        )
        thread.start()
        self.scanning_threads[camera_id] = thread
    
    def stop_scanning(self, camera_id: str):
        """Stop scanning for a camera"""
        with self.lock:
            if camera_id in self.cameras:
                self.cameras[camera_id]["active"] = False
    
    def _scan_camera_loop(self, camera_id: str):
        """Continuous scanning loop for a camera"""
        from detection import detect_vehicle
        
        cap = None
        try:
            source = self.cameras[camera_id]["source"]
            cap = cv2.VideoCapture(source)
            
            if not cap.isOpened():
                print(f"[ERROR] Could not open camera {camera_id} from source {source}")
                return
            
            print(f"[CAMERA] Opened {camera_id} - scanning started")
            
            while self.cameras[camera_id]["active"]:
                ret, frame = cap.read()
                
                if not ret:
                    print(f"[WARNING] Failed to read from {camera_id}, reconnecting...")
                    cap.release()
                    time.sleep(2)
                    cap = cv2.VideoCapture(source)
                    continue
                
                # Resize for faster processing
                frame = cv2.resize(frame, (640, 480))
                
                # Run detection every 30 frames (throttle)
                if self.cameras[camera_id]["frame_count"] % 30 == 0:
                    try:
                        # Encode frame to JPEG
                        _, jpg_buffer = cv2.imencode('.jpg', frame)
                        jpg_bytes = jpg_buffer.tobytes()
                        
                        # Create file-like object
                        from io import BytesIO
                        file_obj = BytesIO(jpg_bytes)
                        
                        # Mock UploadFile for detection
                        class MockFile:
                            async def read(self):
                                return jpg_bytes
                        
                        # Run detection (you'll need to adapt this call)
                        # For now, just save latest frame
                        self.latest_results[camera_id] = {
                            "timestamp": datetime.now().isoformat(),
                            "frame_id": self.cameras[camera_id]["frame_count"],
                            "status": "scanning"
                        }
                        
                    except Exception as e:
                        print(f"[ERROR] Detection failed for {camera_id}: {e}")
                
                self.cameras[camera_id]["frame_count"] += 1
                time.sleep(0.03)  # ~33 FPS
        
        except Exception as e:
            print(f"[ERROR] Camera loop error for {camera_id}: {e}")
        
        finally:
            if cap:
                cap.release()
            print(f"[CAMERA] Closed {camera_id}")

# Global instance
camera_manager = CameraManager()

# Initialize with local camera
try:
    camera_manager.add_camera("local_device", 0)
    print("[CAMERA] Local device camera registered")
except Exception as e:
    print(f"[WARNING] Could not initialize local camera: {e}")

# ==================== ENDPOINTS ====================

@router.get("/cameras/available")
async def get_available_cameras():
    """Get list of available cameras"""
    with camera_manager.lock:
        cameras_list = []
        for cam_id, cam_config in camera_manager.cameras.items():
            cameras_list.append({
                "id": cam_id,
                "source": str(cam_config["source"]),
                "active": cam_config["active"],
                "frame_count": cam_config["frame_count"],
                "last_detection": cam_config["last_detection"]
            })
    
    return {
        "status": "success",
        "cameras": cameras_list,
        "count": len(cameras_list)
    }

@router.post("/cameras/{camera_id}/start")
async def start_camera_scanning(camera_id: str):
    """Start scanning for a specific camera"""
    try:
        camera_manager.start_scanning(camera_id)
        return {
            "status": "success",
            "message": f"Scanning started for {camera_id}",
            "camera_id": camera_id
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/cameras/{camera_id}/stop")
async def stop_camera_scanning(camera_id: str):
    """Stop scanning for a specific camera"""
    camera_manager.stop_scanning(camera_id)
    return {
        "status": "success",
        "message": f"Scanning stopped for {camera_id}",
        "camera_id": camera_id
    }

@router.get("/cameras/{camera_id}/latest-result")
async def get_latest_detection(camera_id: str):
    """Get latest detection result for a camera"""
    if camera_id not in camera_manager.cameras:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    
    result = camera_manager.latest_results.get(camera_id, {
        "status": "no_detection_yet",
        "message": "Waiting for first detection..."
    })
    
    return {
        "status": "success",
        "camera_id": camera_id,
        "result": result
    }

@router.get("/cameras/{camera_id}/status")
async def get_camera_status(camera_id: str):
    """Get current status of a camera"""
    if camera_id not in camera_manager.cameras:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    
    with camera_manager.lock:
        cam = camera_manager.cameras[camera_id]
        return {
            "status": "success",
            "camera_id": camera_id,
            "active": cam["active"],
            "frame_count": cam["frame_count"],
            "last_detection": cam["last_detection"],
            "scanning": cam["active"]
        }

@router.post("/cameras/add")
async def add_new_camera(camera_id: str, source: str | int):
    """Add a new camera to the backend"""
    try:
        # Convert source to int if it's a number (webcam index)
        try:
            source = int(source)
        except (ValueError, TypeError):
            # It's an RTSP URL or file path
            pass
        
        camera_manager.add_camera(camera_id, source)
        return {
            "status": "success",
            "message": f"Camera {camera_id} added",
            "camera_id": camera_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/cameras/clear")
async def clear_all_cameras():
    """Clear all cameras (for testing)"""
    with camera_manager.lock:
        camera_manager.cameras.clear()
        camera_manager.latest_results.clear()
    
    return {"status": "success", "message": "All cameras cleared"}

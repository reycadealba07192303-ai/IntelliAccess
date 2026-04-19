from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os
import sys
import os
# Add the current directory to sys.path locally
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from endpoints import auth, vehicles, logs, notifications, stats, cameras, stream, detection, camera_server

try:
    from endpoints import rfid
    RFID_AVAILABLE = True
except Exception as e:
    print(f"Warning: RFID module not available: {e}")
    RFID_AVAILABLE = False

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class LimitUploadSize(BaseHTTPMiddleware):
    def __init__(self, app, max_upload_size: int) -> None:
        super().__init__(app)
        self.max_upload_size = max_upload_size

    async def dispatch(self, request: Request, call_next):
        if request.method == 'PUT' or request.method == 'POST':
            if request.headers.get('content-length'):
                content_length = int(request.headers.get('content-length'))
                if content_length > self.max_upload_size:
                    raise HTTPException(status_code=413, detail="Payload too large")
        return await call_next(request)

app.add_middleware(LimitUploadSize, max_upload_size=50_000_000) # 50MB

# Ensure required directories exist (Absolute Path)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(os.path.join(STATIC_DIR, "profiles"), exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "captures"), exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(vehicles.router, prefix="/vehicles", tags=["Vehicles"])
app.include_router(logs.router, prefix="/logs", tags=["Access Logs"])
app.include_router(stream.router, tags=["Camera Stream"])
app.include_router(detection.router, tags=["AI Detection"])
app.include_router(camera_server.router, prefix="/camera-server", tags=["Backend Cameras"])
app.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
app.include_router(stats.router, prefix="/stats", tags=["Statistics"])
app.include_router(cameras.router, prefix="/cameras", tags=["Cameras"])

@app.on_event("startup")
async def startup_event():
    """Initializes hardware background workers when the server starts."""
    # Start Camera AI detection automatically on boot
    try:
        stream.ensure_camera_started()
        print("[CAMERA] Auto-start sequence triggered.")
    except Exception as e:
        print(f"Error auto-starting camera: {e}")

    if RFID_AVAILABLE:
        try:
            from utils.rfid import start_rfid_background_polling
            start_rfid_background_polling()
        except Exception as e:
            print(f"Error starting RFID polling: {e}")

if RFID_AVAILABLE:
    app.include_router(rfid.router, prefix="/rfid", tags=["RFID"])

@app.get("/")
def read_root():
    return {"message": "IntelliAccess Backend is running!"}

# Trigger reload

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000)

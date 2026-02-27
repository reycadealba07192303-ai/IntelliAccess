from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os
from backend.endpoints import auth, vehicles, logs, notifications, stats, cameras, stream

load_dotenv()

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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

os.makedirs("static/profiles", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(vehicles.router, prefix="/vehicles", tags=["Vehicles"])
app.include_router(logs.router, prefix="/logs", tags=["Access Logs"])
app.include_router(stream.router, tags=["Camera Stream"])
# app.include_router(detection.router, tags=["AI Detection"])
app.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
app.include_router(stats.router, prefix="/stats", tags=["Statistics"])
app.include_router(cameras.router, prefix="/cameras", tags=["Cameras"])

@app.get("/")
def read_root():
    return {"message": "IntelliAccess Backend is running!"}

# Trigger reload

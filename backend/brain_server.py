from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import cv2
import numpy as np
import os
import sys

# Ensure local imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from endpoints import detection

load_dotenv()

app = FastAPI(title="IntelliAccess AI Brain Server")

# Enable CORS for the web UI and Raspberry Pi
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the heavy AI detection router (will use YOLO/EasyOCR on x86)
app.include_router(detection.router, tags=["AI Brain"])

@app.get("/")
def read_root():
    return {
        "status": "online",
        "mode": "AI Brain Engine",
        "features": ["YOLOv8", "EasyOCR"],
        "device": "Laptop/PC"
    }

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*50)
    print("🧠 INTELLIACCESS AI BRAIN SERVER STARTING...")
    print("="*50)
    print("Target: High-Accuracy Plate Scanning (YOLO + EasyOCR)")
    print("Host: Localhost (Port 8001)")
    print("="*50 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8001)

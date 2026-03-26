import cv2
import numpy as np
import easyocr
from ultralytics import YOLO

try:
    from picamera import PiCamera
    PICAMERA_AVAILABLE = True
except:
    PICAMERA_AVAILABLE = False

print("Loading YOLO...")
model = YOLO("yolov8n.pt")
print("YOLO loaded.")

print("Loading OCR...")
reader = easyocr.Reader(['en'], gpu=False)
print("OCR loaded.")

print("Opening Camera...")
if PICAMERA_AVAILABLE:
    cap = PiCamera()
    cap.resolution = (640, 480)
    cap.start_preview()
    print("PiCamera opened successfully.")
    frame = np.empty((480, 640, 3), dtype=np.uint8)
    try:
        cap.capture(frame, format='bgr')
        ret = True
        print(f"Captured a frame of shape {frame.shape}")
    except Exception as e:
        print(f"Failed to capture frame: {e}")
        ret = False
else:
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Camera failed to open.")
        ret = False
    else:
        print("Camera opened successfully.")
        ret, frame = cap.read()
        if ret:
            print(f"Read a frame of shape {frame.shape}")
        else:
            print("Failed to read frame.")

if ret:
    results = model(frame, verbose=False)
    print("YOLO ran successfully on the frame.")

if hasattr(cap, 'release'):
    cap.release()
elif hasattr(cap, 'stop_preview'):
    cap.stop_preview()
    cap.close()

print("Test Complete.")

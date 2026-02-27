import cv2
import easyocr
from ultralytics import YOLO

print("Loading YOLO...")
model = YOLO("yolov8n.pt")
print("YOLO loaded.")

print("Loading OCR...")
reader = easyocr.Reader(['en'], gpu=False)
print("OCR loaded.")

print("Opening Camera...")
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Camera failed to open.")
else:
    print("Camera opened successfully.")
    ret, frame = cap.read()
    if ret:
        print(f"Read a frame of shape {frame.shape}")
        results = model(frame, verbose=False)
        print("YOLO ran successfully on the frame.")
    else:
         print("Failed to read frame.")
cap.release()
print("Test Complete.")

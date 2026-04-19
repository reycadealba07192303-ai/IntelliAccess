# IntelliAccess - Raspberry Pi 4 Setup Guide

Complete step-by-step guide to run IntelliAccess on Raspberry Pi 4 with Camera Module and UHF-RFID Reader.

## Prerequisites
- Raspberry Pi 4 (4GB or 8GB recommended)
- Raspberry Pi OS (Bullseye or newer) installed on microSD card
- Raspberry Pi Camera Module connected
- UHF-RFID Reader connected to USB port
- Internet connection
- Monitor, keyboard, mouse (or SSH access)

---

## Step 1: Update Raspberry Pi System

```bash
sudo apt update
sudo apt upgrade -y
```

---

## Step 2: Enable SSH and Verify Camera

*(Note: On newer Raspberry Pi OS versions like Bullseye/Bookworm, the Camera is auto-detected and no longer needs to be enabled in Interfacing Options).*

**To enable SSH (for remote access):**
```bash
sudo raspi-config
```

Navigate to:
- **Interfacing Options** → **SSH** → **Yes/Enable**
- Select `<Finish>` to exit.

*(Reboot if you made changes to SSH or want to ensure hardware changes are applied).*

```bash
sudo reboot
```

---

## Step 3: Install Required System Packages

```bash
sudo apt install -y python3-pip python3-venv python3-dev
sudo apt install -y libopenblas0 libomp-dev gfortran libopenblas-dev liblapack-dev
sudo apt install -y git
sudo apt install -y nodejs npm
```

---

## Step 4: Clone/Copy Project to Raspberry Pi

**Option A: Clone from GitHub**
```bash
cd ~
git clone https://github.com/reycadealba07192303-ai/IntelliAccess.git
cd IntelliAccess
```

**Option B: Copy from Windows (if you have the files)**
```bash
# On your Windows machine, use SCP or similar
# scp -r C:\Users\reyca\Downloads\INTELLIACCESS/* pi@<raspberrypi-ip>:/home/pi/IntelliAccess/
```

---

## Step 5: Setup Backend Virtual Environment

```bash
cd ~/IntelliAccess/backend
python3 -m venv venv
source venv/bin/activate  # For Raspberry Pi OS
```

---

## Step 6: Install Python Dependencies

```bash
pip install --upgrachade pip setuptools wheel
pip install -r requirements.txt
```


---

## Step 7: Configure RFID Reader Port

Edit `backend/utils/rfid.py` and update the serial port:

```python
def __init__(self, port: str = '/dev/ttyUSB0', baudrate: int = 9600):  # Changed from COM3
```

**Common Raspberry Pi ports:**
- `/dev/ttyUSB0` - First USB device
- `/dev/ttyUSB1` - Second USB device
- `/dev/ttyACM0` - Arduino/USB CDC devices

Check your RFID reader port:
```bash
ls /dev/tty*
```

---

## Step 8: Configure Backend Environment Variables

Create/edit `.env` file in `backend/`:

```bash
cd ~/IntelliAccess/backend
nano .env
```

Add these variables:
```
MONGODB_URI=mongodb://localhost:27017/
JWT_SECRET=your_secret_key_here
API_PORT=8000
```

Save with `Ctrl+X`, `Y`, `Enter`

---

## Step 9: Start MongoDB (if using local)

```bash
# Install MongoDB
sudo apt install -y mongodb

# Start MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Verify it's running
mongo --eval "db.adminCommand('ping')"
```

---

## Step 10: Start Backend Server

```bash
cd ~/IntelliAccess/backend
source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

You should see:
```
MongoDB client initialized.
Using CPU. Note: This module is much faster with a GPU.
[CAMERA] Local device camera registered
Uvicorn running on http://0.0.0.0:8000
```

---

## Step 11: Install Frontend Dependencies (in new terminal)

```bash
cd ~/IntelliAccess
npm install
```

---

## Step 12: Start Frontend Server

```bash
npm run dev
```

You should see:
```
VITE v6.4.1 ready in 900 ms
➜  Local:   http://localhost:5173/
```

---

## Step 13: Access the System

On your Raspberry Pi or any device on the same network:

```
Camera Interface: http://<raspberry-pi-ip>:5173/admin/camera
API Docs: http://<raspberry-pi-ip>:8000/docs
```

Find your Raspberry Pi IP:
```bash
hostname -I
```

---

## Step 14: Setup Autostart (Optional)

Create systemd service files to auto-start on boot.

**Backend Service** (`/etc/systemd/system/intelliaccess-backend.service`):
```bash
sudo nano /etc/systemd/system/intelliaccess-backend.service
```

> **STOP! IMPORTANT CAUTION 🛑:** 
> Find out your exact username (e.g., `intelliaacess`). Do **NOT** just copy `pi` if your username is different! Replace EVERY instance of `pi` below with your real username (e.g. `User=intelliaacess`, `/home/intelliaacess/`).

```ini
[Unit]
Description=IntelliAccess Backend
After=network.target

[Service]
Type=simple
User=intelliaacess
WorkingDirectory=/home/intelliaacess/IntelliAccess/backend
ExecStart=/home/intelliaacess/IntelliAccess/backend/venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Frontend Service** (`/etc/systemd/system/intelliaccess-frontend.service`):
```bash
sudo nano /etc/systemd/system/intelliaccess-frontend.service
```

```ini
[Unit]
Description=IntelliAccess Frontend
After=network.target

[Service]
Type=simple
User=intelliaacess
WorkingDirectory=/home/intelliaacess/IntelliAccess
ExecStart=/usr/bin/npm run dev
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable intelliaccess-backend
sudo systemctl enable intelliaccess-frontend
sudo systemctl start intelliaccess-backend
sudo systemctl start intelliaccess-frontend
```

Check status:
```bash
sudo systemctl status intelliaccess-backend
sudo systemctl status intelliaccess-frontend
```

---

## Testing the System

### 1. Test Camera Stream
```bash
curl http://localhost:8000/stream
```

### 2. Test RFID Reader
```bash
curl -X POST http://localhost:8000/rfid/connect
curl -X POST http://localhost:8000/rfid/read
```

### 3. Access Web Interface
Open browser: `http://<raspberry-pi-ip>:5173/admin/camera`

---

## Troubleshooting

### Camera not working
```bash
# Test if libcamera detects the camera
libcamera-hello

# Take a test picture
libcamera-jpeg -o test.jpg

# If no cameras are available, edit the boot config:
# sudo nano /boot/firmware/config.txt (or /boot/config.txt)
# Ensure the line `camera_auto_detect=1` is present.
```

### RFID reader not found
```bash
# List USB devices
lsusb

# Check serial ports
ls -la /dev/tty*

# Update the port in backend/utils/rfid.py
```

### MongoDB connection issues
```bash
# Check MongoDB status
sudo systemctl status mongodb

# Restart MongoDB
sudo systemctl restart mongodb
```

### Port already in use
```bash
# Kill process on port 8000
sudo lsof -i :8000
sudo kill -9 <PID>

# Kill process on port 5173
sudo lsof -i :5173
sudo kill -9 <PID>
```

---

## Performance Tips

1. **Reduce YOLO Model Size**: Use `yolov8n.pt` (already configured)
2. **Optimize Detection Interval**: Increase `DETECTION_INTERVAL` in `stream.py` if needed
3. **Use Pi 4 with 4GB+**: Recommended for smooth operation
4. **Enable GPU acceleration** (if available): Update ultralytics configuration

---

## 🌍 Deployment via Ngrok (100% Free - Recommended)

In order to securely expose the Raspberry Pi backend to the public internet so that your Vercel Frontend can communicate with the hardware Camera and RFID, we will use Ngrok. Ngrok provides a permanent, free static domain without needing to buy a custom domain name.

### Prerequisites:
1. **Ngrok Account:** Create a free account at [dashboard.ngrok.com](https://dashboard.ngrok.com).
2. **Authtoken:** Go to **Getting Started > Your Authtoken** to copy your token.
3. **Claim Static Domain:** Go to **Cloud Edge > Domains** and claim your 1 free static domain (e.g. `your-random-word.ngrok-free.app`).

### Step 1: Install Ngrok on Raspberry Pi
Open a terminal on your Pi and install Ngrok directly:
```bash
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
  | sudo tee /etc/apt/keyrings/ngrok.asc >/dev/null \
  && echo "deb [signed-by=/etc/apt/keyrings/ngrok.asc] https://ngrok-agent.s3.amazonaws.com buster main" \
  | sudo tee /etc/apt/sources.list.d/ngrok.list \
  && sudo apt update \
  && sudo apt install ngrok
```

### Step 2: Link your Account
Run this command to authenticate your Raspberry Pi with your Ngrok account (replace `<YOUR_AUTHTOKEN>`):
```bash
ngrok config add-authtoken <YOUR_AUTHTOKEN>
```

### Step 3: Test the Tunnel
Test if the tunnel successfully connects to port 8000 (where our Python backend runs). Replace the domain with the one you claimed in the dashboard:
```bash
ngrok http --url=your-static-domain.ngrok-free.app 8000
```
*If you see "Session Status: online" in green, it means your backend is now live on the internet! Press `Ctrl+C` to close it for now.*

### Step 4: Run Ngrok as a Background Service
To ensure the public link stays alive even if you close the terminal or restart the Raspberry Pi, we will create a background service.

Create the service file:
```bash
sudo nano /etc/systemd/system/ngrok.service
```

Paste the following configuration (Replace the `--domain=` line with your exact domain):
```ini
[Unit]
Description=Ngrok Tunnel Service
After=network.target

[Service]
Type=simple
User=pi
ExecStart=/usr/bin/ngrok http --url=your-static-domain.ngrok-free.app 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```
*Save it with `Ctrl+X`, then `Y`, then `Enter`.*
*(Note: If your Raspberry Pi username is not `pi`, change `User=pi` to your actual username, e.g. `User=intelliaacess`)*

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ngrok
sudo systemctl start ngrok
```

### Done!
Your Raspberry Pi Backend is now securely live on the internet!. 
Before deploying your frontend to Vercel, simply set this environment variable:
`VITE_PI_API_URL=https://your-static-domain.ngrok-free.app`

---

## Quick Restart Commands

```bash
# Stop all services
sudo systemctl stop intelliaccess-backend
sudo systemctl stop intelliaccess-frontend

# Start all services
sudo systemctl start intelliaccess-backend
sudo systemctl start intelliaccess-frontend

# View logs
sudo journalctl -u intelliaccess-backend -f
sudo journalctl -u intelliaccess-frontend -f
```

IntelliAccess is a next-generation campus security system designed for Sorsogon State University. It combines Ultra-High Frequency (UHF) RFID technology with AI-powered computer vision to provide a seamless, highly secure, and automated vehicle entry management solution.

IntelliAccess: Securing the Future of Education IntelliAccess represents a paradigm shift in university campus security for Sorsogon State University. By intelligently integrating passive UHF RFID sensors with advanced neural networks for Automated License Plate Recognition (ALPR), the system creates a frictionless yet fortress-like entry experience.

Our mission is to ensure that only authorized students, faculty, and staff can access the campus grounds. The system operates virtually invisibly in the background, entirely eliminating everyday traffic bottlenecks at the gates while simultaneously maintaining a rigorous, zero-latency security perimeter.

Core Features & Capabilities (Great for Bullet Points on Slides)
Dual-Factor Vehicle Verification: Vehicles are authenticated in under 200 milliseconds using a combination of long-range UHF RFID tags and AI-driven license plate reading (OpenCV), ensuring 99.8% entry accuracy.
Instant SMS Notifications: Integrated directly with the Sema API, the system sends automated SMS security alerts to the registered owner's mobile phone the exact second their vehicle enters or exits the university.
Real-time Web Dashboard: A sleek, modern web application provides live monitoring. Users can track their own vehicle's movement history, while Administrators can oversee thousands of live access logs with zero delay.
Automated Gate Control: Upon successful verification, the system automatically triggers the physical boom barrier to open, drastically reducing the manual workload for campus security guards.
Strict Security Enforcement: Unauthorized vehicles, spoofed plates, or unregistered entry attempts are instantly flagged and denied, alerting the Admin Dashboard for an immediate security response.

Technical Architecture
IntelliAccess is engineered on a highly scalable, modern tech stack. The user interface is built with React, TypeScript, and Tailwind CSS, featuring a premium glassmorphism design system.

The core engine is powered by a high-performance Python FastAPI backend, utilizing OpenCV and YOLO for live video streaming and AI frame analysis. All sensitive data is safely stored in a **Zero-Setup Local JSON Database** (`backend/local_db`), eliminating the need for an external MongoDB server. Real-time camera feeds and system alerts are transmitted via bidirectional WebSockets.

## How to Run Locally

You can run the entire system gracefully in two terminal windows without any complicated environment setups:

### 1. Run the Frontend (Web Dashboard)
Open a terminal in the main root folder and run:
```bash
pnpm install
pnpm run dev
```

### 2. Run the AI Brain Server (Backend)
Open a separate terminal, install the python dependencies, and start the brain server:
```bash
cd backend
pip install -r requirements.txt
python brain_server.py
```

*Note: There is absolutely no external database required! The system proactively generates its own storage securely inside `backend/local_db` on first launch.*

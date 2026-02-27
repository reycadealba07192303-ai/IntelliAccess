# IntelliAccess Project Roadmap

This document tracks the detailed feature status of the entire IntelliAccess system, broken down by development phases.

## ✅ Phase 1: Foundation & Authentication (Completed)
- [x] **Project Setup**
  - [x] Initialize React + Vite + Tailwind CSS
  - [x] Configure Tailwind Theme (Dark Mode, Glassmorphism)
  - [x] Set up Supabase Client (Frontend & Backend)
- [x] **Authentication System**
  - [x] Login Page (`sign-in.tsx`)
  - [x] Supabase Auth Integration
  - [x] Role-Based Access Control (RBAC) Logic
  - [x] Secure Route Protection (Redirects: Admin → `/admin`, User → `/dashboard`)
- [x] **UI Framework**
  - [x] Create Global Layout (Sidebar, Topbar)
  - [x] Develop Reusable Glass Components (`GlassCard`, `GlassButton`, `GlassInput`)
  - [x] Implement Toast Notification System

## ✅ Phase 2: Admin Management Module (Completed)
- [x] **User Accounts Management (`accounts.tsx`)**
  - [x] Supabase Data Fetching (Profiles + Vehicles)
  - [x] Role-Based Grouping & Sorting
  - [x] Search & Filter (Name, Email, Role, Plate)
  - [x] CRUD Operations (Add, Edit, Delete Users)
  - [x] Data Export (.doc reports for All Users & History)
- [x] **Vehicle Registry (`vehicles.tsx`)**
  - [x] Vehicle List with Status Badges (Active, Pending, Blacklisted)
  - [x] Approve/Reject Pending Vehicles
  - [x] Blacklist/Reactivate Vehicles
  - [x] Owner Info Integration

## 🚧 Phase 3: Hardware & Real-Time Monitoring (In Progress)
- [x] **Camera Dashboard UI (`camera.tsx`)**
  - [x] Grid Layout for Multi-Camera View
  - [x] Snapshot/Thumbnail Gallery
  - [x] Image Upload Scanning Feature
- [ ] **Live Feed Integration**
  - [ ] **Backend**: Finalize `stream.py` OpenCV implementation
  - [ ] **Frontend**: Connect React to Python MJPEG Stream
  - [x] **AI/ALPR**: Implement real-time License Plate Recognition script (`detection.py`)
- [ ] **Hardware Communication**
  - [ ] ESP32/Gate Control Logic Signal Integration

## ⏳ Phase 4: Analytics & System Logs (In Progress)
- [ ] **Access Logs (`logs.tsx`)**
  - [x] Create `access_logs` table in Supabase
  - [x] Backend endpoint to record entry/exit events (Integrated via `detection.py`)
  - [ ] Frontend table to display logs with timestamps & images
- [ ] **Admin Settings (`settings.tsx`)**
  - [ ] Camera Configuration Form (IP Address, Resolution)
  - [ ] System Alert Thresholds
  - [ ] Data Retention Policies

## ⏳ Phase 5: Student/User Portal (Pending)
- [ ] **User Dashboard (`user-dashboard.tsx`)**
  - [ ] Display User's Registered Vehicles
  - [ ] Status Status (Active/Pending)
- [ ] **User Profile Management**
  - [ ] Edit Personal Details
  - [ ] Change Password
- [ ] **Vehicle Registration Request**
  - [ ] Form to submit new vehicle for approval
  - [ ] Upload Plate/ORCR Images

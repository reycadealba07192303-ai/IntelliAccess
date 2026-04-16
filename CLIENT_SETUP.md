# IntelliAccess AI Brain - Client Setup Guide

Welcome to the IntelliAccess system! Please follow these instructions carefully to set up the AI Brain on your local Windows machine. 

Since you downloaded this from GitHub via "Download ZIP", **secret files like `.env` were hidden automatically for security**. You will need to manually recreate them using the guide below.

---

## Phase 1: Create the Secret Credentials (.env files)

1. Open the extracted folder (`INTELLIACCESS`).
2. Inside the folder, create a new text document and name it exactly **`.env`** (make sure there is no `.txt` at the end).
3. Open it with Notepad and paste the following codes:

```env
MONGODB_URI=mongodb+srv://reycadealba07192303_db_user:VCQPGYt3YO7wtEvR@intelliaccess.wss4ebm.mongodb.net/?appName=IntelliAccess
SECRET_KEY=09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7

VITE_USE_LOCAL_API=false
VITE_LOCAL_API_URL=https://magazines-treatments-michigan-anna.trycloudflare.com
VITE_PI_API_URL=https://magazines-treatments-michigan-anna.trycloudflare.com
VITE_API_URL=https://magazines-treatments-michigan-anna.trycloudflare.com
VITE_BRAIN_URL=http://localhost:8001
```
4. Save and close. Next, create another file named **`.env.local`** and copy these Firebase credentials into it:

```env
VITE_FIREBASE_API_KEY=AIzaSyAxGorO0bYWLsAOtyh_ZjKKmXXmbu8oMb8
VITE_FIREBASE_AUTH_DOMAIN=intelliaccess-ac1e5.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=intelliaccess-ac1e5
VITE_FIREBASE_STORAGE_BUCKET=intelliaccess-ac1e5.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=608056051585
VITE_FIREBASE_APP_ID=1:608056051585:web:e4f60560f625cab6724a80
VITE_FIREBASE_MEASUREMENT_ID=G-WCRLJWD1F0
```
5. Save and Close.

---

start na u sa phase 2.
## Phase 2: System Setup (One-Time Execution)

**1. Install Python**
* Go to [python.org/downloads](https://www.python.org/downloads/) to download Python (v3.10 or higher).
* Run the installer.
* ⚠️ **CRITICAL:** On the very first screen of the setup, check the box that says **"Add python.exe to PATH"**. If you skip this, the system will not work.

**2. Setup Ngrok (For Remote Dashboard Access)**
* Download Ngrok for Windows at [ngrok.com/download](https://ngrok.com/download).
* Extract the file and place `ngrok.exe` directly inside your `INTELLIACCESS` project folder.

**3. Install AI Dependencies**
* In your `INTELLIACCESS` folder, click on the top file address bar.
* Erase the text, type `cmd`, and press Enter. A black terminal window will open.
* Type the following command to download YOLO and EasyOCR dependencies:
  ```cmd
  pip install -r backend\requirements.txt
  ```
* Wait for the installation to finish downloading.

**4. Activate your Tunnel (Ngrok)**
* In the same command prompt, you must log into the developer's registered tunnel. Type:
  ```cmd
  ngrok config add-authtoken 3CHd9LTdI6016IWVw0LNHLvtKRI_855krT95rFxQtAb5mQ2TS
  ```
* You should see a success message.

---

## Phase 3: Running the System Daily

Whenever you need to turn the AI System on:
1. Open the project folder. [extract mo muna yung zip file once na nadownload mo na.]
2. Double-click the **`start_brain_system.bat`** file.
3. Two black windows will open and minimize (The Backend Server, and Ngrok Tunnel linking to `senate-postcard-lugged.ngrok-free.dev`). 
4. DO NOT close these windows. If they are running, the system is online!

---

## Phase 4: Auto-Start on Boot (Optional)

If you want the AI Brain to automatically start whenever you turn on your laptop/mini-PC, follow these steps:
1. Press **`Windows Key + R`** on your keyboard to open the "Run" dialog.
2. Type **`shell:startup`** and press Enter. A folder will open.
3. Go back to your `INTELLIACCESS` folder, right-click on **`start_brain_system.bat`**, and click **"Create shortcut"** (or Show More Options -> Create Shortcut).
4. Drag and drop that newly created **`start_brain_system.bat - Shortcut`** into the Startup folder that you opened in Step 2.
5. Done! The AI System will now automatically boot up every time you turn on your computer.

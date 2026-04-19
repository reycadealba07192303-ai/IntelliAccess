#!/bin/bash
# IntelliAccess Backend Daily Restart Script
echo "[$(date)] Restarting IntelliAccess Backend Service..."
sudo systemctl restart intelliaccess-backend
echo "[$(date)] Restart complete."

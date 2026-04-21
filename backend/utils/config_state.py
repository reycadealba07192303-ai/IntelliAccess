import os
import json

CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "system_config.json")

# Default Configuration
_config = {
    "camera_scanning_active": True,
    "rfid_scanning_active": True,
    "brain_mode_active": True
}

def load_config():
    global _config
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                saved = json.load(f)
                _config.update(saved)
        except Exception as e:
            print(f"[CONFIG] Error loading config: {e}")
    return _config

def save_config(new_config):
    global _config
    _config.update(new_config)
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(_config, f, indent=4)
        print(f"[CONFIG] System configuration updated and saved.")
    except Exception as e:
        print(f"[CONFIG] Error saving config: {e}")

def get_config():
    return _config

# Initial Load
load_config()

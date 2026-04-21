import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

URL = "https://smsapiph.onrender.com/api/v1/send/sms"
API_KEY = os.getenv("SMS_API_PH_KEY", "sk-2b10vkgzpm562uaxjjjyh6yaenufhlvl")

def test_api():
    headers = {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    # Test valid number from DB (Jomarie Briones)
    num = "09916024734"
    print(f"\nTesting format: {num} with NEW key")
    payload = {
        "recipient": num,
        "message": "IntelliAccess: Your new SMS API Key is working! - Testing Fixes"
    }
    try:
        response = requests.post(URL, json=payload, headers=headers, timeout=12)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_api()

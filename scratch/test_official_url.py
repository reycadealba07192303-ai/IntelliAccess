import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

# New official URL
URL = "https://smsapiph.com/api/v1/send/sms"
API_KEY = os.getenv("SMS_API_PH_KEY", "sk-2b10vkgzpm562uaxjjjyh6yaenufhlvl")

def test_api():
    headers = {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    # Test valid number from DB (Jomarie Briones)
    num = "09916024734"
    print(f"\nTesting format: {num} with NEW official URL (smsapiph.com)")
    payload = {
        "recipient": num,
        "message": "IntelliAccess: Testing the New Official SMS API Link (smsapiph.com). Final verification."
    }
    try:
        response = requests.post(URL, json=payload, headers=headers, timeout=12)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_api()

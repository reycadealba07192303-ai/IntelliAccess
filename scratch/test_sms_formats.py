import os
import requests
import json

URL = "https://smsapiph.onrender.com/api/v1/send/sms"
API_KEY = "sk-2b10etxbzawur9btl08miuxyohnsnexu"

def test_api():
    headers = {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    # Test formats
    for num in ["09123456789", "639123456789", "09916024734"]:
        print(f"\nTesting format: {num}")
        payload = {
            "recipient": num,
            "message": "IntelliAccess Test Format"
        }
        try:
            response = requests.post(URL, json=payload, headers=headers, timeout=10)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_api()

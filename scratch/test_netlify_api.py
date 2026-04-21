import requests
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("SMS_API_PH_KEY", "sk-2b10vkgzpm562uaxjjjyh6yaenufhlvl")
headers = {"x-api-key": API_KEY, "Content-Type": "application/json"}
payload = {"recipient": "09916024734", "message": "Verify Netlify API Endpoint"}

urls = [
    "https://smsapiph.netlify.app/api/v1/send/sms",
    "https://api.smsapiph.com/v1/send/sms",
    "https://smsapiph.com/api/v1/send/sms"
]

for url in urls:
    print(f"\nTesting: {url}")
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=5)
        print(f"Status: {r.status_code}")
        print(f"Response: {r.text}")
    except Exception as e:
        print(f"Error: {e}")

import requests

try:
    print("Testing backend login endpoint...")
    response = requests.post("http://localhost:8000/auth/login", json={"email": "test@example.com", "password": "password"})
    print("Status Code:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    print("Failed to connect:", e)

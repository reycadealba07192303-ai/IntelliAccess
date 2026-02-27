import requests

print("Testing Backend...")

try:
    # Test Root
    r = requests.get("http://localhost:8000/")
    print(f"Root: {r.status_code} - {r.json()}")

    # Test Verify (Dummy Plate)
    payload = {"plate_number": "TEST1234"} # This expects a query param in the current code?
    # Wait, vehicles.py: verify_vehicle(plate_number: str) -> this defaults to Query param in FastAPI if not Body
    # The signature was: verify_vehicle(plate_number: str)
    
    r = requests.post("http://localhost:8000/vehicles/verify", params={"plate_number": "TEST1234"})
    print(f"Verify: {r.status_code} - {r.json()}")

except Exception as e:
    print(f"Error: {e}")

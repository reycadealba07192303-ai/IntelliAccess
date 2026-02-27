from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_get_vehicles():
    # Since we don't have a valid auth token that easily circumvents dependency,
    # let's just create a mock user and call the inner function directly.
    import asyncio
    from backend.endpoints.vehicles import get_vehicles
    
    user = {"id": "699e8ffa5e5208f812daa907", "role": "ADMIN", "name": "Reyca De Alba"}
    try:
        res = asyncio.run(get_vehicles(user=user))
        import json
        print(json.dumps(res, indent=2))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_get_vehicles()

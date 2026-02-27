import os
import sys

# Add the parent directory so we can import backend.utils
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.utils.sms import send_access_sms
from dotenv import load_dotenv
import time
from datetime import datetime

load_dotenv()

if __name__ == "__main__":
    print("Testing SMS API PH (Entry & Exit)...")
    
    # PUT YOUR OWN PHONE NUMBER HERE FOR TESTING
    test_number = "09916024734" 
    test_owner = "Jazmine Isabelle L. Guban"
    test_plate = "ABY 8512"
    current_time_str = datetime.now().strftime("%I:%M %p")
    
    print("\n--- Testing ENTRY SMS ---")
    send_access_sms(test_number, test_owner, test_plate, current_time_str, "Entry")
    
    print("Waiting 20 seconds for API rate limit before sending Exit text...")
    time.sleep(20) 
    
    print("\n--- Testing EXIT SMS ---")
    send_access_sms(test_number, test_owner, test_plate, current_time_str, "Exit")
    
    print("\nWait a few seconds for background threads to finish sending...")
    time.sleep(5)
    print("Done testing.")

try:
    import serial
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False
import time
from typing import Optional

class RFIDReader:
    def __init__(self, port: str = '/dev/serial0', baudrate: int = 115200):
        """
        Initialize RFID reader
        Args:
            port: Serial port (e.g., 'COM3' on Windows, '/dev/ttyUSB0' on Linux)
            baudrate: Baud rate for serial communication
        """
        self.port = port
        self.baudrate = baudrate
        self.serial = None

    def connect(self) -> bool:
        """Connect to RFID reader"""
        if not SERIAL_AVAILABLE:
            print("Serial module not available. Install pyserial to use RFID reader.")
            return False
        try:
            self.serial = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=1
            )
            print(f"RFID reader connected on {self.port}")
            return True
        except Exception as e:
            print(f"Failed to connect to RFID reader: {e}")
            return False

    def disconnect(self):
        """Disconnect from RFID reader"""
        if self.serial and self.serial.is_open:
            self.serial.close()
            print("RFID reader disconnected")

    def read_tag(self) -> Optional[str]:
        """
        Read RFID tag
        Returns the tag ID as string, or None if no tag detected
        """
        if not self.serial or not self.serial.is_open:
            return None

        try:
            # Read data from serial port
            if self.serial.in_waiting > 0:
                data = self.serial.readline().decode('utf-8').strip()
                if data:
                    # Assuming the reader sends tag ID as plain text
                    # You may need to adjust parsing based on your reader
                    return data
        except Exception as e:
            print(f"Error reading RFID tag: {e}")

        return None

    def wait_for_tag(self, timeout: int = 10) -> Optional[str]:
        """
        Wait for an RFID tag to be detected
        Args:
            timeout: Maximum time to wait in seconds
        Returns: Tag ID or None
        """
        start_time = time.time()
        while time.time() - start_time < timeout:
            tag = self.read_tag()
            if tag:
                return tag
            time.sleep(0.1)
        return None

# Global RFID reader instance
rfid_reader = RFIDReader()

def get_rfid_reader():
    """Get the global RFID reader instance"""
    return rfid_reader
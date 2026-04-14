"""
LED control utility for Raspberry Pi GPIO.
Connects Green LED to GPIO 27 and Blue LED to GPIO 22 by default.
Gracefully falls back (no crash) if running on a non-Pi system.
"""
import threading
import time

GREEN_LED_PIN = 27
BLUE_LED_PIN = 22

_gpio_available = False
try:
    import RPi.GPIO as GPIO
    GPIO.setwarnings(False)
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(GREEN_LED_PIN, GPIO.OUT, initial=GPIO.LOW)
    GPIO.setup(BLUE_LED_PIN, GPIO.OUT, initial=GPIO.LOW)
    _gpio_available = True
    print(f"[LED] GPIO initialized: Green=pin {GREEN_LED_PIN}, Blue=pin {BLUE_LED_PIN}")
except Exception as e:
    print(f"[LED] GPIO not available (non-Pi system or missing RPi.GPIO): {e}")

def _flash_led(pin: int, duration: float):
    """Internal: Turn on a specific LED for a duration, then turn it off."""
    if not _gpio_available:
        return
    try:
        GPIO.output(pin, GPIO.HIGH)
        time.sleep(duration)
        GPIO.output(pin, GPIO.LOW)
    except Exception as e:
        print(f"[LED] Error flashing LED on pin {pin}: {e}")

def led_granted(duration: float = 2.0):
    """Illuminates the Green LED for authorized access."""
    print(f"[LED] Triggered: Green LED (GRANTED) for {duration}s")
    threading.Thread(target=_flash_led, args=(GREEN_LED_PIN, duration), daemon=True).start()

def led_denied(duration: float = 2.0):
    """Illuminates the Blue LED for denied access."""
    print(f"[LED] Triggered: Blue LED (DENIED) for {duration}s")
    threading.Thread(target=_flash_led, args=(BLUE_LED_PIN, duration), daemon=True).start()

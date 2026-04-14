"""
Buzzer control utility for Raspberry Pi GPIO.
Connects to a buzzer on GPIO pin 17 (BCM) by default.
Gracefully falls back (no crash) if running on a non-Pi system.
"""
import threading
import time

# Buzzer GPIO pin (BCM numbering) - change this to match your wiring
BUZZER_PIN = 17

_gpio_available = False
try:
    import RPi.GPIO as GPIO
    GPIO.setwarnings(False)
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(BUZZER_PIN, GPIO.OUT, initial=GPIO.LOW)
    _gpio_available = True
    print(f"[BUZZER] GPIO initialized on pin {BUZZER_PIN}")
except Exception as e:
    print(f"[BUZZER] GPIO not available (non-Pi system or missing RPi.GPIO): {e}")


def _buzz(duration: float, times: int = 1, gap: float = 0.1):
    """Internal: beep the buzzer N times."""
    if not _gpio_available:
        return
    try:
        for i in range(times):
            GPIO.output(BUZZER_PIN, GPIO.HIGH)
            time.sleep(duration)
            GPIO.output(BUZZER_PIN, GPIO.LOW)
            if i < times - 1:
                time.sleep(gap)
    except Exception as e:
        print(f"[BUZZER] Error during beep: {e}")


def buzz_granted():
    """Two short beeps = ACCESS GRANTED."""
    print("[BUZZER] Triggered: ACCESS GRANTED (2 short beeps)")
    threading.Thread(target=_buzz, args=(0.15, 2, 0.1), daemon=True).start()


def buzz_denied():
    """One long beep = ACCESS DENIED."""
    print("[BUZZER] Triggered: ACCESS DENIED (1 long beep)")
    threading.Thread(target=_buzz, args=(0.8, 1), daemon=True).start()


def buzz_once(duration: float = 0.2):
    """Single beep for generic feedback."""
    threading.Thread(target=_buzz, args=(duration, 1), daemon=True).start()

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

# Configuration
GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")

def test_gmail_connectivity():
    print("\n--- Gmail Connectivity Diagnostic ---")
    
    if not GMAIL_USER:
        print("[FAIL] GMAIL_USER not found in .env")
        return
    if not GMAIL_APP_PASSWORD:
        print("[FAIL] GMAIL_APP_PASSWORD not found in .env")
        print("Please generate an App Password in your Google Account settings.")
        return

    print(f"Testing connectivity from: {GMAIL_USER}")
    
    # Recipient is the same as the user for testing
    recipient = GMAIL_USER
    subject = "IntelliAccess: Gmail Delivery Test"
    body = "If you are reading this, your IntelliAccess Gmail notification system is correctly configured!"

    try:
        message = MIMEMultipart()
        message["Subject"] = subject
        message["From"] = GMAIL_USER
        message["To"] = recipient
        message.attach(MIMEText(body, "plain"))

        print("Connecting to smtp.gmail.com:465...")
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
            print("Logging in...")
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            print("Sending test email...")
            server.sendmail(GMAIL_USER, recipient, message.as_string())
            
        print("\n[SUCCESS] Test email sent! Check your inbox (including Spam).")
        print("Now, notifications will be sent automatically along with SMS alerts.")

    except Exception as e:
        print(f"\n[ERROR] Connection failed: {e}")
        print("\nCommon fixes:")
        print("1. Ensure 2-Step Verification is ON in your Google Account.")
        print("2. Ensure you are using a 16-digit 'App Password', not your login password.")
        print("3. Check if your Raspberry Pi has internet access.")

if __name__ == "__main__":
    test_gmail_connectivity()

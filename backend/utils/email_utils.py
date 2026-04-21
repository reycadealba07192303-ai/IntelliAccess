import os
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

# Gmail Configuration from .env
GMAIL_USER = os.getenv("GMAIL_USER", "intelliaccessssu@gmail.com")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")

# Strip spaces from password if it exists
if GMAIL_APP_PASSWORD:
    GMAIL_APP_PASSWORD = GMAIL_APP_PASSWORD.replace(" ", "").strip()

def _send_email_thread(recipient_email, subject, body_text, body_html):
    """
    Internal function to send email via Gmail SMTP.
    """
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("[EMAIL WARNING] Gmail credentials missing in .env. Skipping email.")
        return

    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"IntelliAccess System <{GMAIL_USER}>"
        message["To"] = recipient_email

        # Add text and HTML parts
        part1 = MIMEText(body_text, "plain")
        part2 = MIMEText(body_html, "html")
        message.attach(part1)
        message.attach(part2)

        # Connect and send
        print(f"[DEBUG EMAIL] Connecting to Gmail SMTP for {recipient_email}...")
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            print(f"[DEBUG EMAIL] Logging in as {GMAIL_USER}...")
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            print(f"[DEBUG EMAIL] Sending mail...")
            server.sendmail(GMAIL_USER, recipient_email, message.as_string())
            
        print(f"[EMAIL SUCCESS] Notification sent to {recipient_email}")
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send to {recipient_email}: {e}")

def send_access_email(recipient_email, owner_name, plate_number, time_str, action):
    """
    Fires off a professional Gmail notification in a background thread.
    """
    if not recipient_email:
        return

    action_str = "entered" if action.lower() == "entry" else "exited"
    subject = f"IntelliAccess Alert: Vehicle {action.capitalize()}"
    
    # Plain text version
    body_text = (
        f"Hi {owner_name},\n\n"
        f"Your vehicle with plate number {plate_number} has {action_str} the university campus at {time_str}.\n\n"
        f"If this wasn't you, please manage your vehicles in the IntelliAccess Dashboard immediately.\n\n"
        f"Security Team\nIntelliAccess System"
    )

    # HTML version for professional look
    body_html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Vehicle {action.capitalize()} Alert</h2>
          <p>Hi <strong>{owner_name}</strong>,</p>
          <p>This is an automated notification from the <strong>IntelliAccess Security System</strong>.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Plate Number:</strong> {plate_number}</p>
            <p style="margin: 5px 0;"><strong>Action:</strong> <span style="color: {'#27ae60' if action.lower() == 'entry' else '#e67e22'}; font-weight: bold;">{action.upper()}</span></p>
            <p style="margin: 5px 0;"><strong>Time:</strong> {time_str}</p>
          </div>
          
          <p>If you did not authorize this movement, please log in to your dashboard immediately or contact Campus Security.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.9em; color: #7f8c8d;">
            <p>Thank you,<br><strong>IntelliAccess Team</strong></p>
          </div>
        </div>
      </body>
    </html>
    """

    # Start thread
    thread = threading.Thread(target=_send_email_thread, args=(recipient_email, subject, body_text, body_html))
    thread.daemon = True
    thread.start()

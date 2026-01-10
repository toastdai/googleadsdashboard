import os
from google_auth_oauthlib.flow import InstalledAppFlow
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("GOOGLE_ADS_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_ADS_CLIENT_SECRET")

if not CLIENT_ID or not CLIENT_SECRET:
    print("Error: GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET not found in .env")
    exit(1)

def main():
    flow = InstalledAppFlow.from_client_config(
        {
            "web": {
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=["https://www.googleapis.com/auth/adwords"]
    )
    flow.redirect_uri = "urn:ietf:wg:oauth:2.0:oob"
    
    auth_url, _ = flow.authorization_url(prompt="consent")
    
    print("\n" + "="*80)
    print("Please visit this URL to authorize the application:")
    print("Log in with: toastdcontent@gmail.com")
    print("="*80)
    print(f"\n{auth_url}\n")
    print("="*80)
    print("Copy the authorization code from the page and provide it in the next step.")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()

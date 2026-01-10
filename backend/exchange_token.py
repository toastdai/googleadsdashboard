import os
import argparse
from google_auth_oauthlib.flow import InstalledAppFlow
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("GOOGLE_ADS_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_ADS_CLIENT_SECRET")

def main():
    parser = argparse.ArgumentParser(description='Exchange auth code for refresh token')
    parser.add_argument('code', help='Authorization code')
    args = parser.parse_args()

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
    
    try:
        flow.fetch_token(code=args.code)
        credentials = flow.credentials
        
        print("\n" + "="*80)
        print("SUCCESS! Here is your new Refresh Token:")
        print("="*80)
        print(f"\n{credentials.refresh_token}\n")
        print("="*80)
        print("I will automatically update your .env file with this token.")
        print("="*80 + "\n")
        
        # Update .env file
        env_path = ".env"
        with open(env_path, "r") as f:
            lines = f.readlines()
            
        with open(env_path, "w") as f:
            for line in lines:
                if line.startswith("GOOGLE_ADS_REFRESH_TOKEN="):
                    f.write(f"GOOGLE_ADS_REFRESH_TOKEN={credentials.refresh_token}\n")
                else:
                    f.write(line)
                    
    except Exception as e:
        print(f"Error exchanging code: {e}")

if __name__ == "__main__":
    main()

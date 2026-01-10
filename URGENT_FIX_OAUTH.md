# URGENT FIX: Google Ads OAuth Not Working

## Problem
Getting error: "Access blocked: Authorization Error - Missing required parameter: client_id"

## Root Cause
Backend environment variables are not configured on Render

## Immediate Fix (5 minutes)

### Step 1: Add Environment Variables to Render
1. Go to https://dashboard.render.com/
2. Select service: `googleads-dashboard-backend`
3. Click **Environment** tab
4. Click **Add Environment Variable** and add these:

```bash
GOOGLE_ADS_CLIENT_ID=<from client_secret_*.json file>
GOOGLE_ADS_CLIENT_SECRET=<from client_secret_*.json file>
GOOGLE_ADS_DEVELOPER_TOKEN=<from Google Ads API Center>
GOOGLE_ADS_LOGIN_CUSTOMER_ID=<your MCC or account customer ID>
OAUTH_REDIRECT_URI=https://googleadsdashboard-beta.vercel.app/auth/callback
FRONTEND_URL=https://googleadsdashboard-beta.vercel.app
APP_ENV=production
DEBUG=false
```

**Get values from:** The `client_secret_*.json` file in your project root directory

5. Click **Save Changes**
6. Backend will automatically redeploy (takes ~2 minutes)

### Step 2: Update Google Cloud Console
1. Go to https://console.cloud.google.com/
2. Select project: `gen-lang-client-0652295449`
3. Go to **APIs & Services** → **Credentials**
4. Click your OAuth 2.0 Client ID (find ID in `client_secret_*.json` file)
5. Under **Authorized redirect URIs**, add:
   ```
   https://googleadsdashboard-beta.vercel.app/auth/callback
   ```
6. Click **Save**

### Step 3: Test
1. Visit https://googleadsdashboard-beta.vercel.app/login
2. Click "Sign in with Google"
3. Should redirect to Google OAuth (no more error!)

## Why This Fixes It
- Backend was missing `GOOGLE_ADS_CLIENT_ID` which OAuth flow requires
- `OAUTH_REDIRECT_URI` must match what's registered in Google Cloud Console
- After adding these, backend can properly construct OAuth URL

## Next Steps (Optional but Recommended)
- Add PostgreSQL database to Render for data persistence
- Generate secure `JWT_SECRET_KEY` (64 random characters)
- Configure DATABASE_URL

For complete setup, see: `GOOGLE_ADS_AUTH_SETUP.md`

---

**Status After Fix:**
✅ OAuth flow works
✅ Can sign in with Google
⏳ Need database for data persistence

# Google Ads API Authentication Setup Guide

## Issue Identified
**Error:** "Access blocked: Authorization Error - Missing required parameter: client_id"
**Cause:** Backend environment variables not configured on Render

## Quick Fix Summary
The backend needs these environment variables configured on Render:

```
GOOGLE_ADS_CLIENT_ID=<from client_secret JSON file>
GOOGLE_ADS_CLIENT_SECRET=<from client_secret JSON file>
GOOGLE_ADS_DEVELOPER_TOKEN=<your developer token>
GOOGLE_ADS_LOGIN_CUSTOMER_ID=<your MCC customer ID>
OAUTH_REDIRECT_URI=https://googleadsdashboard-beta.vercel.app/auth/callback
FRONTEND_URL=https://googleadsdashboard-beta.vercel.app
```

**Get these values from:** `client_secret_*.json` file in project root

## Step-by-Step Setup

### 1. Update Google Cloud Console OAuth Settings

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: `gen-lang-client-0652295449`
3. Navigate to: **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID (find it in your `client_secret_*.json` file)
5. Under **Authorized redirect URIs**, add these URLs:
   ```
   https://googleadsdashboard-beta.vercel.app/auth/callback
   https://googleads-dashboard-backend.onrender.com/api/auth/google/callback
   http://localhost:3000/auth/callback (for local testing)
   http://localhost:8000/api/auth/google/callback (for local testing)
   ```
6. Click **Save**

### 2. Configure Render Environment Variables

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your backend service: `googleads-dashboard-backend`
3. Navigate to **Environment** tab
4. Add these environment variables:

```bash
# Google OAuth Credentials (from client_secret_*.json file in project root)
GOOGLE_ADS_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=<your-client-secret>

# Google Ads API Developer Token (from Google Ads API Center)
GOOGLE_ADS_DEVELOPER_TOKEN=<your-developer-token>

# MCC Customer ID (if using MCC account, otherwise use account customer ID)
GOOGLE_ADS_LOGIN_CUSTOMER_ID=<your-customer-id>

# OAuth Redirect URI (IMPORTANT - must match Google Cloud Console)
OAUTH_REDIRECT_URI=https://googleadsdashboard-beta.vercel.app/auth/callback

# Frontend URL for CORS
FRONTEND_URL=https://googleadsdashboard-beta.vercel.app

# Database (REQUIRED for user data)
DATABASE_URL=postgresql://user:password@host:5432/database_name

# JWT Secret (generate a random 64-character string)
JWT_SECRET_KEY=your-random-64-character-string-here

# Application Settings
APP_ENV=production
DEBUG=false
```

5. Click **Save Changes**
6. Render will automatically redeploy with new environment variables

### 3. Configure PostgreSQL Database on Render

1. In Render Dashboard, create a new **PostgreSQL** database
2. Note the **Internal Database URL** (looks like: `postgresql://user:pass@dpg-xxx.oregon-postgres.render.com/db_xxx`)
3. Add this as `DATABASE_URL` environment variable in your backend service
4. Redeploy backend

### 4. Update Frontend Auth Callback Handler

The frontend callback route at `/auth/callback` needs to handle the OAuth response:

**File:** `frontend/src/app/auth/callback/page.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      router.push('/login?error=oauth_failed');
      return;
    }

    if (code) {
      // Send code to backend to exchange for tokens
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/callback?code=${code}`)
        .then(res => res.json())
        .then(data => {
          // Store token in localStorage or cookie
          localStorage.setItem('access_token', data.access_token);
          // Redirect to dashboard
          router.push('/dashboard');
        })
        .catch(err => {
          console.error('Token exchange failed:', err);
          router.push('/login?error=token_exchange_failed');
        });
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
        <p className="mt-4 text-gray-400">Completing authentication...</p>
      </div>
    </div>
  );
}
```

### 5. Update Login Page to Initiate OAuth

**File:** `frontend/src/app/login/page.tsx`

Update the login button to redirect to backend OAuth URL:

```typescript
const handleGoogleLogin = async () => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`);
    const data = await response.json();
    // Redirect to Google OAuth consent screen
    window.location.href = data.authorization_url;
  } catch (error) {
    console.error('Failed to initiate OAuth:', error);
  }
};
```

### 6. Testing the OAuth Flow

1. **Local Testing:**
   ```bash
   # Start backend
   cd backend
   uvicorn app.main:app --reload --port 8000
   
   # Start frontend
   cd frontend
   npm run dev
   ```

2. **Visit:** `http://localhost:3000/login`
3. **Click:** "Sign in with Google"
4. **Verify:** You're redirected to Google OAuth consent screen
5. **Authorize:** Allow access to Google Ads
6. **Verify:** Redirected back to `/auth/callback` then `/dashboard`

### 7. Production Testing

1. **Visit:** https://googleadsdashboard-beta.vercel.app/login
2. **Click:** "Sign in with Google"
3. **Verify:** OAuth flow completes without errors
4. **Check:** Dashboard shows Google Ads data

## Environment Variable Checklist

### ✅ Backend (Render)
- [ ] `GOOGLE_ADS_CLIENT_ID` - OAuth client ID
- [ ] `GOOGLE_ADS_CLIENT_SECRET` - OAuth client secret
- [ ] `GOOGLE_ADS_DEVELOPER_TOKEN` - API developer token
- [ ] `GOOGLE_ADS_LOGIN_CUSTOMER_ID` - MCC customer ID
- [ ] `OAUTH_REDIRECT_URI` - Callback URL (Vercel frontend)
- [ ] `FRONTEND_URL` - Frontend URL for CORS
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `JWT_SECRET_KEY` - Random 64-char string
- [ ] `APP_ENV=production`
- [ ] `DEBUG=false`

### ✅ Frontend (Vercel)
- [ ] `NEXT_PUBLIC_API_URL` - Backend URL (https://googleads-dashboard-backend.onrender.com)

### ✅ Google Cloud Console
- [ ] Authorized redirect URI added: `https://googleadsdashboard-beta.vercel.app/auth/callback`
- [ ] Authorized redirect URI added: `https://googleads-dashboard-backend.onrender.com/api/auth/google/callback`

## Troubleshooting

### Error: "Missing required parameter: client_id"
**Solution:** Set `GOOGLE_ADS_CLIENT_ID` in Render environment variables

### Error: "Redirect URI mismatch"
**Solution:** 
1. Check `OAUTH_REDIRECT_URI` in Render matches Google Cloud Console
2. Verify redirect URI in Google Cloud Console is exactly: `https://googleadsdashboard-beta.vercel.app/auth/callback`

### Error: "Invalid client"
**Solution:** Verify `GOOGLE_ADS_CLIENT_SECRET` is correct in Render

### Error: "Database connection failed"
**Solution:** 
1. Create PostgreSQL database on Render
2. Set `DATABASE_URL` environment variable
3. Run database migrations

### Error: "CORS blocked"
**Solution:** 
1. Set `FRONTEND_URL=https://googleadsdashboard-beta.vercel.app` in Render
2. Verify backend allows CORS from frontend URL

## Current Status

### ✅ Working
- Frontend deployed (Vercel)
- Backend deployed (Render)
- Partner APIs (Kelkoo, Admedia, MaxBounty)
- Date picker functionality

### ⏳ Needs Configuration
- [ ] Render environment variables
- [ ] Google Cloud Console redirect URIs
- [ ] PostgreSQL database
- [ ] Frontend auth callback page

### 📝 Next Steps
1. Configure Render environment variables (5 minutes)
2. Update Google Cloud Console redirect URIs (2 minutes)
3. Create PostgreSQL database on Render (3 minutes)
4. Test OAuth flow (5 minutes)

**Total Setup Time:** ~15 minutes

---

## Quick Copy-Paste for Render

```bash
# Copy these to Render Environment tab (replace with actual values from client_secret_*.json)
GOOGLE_ADS_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=<your-client-secret>
GOOGLE_ADS_DEVELOPER_TOKEN=<your-developer-token>
GOOGLE_ADS_LOGIN_CUSTOMER_ID=<your-customer-id>
OAUTH_REDIRECT_URI=https://googleadsdashboard-beta.vercel.app/auth/callback
FRONTEND_URL=https://googleadsdashboard-beta.vercel.app
APP_ENV=production
DEBUG=false
JWT_SECRET_KEY=generate-random-64-char-string-here
```

**Important:** Get actual values from `client_secret_*.json` file in your project root

**After adding these, click "Save Changes" and Render will redeploy automatically.**

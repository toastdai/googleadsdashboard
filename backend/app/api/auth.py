"""
Authentication API Routes

Handles OAuth2 flow with Google Ads API and JWT token management.
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.schemas.user import (
    UserCreate, UserResponse, UserLogin, Token, OAuthCallbackResponse
)
from app.services.auth import (
    create_access_token, 
    get_current_user,
    get_password_hash,
    verify_password
)
from app.services.google_ads import GoogleAdsService


router = APIRouter()


@router.get("/google")
async def initiate_google_oauth():
    """
    Initiate OAuth2 flow with Google.
    Redirects user to Google's OAuth consent page.
    """
    google_ads = GoogleAdsService()
    auth_url = google_ads.get_authorization_url()
    return {"authorization_url": auth_url}


@router.get("/google/callback")
async def oauth_callback(
    code: str = Query(...),
    state: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Handle OAuth2 callback from Google.
    Exchanges authorization code for tokens and creates/updates user.
    """
    from app.models.account import GoogleAdsAccount
    
    try:
        google_ads = GoogleAdsService()
        
        # Exchange code for tokens
        credentials = google_ads.exchange_code(code)
        
        # Get user info from Google
        user_info = await google_ads.get_user_info(credentials)
        
        # Check if user exists
        result = await db.execute(
            select(User).where(User.email == user_info["email"])
        )
        user = result.scalar_one_or_none()
        
        if not user:
            # Create new user
            user = User(
                email=user_info["email"],
                name=user_info.get("name", user_info["email"].split("@")[0]),
                is_verified=True,
                settings={}
            )
            db.add(user)
            await db.flush()
        
        # Get accessible Google Ads accounts
        accounts = await google_ads.get_accessible_accounts(credentials)
        
        # Save accounts to database
        for account_info in accounts:
            # Check if account already exists
            existing = await db.execute(
                select(GoogleAdsAccount).where(
                    GoogleAdsAccount.user_id == user.id,
                    GoogleAdsAccount.customer_id == account_info["customer_id"]
                )
            )
            existing_account = existing.scalar_one_or_none()
            
            if existing_account:
                # Update refresh token
                existing_account.refresh_token = credentials.refresh_token
                existing_account.is_active = True
            else:
                # Create new account
                new_account = GoogleAdsAccount(
                    user_id=user.id,
                    customer_id=account_info["customer_id"],
                    name=account_info["name"],
                    currency_code=account_info.get("currency_code", "USD"),
                    is_manager=account_info.get("is_manager", False),
                    refresh_token=credentials.refresh_token,
                    is_active=True
                )
                db.add(new_account)
        
        # Create JWT token
        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes)
        )
        
        await db.commit()
        
        # Redirect to frontend with token and account count
        frontend_url = settings.frontend_url or "http://localhost:3002"
        redirect_url = f"{frontend_url}/auth/callback?token={access_token}&email={user.email}&name={user.name}&accounts={len(accounts)}"
        
        if credentials.refresh_token:
            redirect_url += f"&refresh_token={credentials.refresh_token}"
        
        return RedirectResponse(url=redirect_url, status_code=302)
        
    except Exception as e:
        # Redirect to frontend with error
        frontend_url = settings.frontend_url or "http://localhost:3002"
        error_msg = str(e).replace(" ", "+")
        return RedirectResponse(
            url=f"{frontend_url}/login?error={error_msg}",
            status_code=302
        )


@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user with email/password."""
    # Check if email already exists
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        password_hash=get_password_hash(user_data.password),
        settings={}
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return user


@router.post("/login", response_model=Token)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """Login with email/password and get JWT token."""
    result = await db.execute(
        select(User).where(User.email == credentials.email)
    )
    user = result.scalar_one_or_none()
    
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive"
        )
    
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.jwt_access_token_expire_minutes * 60
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    current_user: User = Depends(get_current_user)
):
    """Refresh JWT access token."""
    access_token = create_access_token(
        data={"sub": str(current_user.id)},
        expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.jwt_access_token_expire_minutes * 60
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user info."""
    return current_user


@router.post("/logout")
async def logout():
    """
    Logout user.
    Note: With JWT, actual logout is handled client-side by discarding the token.
    This endpoint can be used for logging/analytics.
    """
    return {"message": "Logged out successfully"}

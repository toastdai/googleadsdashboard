"""
Google Ads API Service

Handles OAuth2 flow and Google Ads API interactions.
"""

import json
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
import asyncio

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
import httpx

from app.config import settings


class GoogleAdsService:
    """Service for interacting with Google Ads API."""
    
    SCOPES = [
        "openid",
        "https://www.googleapis.com/auth/adwords",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
    ]
    
    def __init__(self):
        self.client_id = settings.google_ads_client_id
        self.client_secret = settings.google_ads_client_secret
        self.developer_token = settings.google_ads_developer_token
        self.redirect_uri = settings.oauth_redirect_uri
        self.login_customer_id = settings.google_ads_login_customer_id
    
    def get_authorization_url(self) -> str:
        """Generate OAuth2 authorization URL for user consent."""
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=self.SCOPES,
            redirect_uri=self.redirect_uri
        )
        
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent"
        )
        
        return auth_url
    
    def exchange_code(self, code: str) -> Credentials:
        """Exchange authorization code for credentials."""
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=self.SCOPES,
            redirect_uri=self.redirect_uri
        )
        
        flow.fetch_token(code=code)
        return flow.credentials
    
    async def get_user_info(self, credentials: Credentials) -> Dict[str, Any]:
        """Get user info from Google."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {credentials.token}"}
            )
            response.raise_for_status()
            return response.json()
    
    async def get_accessible_accounts(self, credentials: Credentials) -> List[Dict[str, Any]]:
        """Get list of accessible Google Ads accounts."""
        print(f"DEBUG get_accessible_accounts: Starting, refresh_token exists = {bool(credentials.refresh_token)}")
        try:
            client = self._create_client(credentials.refresh_token)
            
            # Query accessible customers
            customer_service = client.get_service("CustomerService")
            print("DEBUG get_accessible_accounts: Getting accessible customers...")
            accessible = customer_service.list_accessible_customers()
            
            print(f"DEBUG get_accessible_accounts: Found {len(accessible.resource_names)} resource names")
            
            accounts = []
            for resource_name in accessible.resource_names:
                customer_id = resource_name.split("/")[1]
                print(f"DEBUG get_accessible_accounts: Checking customer {customer_id}")
                
                try:
                    # Get customer details
                    ga_service = client.get_service("GoogleAdsService")
                    query = """
                        SELECT
                            customer.id,
                            customer.descriptive_name,
                            customer.currency_code,
                            customer.manager
                        FROM customer
                        LIMIT 1
                    """
                    
                    response = ga_service.search(customer_id=customer_id, query=query)
                    
                    for row in response:
                        account_data = {
                            "customer_id": str(row.customer.id),
                            "name": row.customer.descriptive_name or f"Account {row.customer.id}",
                            "currency_code": row.customer.currency_code,
                            "is_manager": row.customer.manager
                        }
                        print(f"DEBUG get_accessible_accounts: Added account {account_data['customer_id']} (manager={account_data['is_manager']})")
                        accounts.append(account_data)
                        break
                        
                except GoogleAdsException as gae:
                    # Skip accounts we can't access
                    print(f"DEBUG get_accessible_accounts: GoogleAdsException for {customer_id}: {gae}")
                    continue
                except Exception as e:
                    print(f"DEBUG get_accessible_accounts: Error for {customer_id}: {e}")
                    continue
            
            print(f"DEBUG get_accessible_accounts: Returning {len(accounts)} accounts")
            return accounts
            
        except Exception as e:
            # Log error but return empty list
            print(f"DEBUG get_accessible_accounts: Fatal error: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    async def validate_account_access(
        self,
        customer_id: str,
        refresh_token: str
    ) -> bool:
        """Validate that we can access a specific account."""
        try:
            client = self._create_client(refresh_token)
            ga_service = client.get_service("GoogleAdsService")
            
            query = "SELECT customer.id FROM customer LIMIT 1"
            response = ga_service.search(customer_id=customer_id, query=query)
            
            # If we get here, we have access
            return True
            
        except GoogleAdsException as e:
            raise Exception(f"Cannot access account: {e.failure.errors[0].message}")
    
    def _create_client(self, refresh_token: str) -> GoogleAdsClient:
        """Create a Google Ads API client with the given refresh token."""
        config = {
            "developer_token": self.developer_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "use_proto_plus": True,
        }
        
        if self.login_customer_id:
            # Ensure it's formatted as string without hyphens
            formatted_id = str(self.login_customer_id).replace("-", "")
            print(f"DEBUG _create_client: login_customer_id = {formatted_id}, len = {len(formatted_id)}")
            config["login_customer_id"] = formatted_id
        else:
            print("DEBUG _create_client: No login_customer_id set")
        
        return GoogleAdsClient.load_from_dict(config)
    
    async def fetch_campaigns(
        self,
        customer_id: str,
        refresh_token: str
    ) -> List[Dict[str, Any]]:
        """Fetch all campaigns for an account."""
        client = self._create_client(refresh_token)
        ga_service = client.get_service("GoogleAdsService")
        
        query = """
            SELECT
                campaign.id,
                campaign.name,
                campaign.status,
                campaign.advertising_channel_type
            FROM campaign
            WHERE campaign.status != 'REMOVED'
            ORDER BY campaign.name
        """
        
        campaigns = []
        response = ga_service.search(customer_id=customer_id, query=query)
        
        for row in response:
            campaigns.append({
                "google_campaign_id": str(row.campaign.id),
                "name": row.campaign.name,
                "status": row.campaign.status.name,
                "campaign_type": row.campaign.advertising_channel_type.name
            })
        
        return campaigns
    
    async def fetch_ad_groups(
        self,
        customer_id: str,
        refresh_token: str,
        campaign_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Fetch ad groups for an account or specific campaign."""
        client = self._create_client(refresh_token)
        ga_service = client.get_service("GoogleAdsService")
        
        query = """
            SELECT
                ad_group.id,
                ad_group.name,
                ad_group.status,
                ad_group.campaign
            FROM ad_group
            WHERE ad_group.status != 'REMOVED'
        """
        
        if campaign_id:
            query += f" AND ad_group.campaign = 'customers/{customer_id}/campaigns/{campaign_id}'"
        
        ad_groups = []
        response = ga_service.search(customer_id=customer_id, query=query)
        
        for row in response:
            campaign_resource = row.ad_group.campaign
            google_campaign_id = campaign_resource.split("/")[-1]
            
            ad_groups.append({
                "google_adgroup_id": str(row.ad_group.id),
                "name": row.ad_group.name,
                "status": row.ad_group.status.name,
                "google_campaign_id": google_campaign_id
            })
        
        return ad_groups
    
    async def fetch_daily_metrics(
        self,
        customer_id: str,
        refresh_token: str,
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        """Fetch daily performance metrics for campaigns."""
        client = self._create_client(refresh_token)
        ga_service = client.get_service("GoogleAdsService")
        
        query = f"""
            SELECT
                segments.date,
                segments.device,
                segments.ad_network_type,
                campaign.id,
                campaign.name,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value
            FROM campaign
            WHERE segments.date >= '{start_date.strftime("%Y-%m-%d")}'
                AND segments.date <= '{end_date.strftime("%Y-%m-%d")}'
            ORDER BY segments.date, campaign.id
        """
        
        metrics = []
        response = ga_service.search(customer_id=customer_id, query=query)
        
        for row in response:
            metrics.append({
                "date": row.segments.date,
                "device": row.segments.device.name,
                "network": row.segments.ad_network_type.name,
                "google_campaign_id": str(row.campaign.id),
                "campaign_name": row.campaign.name,
                "impressions": row.metrics.impressions,
                "clicks": row.metrics.clicks,
                "cost_micros": row.metrics.cost_micros,
                "conversions": row.metrics.conversions,
                "conversion_value": row.metrics.conversions_value
            })
        
        return metrics
    
    async def fetch_hourly_metrics(
        self,
        customer_id: str,
        refresh_token: str,
        target_date: date
    ) -> List[Dict[str, Any]]:
        """Fetch hourly performance metrics for spike detection."""
        client = self._create_client(refresh_token)
        ga_service = client.get_service("GoogleAdsService")
        
        query = f"""
            SELECT
                segments.date,
                segments.hour,
                campaign.id,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions
            FROM campaign
            WHERE segments.date = '{target_date.strftime("%Y-%m-%d")}'
            ORDER BY segments.hour, campaign.id
        """
        
        metrics = []
        response = ga_service.search(customer_id=customer_id, query=query)
        
        for row in response:
            metrics.append({
                "date": row.segments.date,
                "hour": row.segments.hour,
                "google_campaign_id": str(row.campaign.id),
                "impressions": row.metrics.impressions,
                "clicks": row.metrics.clicks,
                "cost_micros": row.metrics.cost_micros,
                "conversions": row.metrics.conversions
            })
        
        return metrics

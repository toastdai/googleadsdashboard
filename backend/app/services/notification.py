"""
Notification Service

Sends alerts via email, Slack, and webhooks.
"""

from typing import Optional, Dict, Any
from datetime import datetime
import json

import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib

from app.config import settings
from app.models.alerts import NotificationChannel


class NotificationService:
    """Service for sending notifications through various channels."""
    
    def __init__(self):
        self.smtp_host = settings.smtp_host
        self.smtp_port = settings.smtp_port
        self.smtp_user = settings.smtp_user
        self.smtp_password = settings.smtp_password
        self.email_from = settings.email_from
        self.slack_webhook_url = settings.slack_webhook_url
    
    async def send_alert(
        self,
        channel: NotificationChannel,
        title: str,
        message: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Send an alert notification through the specified channel.
        
        Args:
            channel: Notification channel configuration
            title: Alert title
            message: Alert message body
            context: Additional context data
        
        Returns:
            True if sent successfully, False otherwise
        """
        if not channel.enabled:
            return False
        
        try:
            if channel.channel_type == "EMAIL":
                return await self._send_email(channel.config, title, message, context)
            elif channel.channel_type == "SLACK":
                return await self._send_slack(channel.config, title, message, context)
            elif channel.channel_type == "WEBHOOK":
                return await self._send_webhook(channel.config, title, message, context)
            elif channel.channel_type == "IN_APP":
                # In-app notifications are stored in the database
                return True
            else:
                return False
        except Exception as e:
            print(f"Failed to send notification: {e}")
            return False
    
    async def send_test(self, channel: NotificationChannel) -> bool:
        """Send a test notification to verify channel configuration."""
        return await self.send_alert(
            channel=channel,
            title="[TEST] TellSpike Alert Test",
            message="This is a test notification from TellSpike. If you receive this, your notification channel is configured correctly.",
            context={"test": True, "timestamp": datetime.utcnow().isoformat()}
        )
    
    async def _send_email(
        self,
        config: Dict[str, Any],
        title: str,
        message: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Send email notification."""
        if not self.smtp_host or not self.smtp_user:
            raise Exception("SMTP not configured")
        
        recipient = config.get("email")
        if not recipient:
            raise Exception("Email recipient not specified")
        
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = title
        msg["From"] = self.email_from
        msg["To"] = recipient
        
        # Plain text version
        text_content = f"{title}\n\n{message}"
        if context:
            text_content += f"\n\nContext:\n{json.dumps(context, indent=2)}"
        
        # HTML version
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">{title}</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="font-size: 16px; color: #333;">{message}</p>
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                <p style="font-size: 12px; color: #666;">
                    This alert was sent by TellSpike - your Google Ads monitoring tool.
                </p>
            </div>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))
        
        # Send email
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.sendmail(self.email_from, recipient, msg.as_string())
        
        return True
    
    async def _send_slack(
        self,
        config: Dict[str, Any],
        title: str,
        message: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Send Slack notification via webhook."""
        webhook_url = config.get("webhook_url") or self.slack_webhook_url
        if not webhook_url:
            raise Exception("Slack webhook URL not configured")
        
        # Determine color based on severity in context
        severity = context.get("severity", "INFO") if context else "INFO"
        color_map = {
            "INFO": "#36a64f",
            "WARNING": "#ffa500",
            "CRITICAL": "#ff0000"
        }
        color = color_map.get(severity, "#36a64f")
        
        # Build Slack message
        payload = {
            "attachments": [
                {
                    "color": color,
                    "title": title,
                    "text": message,
                    "footer": "TellSpike Alert",
                    "ts": int(datetime.utcnow().timestamp())
                }
            ]
        }
        
        if context:
            fields = []
            for key, value in context.items():
                if key not in ["severity", "test"]:
                    fields.append({
                        "title": key.replace("_", " ").title(),
                        "value": str(value),
                        "short": True
                    })
            if fields:
                payload["attachments"][0]["fields"] = fields
        
        # Send to Slack
        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=payload)
            response.raise_for_status()
        
        return True
    
    async def _send_webhook(
        self,
        config: Dict[str, Any],
        title: str,
        message: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Send generic webhook notification."""
        webhook_url = config.get("url")
        if not webhook_url:
            raise Exception("Webhook URL not configured")
        
        headers = config.get("headers", {})
        
        payload = {
            "title": title,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
            "source": "tellspike",
            "context": context or {}
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=payload,
                headers=headers
            )
            response.raise_for_status()
        
        return True
    
    async def send_daily_summary(
        self,
        channel: NotificationChannel,
        summary_data: Dict[str, Any]
    ) -> bool:
        """Send daily summary report."""
        title = f"[DAILY] TellSpike Summary - {datetime.utcnow().strftime('%Y-%m-%d')}"
        
        message_parts = [
            f"Total Spend: {summary_data.get('total_spend', 0):.2f}",
            f"Conversions: {summary_data.get('conversions', 0):.0f}",
            f"ROAS: {summary_data.get('roas', 0):.2f}x",
            f"Alerts: {summary_data.get('alert_count', 0)} new"
        ]
        
        message = "\n".join(message_parts)
        
        return await self.send_alert(channel, title, message, summary_data)

"""
WhatsApp Notification Service using Twilio
"""
import os
import logging
from typing import Optional
from twilio.rest import Client
from twilio.base.exceptions import TwilioException

logger = logging.getLogger(__name__)


class WhatsAppService:
    """Service for sending WhatsApp notifications via Twilio."""
    
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.from_number = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")  # Twilio sandbox default
        self.to_number = os.getenv("ALERT_WHATSAPP_NUMBER")  # User's WhatsApp number
        
        self.client: Optional[Client] = None
        self._configured = False
        
        if self.account_sid and self.auth_token and self.to_number:
            try:
                self.client = Client(self.account_sid, self.auth_token)
                self._configured = True
                logger.info("WhatsApp service initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Twilio client: {e}")
        else:
            logger.warning("WhatsApp service not configured - missing credentials")
    
    @property
    def is_configured(self) -> bool:
        """Check if the service is properly configured."""
        return self._configured
    
    def send_message(self, message: str) -> dict:
        """
        Send a WhatsApp message.
        
        Args:
            message: The message text to send
            
        Returns:
            dict with status and message_sid or error
        """
        if not self._configured:
            return {
                "success": False,
                "error": "WhatsApp service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and ALERT_WHATSAPP_NUMBER"
            }
        
        try:
            # Format the to number for WhatsApp
            to_whatsapp = self.to_number if self.to_number.startswith("whatsapp:") else f"whatsapp:{self.to_number}"
            
            msg = self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=to_whatsapp
            )
            
            logger.info(f"WhatsApp message sent: {msg.sid}")
            return {
                "success": True,
                "message_sid": msg.sid,
                "status": msg.status
            }
            
        except TwilioException as e:
            logger.error(f"Twilio error: {e}")
            return {
                "success": False,
                "error": f"Twilio error: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Failed to send WhatsApp message: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def send_spike_alert(
        self,
        metric_name: str,
        network: str,
        current_value: float,
        previous_value: float,
        change_percent: float,
        direction: str  # "up" or "down"
    ) -> dict:
        """
        Send a formatted spike alert message.
        
        Args:
            metric_name: Name of the metric (e.g., "Leads", "Revenue")
            network: Network name (e.g., "Kelkoo", "Admedia", "MaxBounty")
            current_value: Current metric value
            previous_value: Previous metric value
            change_percent: Percentage change
            direction: "up" for increase, "down" for decrease
            
        Returns:
            dict with status
        """
        emoji = "📈" if direction == "up" else "📉"
        trend = "increased" if direction == "up" else "decreased"
        
        message = f"""
{emoji} *SPIKE ALERT - {network}*

*Metric:* {metric_name}
*Change:* {trend} by {abs(change_percent):.1f}%

Previous: {previous_value:,.2f}
Current: {current_value:,.2f}

_TellSpike Dashboard Alert_
"""
        return self.send_message(message.strip())


# Singleton instance
_whatsapp_service: Optional[WhatsAppService] = None


def get_whatsapp_service() -> WhatsAppService:
    """Get the singleton WhatsApp service instance."""
    global _whatsapp_service
    if _whatsapp_service is None:
        _whatsapp_service = WhatsAppService()
    return _whatsapp_service

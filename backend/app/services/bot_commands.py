"""
Telegram Bot Command Handler
Interactive commands for alert management
"""
import os
import logging
import httpx
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class TelegramBotCommands:
    """Handles Telegram bot commands for interactive alert management."""
    
    COMMANDS = {
        "/start": "Welcome message and setup instructions",
        "/help": "Show available commands",
        "/status": "Check alert system status",
        "/check": "Manually trigger spike check now",
        "/config": "View current configuration",
        "/threshold": "Set spike threshold (e.g., /threshold 25)",
        "/pause": "Pause alerts temporarily",
        "/resume": "Resume alerts",
    }
    
    def __init__(self):
        self.bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.api_base = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else None
        self.last_update_id = 0
    
    async def send_message(self, chat_id: int, text: str, parse_mode: str = "Markdown") -> dict:
        """Send a message to a chat."""
        if not self.api_base:
            return {"success": False, "error": "Bot not configured"}
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{self.api_base}/sendMessage",
                    json={
                        "chat_id": chat_id,
                        "text": text,
                        "parse_mode": parse_mode,
                        "disable_web_page_preview": True
                    }
                )
                return response.json()
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            return {"success": False, "error": str(e)}
    
    async def handle_start(self, chat_id: int) -> str:
        """Handle /start command."""
        return f"""
🚀 *Welcome to TellSpike Alerts!*

Your bot is now connected and ready to send alerts.

*Your Chat ID:* `{chat_id}`

*What I'll alert you about:*
• Kelkoo: Leads & Revenue changes
• Admedia: Leads & Earnings changes  
• MaxBounty: Leads & Earnings changes

*Alert Threshold:* >{os.getenv('SPIKE_THRESHOLD_PERCENT', '20')}% change

Type /help to see all commands.

_Powered by TellSpike Dashboard_
🔗 [Open Dashboard](https://googleadsdashboard-beta.vercel.app/dashboard)
"""
    
    async def handle_help(self) -> str:
        """Handle /help command."""
        commands_text = "\n".join([f"• `{cmd}` - {desc}" for cmd, desc in self.COMMANDS.items()])
        return f"""
📚 *Available Commands*

{commands_text}

_Send any command to interact with your alerts._
"""
    
    async def handle_status(self) -> str:
        """Handle /status command."""
        from .scheduler import get_scheduler_status
        from .telegram import get_telegram_service
        
        scheduler = get_scheduler_status()
        telegram = await get_telegram_service()
        
        status_emoji = "🟢" if scheduler.get("running") else "🔴"
        next_check = scheduler.get("next_run", "Unknown")
        if next_check and next_check != "Unknown":
            try:
                next_dt = datetime.fromisoformat(next_check.replace("Z", "+00:00"))
                next_check = next_dt.strftime("%H:%M:%S")
            except:
                pass
        
        return f"""
📊 *Alert System Status*

{status_emoji} *Scheduler:* {"Running" if scheduler.get("running") else "Stopped"}
⏱ *Check Interval:* Every {scheduler.get("interval_minutes", 60)} minutes
🕐 *Next Check:* {next_check}
🔔 *Telegram:* {"Connected" if telegram.is_configured else "Not configured"}
📈 *Threshold:* {os.getenv('SPIKE_THRESHOLD_PERCENT', '20')}% change

_Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}_
"""
    
    async def handle_check(self) -> str:
        """Handle /check command - trigger manual spike check."""
        from .spike_detector import get_spike_detector
        
        detector = get_spike_detector()
        result = await detector.check_and_alert()
        
        spikes = result.get("spikes_detected", 0)
        alerts = result.get("alerts_sent", 0)
        
        if spikes == 0:
            return """
✅ *Spike Check Complete*

No significant changes detected in your metrics.

All networks are operating within normal parameters:
• Kelkoo ✓
• Admedia ✓
• MaxBounty ✓

_Check ran at: {}_
""".format(datetime.now().strftime('%H:%M:%S'))
        else:
            return f"""
⚠️ *Spike Check Complete*

*{spikes}* spike(s) detected!
*{alerts}* alert(s) sent.

_Check the individual alerts above for details._
"""
    
    async def handle_config(self) -> str:
        """Handle /config command."""
        threshold = os.getenv('SPIKE_THRESHOLD_PERCENT', '20')
        interval = os.getenv('SPIKE_CHECK_INTERVAL_MINUTES', '60')
        frontend = os.getenv('FRONTEND_URL', 'https://googleadsdashboard-beta.vercel.app')
        
        return f"""
⚙️ *Current Configuration*

*Spike Threshold:* {threshold}%
*Check Interval:* {interval} minutes
*Dashboard URL:* [Open]({frontend}/dashboard)

*Monitored Networks:*
• Kelkoo (Leads, Revenue EUR)
• Admedia (Leads, Earnings USD)
• MaxBounty (Leads, Earnings USD)

_To change settings, update environment variables on Render._
"""
    
    async def process_command(self, chat_id: int, text: str) -> Optional[str]:
        """Process a command and return the response."""
        text = text.strip().lower()
        
        if text.startswith("/start"):
            return await self.handle_start(chat_id)
        elif text.startswith("/help"):
            return await self.handle_help()
        elif text.startswith("/status"):
            return await self.handle_status()
        elif text.startswith("/check"):
            return await self.handle_check()
        elif text.startswith("/config"):
            return await self.handle_config()
        elif text.startswith("/threshold"):
            # Parse threshold value
            parts = text.split()
            if len(parts) >= 2:
                try:
                    new_threshold = float(parts[1])
                    return f"⚠️ To change threshold to {new_threshold}%, update `SPIKE_THRESHOLD_PERCENT` in Render environment variables."
                except ValueError:
                    return "❌ Invalid threshold value. Use: `/threshold 25`"
            return f"📊 Current threshold: {os.getenv('SPIKE_THRESHOLD_PERCENT', '20')}%\n\nTo change, use: `/threshold <value>`"
        elif text.startswith("/pause"):
            return "⏸ Alert pausing is not yet implemented. Alerts will continue running."
        elif text.startswith("/resume"):
            return "▶️ Alerts are already running."
        
        return None
    
    async def poll_updates(self) -> None:
        """Poll for new messages and process commands."""
        if not self.api_base:
            return
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(
                    f"{self.api_base}/getUpdates",
                    params={"offset": self.last_update_id + 1, "timeout": 5}
                )
                data = response.json()
                
                if data.get("ok") and data.get("result"):
                    for update in data["result"]:
                        self.last_update_id = update["update_id"]
                        
                        if "message" in update and "text" in update["message"]:
                            chat_id = update["message"]["chat"]["id"]
                            text = update["message"]["text"]
                            
                            if text.startswith("/"):
                                response_text = await self.process_command(chat_id, text)
                                if response_text:
                                    await self.send_message(chat_id, response_text)
        except Exception as e:
            logger.error(f"Error polling updates: {e}")


# Singleton instance
_bot_commands: Optional[TelegramBotCommands] = None


def get_bot_commands() -> TelegramBotCommands:
    """Get the singleton bot commands instance."""
    global _bot_commands
    if _bot_commands is None:
        _bot_commands = TelegramBotCommands()
    return _bot_commands

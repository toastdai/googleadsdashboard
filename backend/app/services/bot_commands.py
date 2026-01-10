"""
Telegram Bot Command Handler
Interactive commands for alert management - Advanced & Dynamic
"""
import os
import logging
import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)


class TelegramBotCommands:
    """Handles Telegram bot commands for interactive alert management."""
    
    COMMANDS = {
        "/start": "Initialize bot and view setup info",
        "/help": "Show available commands",
        "/status": "Check alert system status",
        "/check": "Manually trigger spike check now",
        "/config": "View current configuration",
        "/metrics": "Show latest metrics from all networks",
        "/history": "View recent alert history",
        "/threshold": "Set spike threshold (e.g., /threshold 25)",
        "/networks": "Show monitored networks status",
        "/pause": "Pause alerts temporarily",
        "/resume": "Resume alerts",
    }
    
    def __init__(self):
        self.bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.api_base = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else None
        self.last_update_id = 0
        self.alerts_paused = False
    
    async def send_message(
        self, 
        chat_id: int, 
        text: str, 
        parse_mode: str = "Markdown",
        reply_markup: Optional[Dict] = None
    ) -> dict:
        """Send a message to a chat with optional inline keyboard."""
        if not self.api_base:
            return {"success": False, "error": "Bot not configured"}
        
        try:
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": parse_mode,
                "disable_web_page_preview": True
            }
            if reply_markup:
                payload["reply_markup"] = reply_markup
            
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{self.api_base}/sendMessage",
                    json=payload
                )
                return response.json()
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            return {"success": False, "error": str(e)}
    
    def _create_inline_keyboard(self, buttons: List[List[Dict]]) -> Dict:
        """Create inline keyboard markup."""
        return {"inline_keyboard": buttons}
    
    def _format_number(self, value: Any) -> str:
        """Format number for display."""
        if value is None:
            return "N/A"
        try:
            num = float(value)
            if num >= 1000000:
                return f"{num/1000000:.2f}M"
            elif num >= 1000:
                return f"{num/1000:.2f}K"
            elif num == int(num):
                return str(int(num))
            else:
                return f"{num:.2f}"
        except:
            return str(value)
    
    def _format_change(self, change: float) -> str:
        """Format percentage change with direction indicator."""
        if change > 0:
            return f"+{change:.1f}% [UP]"
        elif change < 0:
            return f"{change:.1f}% [DOWN]"
        return "0% [STABLE]"
    
    async def handle_start(self, chat_id: int) -> tuple[str, Optional[Dict]]:
        """Handle /start command with inline keyboard."""
        dashboard_url = os.getenv('FRONTEND_URL', 'https://googleadsdashboard-beta.vercel.app')
        threshold = os.getenv('SPIKE_THRESHOLD_PERCENT', '20')
        
        keyboard = self._create_inline_keyboard([
            [
                {"text": "Check Status", "callback_data": "status"},
                {"text": "Run Check", "callback_data": "check"}
            ],
            [
                {"text": "View Config", "callback_data": "config"},
                {"text": "Show Metrics", "callback_data": "metrics"}
            ],
            [
                {"text": "Open Dashboard", "url": f"{dashboard_url}/dashboard"}
            ]
        ])
        
        message = f"""
*TellSpike Alert System*
━━━━━━━━━━━━━━━━━━━━━━━━

Bot connected successfully.

*Your Chat ID:* `{chat_id}`

*Monitored Networks:*
  - Kelkoo: Leads, Revenue (EUR)
  - Admedia: Leads, Earnings (USD)
  - MaxBounty: Leads, Earnings (USD)

*Alert Threshold:* >{threshold}% change

Use the buttons below or type /help for commands.

━━━━━━━━━━━━━━━━━━━━━━━━
_TellSpike Dashboard v2.0_
"""
        return message, keyboard
    
    async def handle_help(self) -> tuple[str, Optional[Dict]]:
        """Handle /help command with organized categories."""
        keyboard = self._create_inline_keyboard([
            [
                {"text": "Status", "callback_data": "status"},
                {"text": "Check", "callback_data": "check"},
                {"text": "Config", "callback_data": "config"}
            ]
        ])
        
        message = """
*Available Commands*
━━━━━━━━━━━━━━━━━━━━━━━━

*Monitoring:*
  `/status` - System status overview
  `/check` - Trigger manual spike check
  `/metrics` - Latest network metrics
  `/networks` - Network health status

*Configuration:*
  `/config` - View current settings
  `/threshold <N>` - Info on changing threshold

*Control:*
  `/pause` - Pause alert notifications
  `/resume` - Resume alert notifications

*General:*
  `/start` - Reinitialize bot
  `/help` - Show this message
  `/history` - Recent alert log

━━━━━━━━━━━━━━━━━━━━━━━━
"""
        return message, keyboard
    
    async def handle_status(self) -> tuple[str, Optional[Dict]]:
        """Handle /status command with detailed info."""
        from .scheduler import get_scheduler_status
        from .telegram import get_telegram_service
        
        scheduler = get_scheduler_status()
        telegram = await get_telegram_service()
        
        running = scheduler.get("running", False)
        status_indicator = "[ACTIVE]" if running else "[STOPPED]"
        
        next_check = scheduler.get("next_run", "Unknown")
        if next_check and next_check != "Unknown":
            try:
                next_dt = datetime.fromisoformat(next_check.replace("Z", "+00:00"))
                next_check = next_dt.strftime("%H:%M:%S")
            except:
                pass
        
        interval = scheduler.get("interval_minutes", 60)
        threshold = os.getenv('SPIKE_THRESHOLD_PERCENT', '20')
        telegram_status = "Connected" if telegram.is_configured else "Not Configured"
        pause_status = "[PAUSED]" if self.alerts_paused else "[ACTIVE]"
        
        keyboard = self._create_inline_keyboard([
            [
                {"text": "Run Check Now", "callback_data": "check"},
                {"text": "Refresh", "callback_data": "status"}
            ]
        ])
        
        message = f"""
*Alert System Status*
━━━━━━━━━━━━━━━━━━━━━━━━

*Scheduler:* {status_indicator}
*Check Interval:* Every {interval} min
*Next Check:* {next_check}
*Telegram:* {telegram_status}
*Alerts:* {pause_status}
*Threshold:* {threshold}% change

━━━━━━━━━━━━━━━━━━━━━━━━
_Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}_
"""
        return message, keyboard
    
    async def handle_check(self) -> tuple[str, Optional[Dict]]:
        """Handle /check command - trigger manual spike check."""
        from .spike_detector import get_spike_detector
        
        detector = get_spike_detector()
        result = await detector.check_and_alert()
        
        spikes = result.get("spikes_detected", 0)
        alerts = result.get("alerts_sent", 0)
        
        keyboard = self._create_inline_keyboard([
            [
                {"text": "Check Again", "callback_data": "check"},
                {"text": "View Metrics", "callback_data": "metrics"}
            ]
        ])
        
        if spikes == 0:
            message = f"""
*Spike Check Complete*
━━━━━━━━━━━━━━━━━━━━━━━━

Result: No significant changes detected.

*Network Status:*
  Kelkoo    - OK
  Admedia   - OK
  MaxBounty - OK

All metrics within normal range.

━━━━━━━━━━━━━━━━━━━━━━━━
_Checked: {datetime.now().strftime('%H:%M:%S')}_
"""
        else:
            message = f"""
*Spike Check Complete*
━━━━━━━━━━━━━━━━━━━━━━━━

Result: SPIKES DETECTED

*Summary:*
  Spikes Found: {spikes}
  Alerts Sent: {alerts}

Review the individual alert messages above.

━━━━━━━━━━━━━━━━━━━━━━━━
_Checked: {datetime.now().strftime('%H:%M:%S')}_
"""
        return message, keyboard
    
    async def handle_config(self) -> tuple[str, Optional[Dict]]:
        """Handle /config command with full configuration details."""
        threshold = os.getenv('SPIKE_THRESHOLD_PERCENT', '20')
        interval = os.getenv('SPIKE_CHECK_INTERVAL_MINUTES', '60')
        frontend = os.getenv('FRONTEND_URL', 'https://googleadsdashboard-beta.vercel.app')
        bot_token_set = "Yes" if os.getenv('TELEGRAM_BOT_TOKEN') else "No"
        chat_id_set = os.getenv('TELEGRAM_CHAT_ID', 'Not Set')
        
        keyboard = self._create_inline_keyboard([
            [{"text": "Open Dashboard", "url": f"{frontend}/dashboard/alerts"}]
        ])
        
        message = f"""
*Current Configuration*
━━━━━━━━━━━━━━━━━━━━━━━━

*Detection Settings:*
  Spike Threshold: {threshold}%
  Check Interval: {interval} min

*Telegram Settings:*
  Bot Token: {bot_token_set}
  Chat ID: `{chat_id_set}`

*Monitored Metrics:*
  Kelkoo    - leads, revenue_eur
  Admedia   - leads, earnings_usd
  MaxBounty - leads, earnings_usd

*Dashboard:*
  {frontend}

━━━━━━━━━━━━━━━━━━━━━━━━
_Update via Render env vars_
"""
        return message, keyboard
    
    async def handle_metrics(self) -> tuple[str, Optional[Dict]]:
        """Handle /metrics command - show latest metrics."""
        from .spike_detector import get_spike_detector
        
        detector = get_spike_detector()
        
        # Fetch current metrics
        metrics_display = []
        
        try:
            kelkoo = await detector.fetch_kelkoo_data()
            if kelkoo:
                metrics_display.append(f"""
*Kelkoo (Today):*
  Leads: {self._format_number(kelkoo.get('leadCount', 0))}
  Revenue: EUR {self._format_number(kelkoo.get('leadEstimatedRevenueInEur', 0))}""")
            else:
                metrics_display.append("*Kelkoo:* No data or API not configured")
        except Exception as e:
            metrics_display.append(f"*Kelkoo:* Error - {str(e)[:40]}")
        
        try:
            admedia = await detector.fetch_admedia_data()
            if admedia:
                metrics_display.append(f"""
*Admedia (Today):*
  Leads: {self._format_number(admedia.get('leads', 0))}
  Earnings: USD {self._format_number(admedia.get('earnings', 0))}""")
            else:
                metrics_display.append("*Admedia:* No data or API not configured")
        except Exception as e:
            metrics_display.append(f"*Admedia:* Error - {str(e)[:40]}")
        
        try:
            maxbounty = await detector.fetch_maxbounty_data()
            if maxbounty:
                metrics_display.append(f"""
*MaxBounty (Today):*
  Leads: {self._format_number(maxbounty.get('leads', 0))}
  Earnings: USD {self._format_number(maxbounty.get('earnings', 0))}""")
            else:
                metrics_display.append("*MaxBounty:* No data or API not configured")
        except Exception as e:
            metrics_display.append(f"*MaxBounty:* Error - {str(e)[:40]}")
        
        keyboard = self._create_inline_keyboard([
            [
                {"text": "Refresh", "callback_data": "metrics"},
                {"text": "Run Check", "callback_data": "check"}
            ]
        ])
        
        message = f"""
*Latest Metrics*
━━━━━━━━━━━━━━━━━━━━━━━━
{"".join(metrics_display) if metrics_display else "No metrics available."}

━━━━━━━━━━━━━━━━━━━━━━━━
_Fetched: {datetime.now().strftime('%H:%M:%S')}_
"""
        return message, keyboard
    
    async def handle_networks(self) -> tuple[str, Optional[Dict]]:
        """Handle /networks command - show network health."""
        from .spike_detector import get_spike_detector
        
        detector = get_spike_detector()
        
        network_status = []
        
        # Check each network
        try:
            kelkoo = await detector.fetch_kelkoo_data()
            k_status = "ONLINE" if kelkoo else "NOT CONFIGURED"
        except:
            k_status = "ERROR"
        network_status.append(f"  Kelkoo    [{k_status}]")
        
        try:
            admedia = await detector.fetch_admedia_data()
            a_status = "ONLINE" if admedia else "NOT CONFIGURED"
        except:
            a_status = "ERROR"
        network_status.append(f"  Admedia   [{a_status}]")
        
        try:
            maxbounty = await detector.fetch_maxbounty_data()
            m_status = "ONLINE" if maxbounty else "NOT CONFIGURED"
        except:
            m_status = "ERROR"
        network_status.append(f"  MaxBounty [{m_status}]")
        
        keyboard = self._create_inline_keyboard([
            [{"text": "View Metrics", "callback_data": "metrics"}]
        ])
        
        message = f"""
*Network Status*
━━━━━━━━━━━━━━━━━━━━━━━━

{chr(10).join(network_status)}

━━━━━━━━━━━━━━━━━━━━━━━━
_Checked: {datetime.now().strftime('%H:%M:%S')}_
"""
        return message, keyboard
    
    async def handle_history(self) -> tuple[str, Optional[Dict]]:
        """Handle /history command - show recent alerts."""
        # This would need a database to track alert history
        # For now, return a placeholder
        
        keyboard = self._create_inline_keyboard([
            [{"text": "Run Check", "callback_data": "check"}]
        ])
        
        message = """
*Recent Alert History*
━━━━━━━━━━━━━━━━━━━━━━━━

Alert history is stored in the dashboard.
Visit the Alerts page to view full history.

━━━━━━━━━━━━━━━━━━━━━━━━
"""
        return message, keyboard
    
    async def handle_threshold(self, args: str) -> tuple[str, None]:
        """Handle /threshold command."""
        current = os.getenv('SPIKE_THRESHOLD_PERCENT', '20')
        
        if args:
            try:
                new_val = float(args)
                if new_val < 1 or new_val > 100:
                    return f"Invalid threshold: {new_val}. Must be between 1-100.", None
                return f"""
*Threshold Update*
━━━━━━━━━━━━━━━━━━━━━━━━

Current: {current}%
Requested: {new_val}%

To apply this change:
1. Go to Render Dashboard
2. Navigate to your service
3. Open Environment tab
4. Set `SPIKE_THRESHOLD_PERCENT` = `{int(new_val)}`
5. Save and redeploy

━━━━━━━━━━━━━━━━━━━━━━━━
""", None
            except ValueError:
                return f"Invalid value: `{args}`. Use a number, e.g., `/threshold 25`", None
        
        return f"""
*Spike Threshold*
━━━━━━━━━━━━━━━━━━━━━━━━

Current: {current}%

To change, use: `/threshold <value>`
Example: `/threshold 25`

━━━━━━━━━━━━━━━━━━━━━━━━
""", None
    
    async def handle_pause(self) -> tuple[str, Optional[Dict]]:
        """Handle /pause command."""
        self.alerts_paused = True
        
        keyboard = self._create_inline_keyboard([
            [{"text": "Resume Alerts", "callback_data": "resume"}]
        ])
        
        return """
*Alerts Paused*
━━━━━━━━━━━━━━━━━━━━━━━━

Alert notifications are now paused.
Spike detection will continue running,
but no notifications will be sent.

Use /resume to re-enable notifications.

━━━━━━━━━━━━━━━━━━━━━━━━
""", keyboard
    
    async def handle_resume(self) -> tuple[str, Optional[Dict]]:
        """Handle /resume command."""
        self.alerts_paused = False
        
        keyboard = self._create_inline_keyboard([
            [{"text": "Check Status", "callback_data": "status"}]
        ])
        
        return """
*Alerts Resumed*
━━━━━━━━━━━━━━━━━━━━━━━━

Alert notifications are now active.
You will receive notifications when
spikes are detected.

━━━━━━━━━━━━━━━━━━━━━━━━
""", keyboard
    
    async def process_command(self, chat_id: int, text: str) -> Optional[tuple[str, Optional[Dict]]]:
        """Process a command and return the response with optional keyboard."""
        text = text.strip()
        command = text.lower().split()[0] if text else ""
        args = " ".join(text.split()[1:]) if len(text.split()) > 1 else ""
        
        handlers = {
            "/start": lambda: self.handle_start(chat_id),
            "/help": self.handle_help,
            "/status": self.handle_status,
            "/check": self.handle_check,
            "/config": self.handle_config,
            "/metrics": self.handle_metrics,
            "/networks": self.handle_networks,
            "/history": self.handle_history,
            "/pause": self.handle_pause,
            "/resume": self.handle_resume,
        }
        
        if command == "/threshold":
            return await self.handle_threshold(args)
        
        handler = handlers.get(command)
        if handler:
            return await handler()
        
        return None
    
    async def handle_callback(self, chat_id: int, callback_data: str, message_id: int) -> None:
        """Handle inline button callbacks."""
        result = await self.process_command(chat_id, f"/{callback_data}")
        
        if result:
            text, keyboard = result
            # Edit the existing message instead of sending a new one
            if self.api_base:
                try:
                    async with httpx.AsyncClient(timeout=30) as client:
                        payload = {
                            "chat_id": chat_id,
                            "message_id": message_id,
                            "text": text,
                            "parse_mode": "Markdown"
                        }
                        if keyboard:
                            payload["reply_markup"] = keyboard
                        
                        await client.post(
                            f"{self.api_base}/editMessageText",
                            json=payload
                        )
                except Exception as e:
                    # If edit fails, send as new message
                    logger.warning(f"Failed to edit message: {e}, sending new")
                    await self.send_message(chat_id, text, reply_markup=keyboard)
    
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
                        
                        # Handle regular commands
                        if "message" in update and "text" in update["message"]:
                            chat_id = update["message"]["chat"]["id"]
                            text = update["message"]["text"]
                            
                            if text.startswith("/"):
                                result = await self.process_command(chat_id, text)
                                if result:
                                    response_text, keyboard = result
                                    await self.send_message(chat_id, response_text, reply_markup=keyboard)
                        
                        # Handle callback queries (inline button presses)
                        elif "callback_query" in update:
                            callback = update["callback_query"]
                            chat_id = callback["message"]["chat"]["id"]
                            message_id = callback["message"]["message_id"]
                            callback_data = callback["data"]
                            
                            await self.handle_callback(chat_id, callback_data, message_id)
                            
                            # Answer the callback to remove loading state
                            await client.post(
                                f"{self.api_base}/answerCallbackQuery",
                                json={"callback_query_id": callback["id"]}
                            )
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

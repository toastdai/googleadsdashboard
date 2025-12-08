"""
Rate Limiter Utility

Simple rate limiter for API calls to avoid hitting Google Ads API limits.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional
from collections import deque


class RateLimiter:
    """
    Token bucket rate limiter for API calls.
    
    Implements a sliding window rate limiter to control the rate of API calls.
    """
    
    def __init__(
        self,
        requests_per_second: float = 1.0,
        burst_size: int = 5
    ):
        """
        Initialize rate limiter.
        
        Args:
            requests_per_second: Maximum sustained requests per second
            burst_size: Maximum burst of requests allowed
        """
        self.requests_per_second = requests_per_second
        self.burst_size = burst_size
        self.min_interval = 1.0 / requests_per_second
        
        # Track request timestamps by key (e.g., customer_id)
        self._requests: Dict[str, deque] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
    
    def _get_lock(self, key: str) -> asyncio.Lock:
        """Get or create lock for a specific key."""
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]
    
    def _get_queue(self, key: str) -> deque:
        """Get or create request queue for a specific key."""
        if key not in self._requests:
            self._requests[key] = deque(maxlen=self.burst_size)
        return self._requests[key]
    
    async def acquire(self, key: str = "default") -> None:
        """
        Acquire permission to make a request.
        
        Blocks until the request can be made within rate limits.
        
        Args:
            key: Rate limit key (e.g., customer_id for per-account limiting)
        """
        async with self._get_lock(key):
            now = datetime.utcnow()
            queue = self._get_queue(key)
            
            # Remove old requests outside the window
            cutoff = now - timedelta(seconds=1.0)
            while queue and queue[0] < cutoff:
                queue.popleft()
            
            # If at burst limit, wait for the oldest request to expire
            if len(queue) >= self.burst_size:
                oldest = queue[0]
                wait_time = (oldest + timedelta(seconds=1.0) - now).total_seconds()
                if wait_time > 0:
                    await asyncio.sleep(wait_time)
                    # Remove expired requests after waiting
                    now = datetime.utcnow()
                    cutoff = now - timedelta(seconds=1.0)
                    while queue and queue[0] < cutoff:
                        queue.popleft()
            
            # If not first request, ensure minimum interval
            if queue:
                last_request = queue[-1]
                elapsed = (now - last_request).total_seconds()
                if elapsed < self.min_interval:
                    await asyncio.sleep(self.min_interval - elapsed)
            
            # Record this request
            queue.append(datetime.utcnow())
    
    async def __aenter__(self):
        """Context manager entry."""
        await self.acquire()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        pass


class GoogleAdsRateLimiter(RateLimiter):
    """
    Rate limiter configured for Google Ads API limits.
    
    Default: 0.5 requests per second (conservative for test accounts)
    """
    
    def __init__(self, requests_per_second: float = 0.5):
        super().__init__(
            requests_per_second=requests_per_second,
            burst_size=3
        )

#!/bin/bash
# Get your JWT token (you need to be logged in)
# Replace with your actual token from browser localStorage

TOKEN="your_jwt_token_here"

echo "Triggering sync for last 30 days..."
curl -X POST "https://googleads-dashboard-backend.onrender.com/api/sync/trigger?days=30" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -v

echo ""
echo "Sync triggered! Check Render logs for progress."

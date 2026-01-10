#!/bin/bash
# Production Deployment Verification Script
# Run this after deploying to verify all systems are working

echo "🚀 Google Ads Dashboard - Production Verification"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_URL="${FRONTEND_URL:-https://googleadsdashboard.vercel.app}"
BACKEND_URL="${BACKEND_URL:-https://googleads-dashboard-backend.onrender.com}"

echo "Testing against:"
echo "  Frontend: $FRONTEND_URL"
echo "  Backend:  $BACKEND_URL"
echo ""

# Test function
test_endpoint() {
    local name=$1
    local url=$2
    local expected=$3
    
    echo -n "Testing $name... "
    
    response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ]; then
        if [ -n "$expected" ]; then
            if echo "$body" | grep -q "$expected"; then
                echo -e "${GREEN}✓ PASS${NC}"
                return 0
            else
                echo -e "${YELLOW}⚠ PASS (but unexpected content)${NC}"
                return 1
            fi
        else
            echo -e "${GREEN}✓ PASS${NC}"
            return 0
        fi
    else
        echo -e "${RED}✗ FAIL (HTTP $http_code)${NC}"
        return 1
    fi
}

# Counter for passed tests
passed=0
total=0

# Backend Tests
echo "📦 Backend Health Checks"
echo "------------------------"

total=$((total + 1))
test_endpoint "Backend Health" "$BACKEND_URL/" "healthy" && passed=$((passed + 1))

total=$((total + 1))
test_endpoint "API Docs" "$BACKEND_URL/docs" "TellSpike" && passed=$((passed + 1))

echo ""

# Frontend Tests
echo "🌐 Frontend Health Checks"
echo "-------------------------"

total=$((total + 1))
test_endpoint "Frontend Health" "$FRONTEND_URL/" "" && passed=$((passed + 1))

total=$((total + 1))
test_endpoint "Login Page" "$FRONTEND_URL/login" "" && passed=$((passed + 1))

total=$((total + 1))
test_endpoint "Dashboard Page" "$FRONTEND_URL/dashboard" "" && passed=$((passed + 1))

echo ""

# Partner API Tests (Frontend Next.js API routes)
echo "🔌 Partner API Endpoints"
echo "------------------------"

# Get today's date
TODAY=$(date +%Y-%m-%d)
YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d 2>/dev/null || echo "2025-01-09")

total=$((total + 1))
test_endpoint "Kelkoo API" "$FRONTEND_URL/api/kelkoo?start=$YESTERDAY&end=$TODAY" "success" && passed=$((passed + 1))

total=$((total + 1))
test_endpoint "Admedia API" "$FRONTEND_URL/api/admedia?start=$YESTERDAY&end=$TODAY" "success" && passed=$((passed + 1))

total=$((total + 1))
test_endpoint "MaxBounty API" "$FRONTEND_URL/api/maxbounty?start=$YESTERDAY&end=$TODAY" "success" && passed=$((passed + 1))

echo ""

# Summary
echo "📊 Test Summary"
echo "==============="
echo "Passed: $passed/$total tests"
echo ""

if [ $passed -eq $total ]; then
    echo -e "${GREEN}✓ All tests passed! System is operational.${NC}"
    exit 0
elif [ $passed -ge $((total * 3 / 4)) ]; then
    echo -e "${YELLOW}⚠ Most tests passed. Check warnings above.${NC}"
    exit 0
else
    echo -e "${RED}✗ Multiple tests failed. Check configuration and logs.${NC}"
    exit 1
fi

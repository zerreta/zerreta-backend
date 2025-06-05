#!/bin/bash

# 🔍 ZERRETA - DEPLOYMENT STATUS CHECKER

echo "🔍 Checking Deployment Status..."
echo "================================"

echo ""
echo "🎨 Frontend Status:"
echo "URL: https://frontend-48ol0kapx-pratheep-bits-projects.vercel.app"
if curl -s "https://frontend-48ol0kapx-pratheep-bits-projects.vercel.app" > /dev/null; then
    echo "✅ Frontend is LIVE and responding!"
else
    echo "❌ Frontend is not responding"
fi

echo ""
echo "🔧 Backend Status:"
echo "URL: https://zerreta-backend.onrender.com"
if curl -s "https://zerreta-backend.onrender.com/" > /dev/null; then
    echo "✅ Backend is LIVE and responding!"
else
    echo "❌ Backend is not responding"
fi

echo ""
echo "📊 Quick Response Test:"
echo "Frontend response:"
curl -s "https://frontend-48ol0kapx-pratheep-bits-projects.vercel.app" | grep -o "<title>.*</title>" || echo "No title found"

echo ""
echo "Backend response:"
curl -s "https://zerreta-backend.onrender.com/" | head -3

echo ""
echo "🕐 Status check completed at: $(date)" 
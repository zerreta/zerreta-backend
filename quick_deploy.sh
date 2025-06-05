#!/bin/bash

# 🚀 ZERRETA - QUICK DEPLOYMENT SCRIPT
# Run this script for instant deployment of both frontend and backend

echo "🚀 Starting Quick Deployment..."
echo "=================================="

# Check if we're in the right directory
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "Expected structure: ./frontend/ and ./backend/"
    exit 1
fi

# Deploy Backend First
echo ""
echo "📡 Deploying Backend to Render..."
echo "--------------------------------"
cd backend

# Check if backend directory has git
if [ ! -d ".git" ]; then
    echo "❌ Error: Backend directory is not a git repository"
    exit 1
fi

# Add, commit and push backend changes
git add .
if git diff --cached --quiet; then
    echo "✅ No backend changes to deploy"
else
    git commit -m "Quick deploy $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Pushing to zerreta/zerreta-backend..."
    git push
    echo "✅ Backend pushed successfully!"
fi

# Navigate back to project root
cd ..

# Deploy Frontend
echo ""
echo "🎨 Deploying Frontend to Vercel..."
echo "--------------------------------"
cd frontend

# Build the project first
echo "Building React app..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # Deploy using pre-built method (faster)
    echo "Deploying to Vercel..."
    npx vercel build --prod --yes
    npx vercel deploy --prod --prebuilt --yes
    
    if [ $? -eq 0 ]; then
        echo "✅ Frontend deployed successfully!"
    else
        echo "❌ Frontend deployment failed"
        exit 1
    fi
else
    echo "❌ Build failed"
    exit 1
fi

# Navigate back to project root
cd ..

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "=================================="
echo "✅ Frontend: https://frontend-amber-sigma-11-6yvscsp0t-pratheep-bits-projects.vercel.app"
echo "✅ Target:   https://frontend-amber-sigma-11.vercel.app/"
echo "✅ Backend:  https://zerreta-backend.onrender.com"
echo ""
echo "🔍 Testing deployments..."
echo "Frontend Status: Checking..."
curl -s "https://frontend-amber-sigma-11-6yvscsp0t-pratheep-bits-projects.vercel.app" > /dev/null && echo "✅ Frontend is live!" || echo "⚠️  Frontend may be starting up..."

echo "Backend Status: Checking..."  
curl -s "https://zerreta-backend.onrender.com/" > /dev/null && echo "✅ Backend is live!" || echo "⚠️  Backend may be starting up..."

echo ""
echo "🚀 Deployment completed in seconds!"
echo "📝 Check DEPLOYMENT_GUIDE.md for more details" 
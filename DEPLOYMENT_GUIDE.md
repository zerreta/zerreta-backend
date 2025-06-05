# 🚀 ZERRETA - QUICK DEPLOYMENT GUIDE

## 📋 **CURRENT LIVE URLS**
- **Frontend (Latest)**: https://frontend-amber-sigma-11-6onupmygn-pratheep-bits-projects.vercel.app
- **Frontend (Target URL)**: https://frontend-amber-sigma-11.vercel.app/ 
- **Backend (API)**: https://zerreta-backend.onrender.com
- **Database**: MongoDB Atlas (Remote)

## 🎉 **LATEST DEPLOYMENT STATUS**
- **✅ Code Pushed to GitHub**: Both frontend and backend repositories updated
- **✅ Frontend Deployed**: Latest Grammar Test Review feature deployed successfully  
- **✅ Backend Updated**: Grammar questions bulk upload functionality live
- **🕒 Last Deployed**: June 5, 2025

## 🚀 **NEW FEATURES LIVE**
- **📝 Grammar Test Review**: Detailed question-by-question analysis with explanations
- **🎯 Visual Feedback**: Color-coded results (correct/incorrect/unanswered)
- **⏱️ Performance Metrics**: Time tracking per question and overall statistics
- **🎮 MathOrbit Game**: Interactive orbital mechanics math learning experience

## 🏗️ **REPOSITORY STRUCTURE**
```
Main Project: /Users/pratheepselvam/Documents/final-neet/
├── frontend/          → Deploys to Vercel
├── backend/           → Deploys to Render.com
├── DEPLOYMENT_GUIDE.md → This file
```

## 📦 **REPOSITORIES**
- **Frontend Repo**: Connected to Vercel (auto-deploy on push)
- **Backend Repo**: `https://github.com/zerreta/zerreta-backend.git`
- **Main Project**: Local development

## 🎮 **LATEST FEATURES ADDED**
- **✅ MathOrbit**: Interactive orbital mechanics meets mathematics! Students can explore the solar system while solving math problems.
  - Located in: `/student-dashboard/extras` → **MathOrbit**
  - Features: Animated orbital simulation, difficulty levels, real-time scoring
  - Components: `frontend/src/components/MathOrbit.js`

## 📝 **Grammar Test Review**
- **Latest Feature**: 📝 Grammar Test Review (Detailed question-by-question analysis with explanations)

## ⚡ **QUICK DEPLOYMENT COMMANDS**

### 🎯 **FRONTEND DEPLOYMENT (Vercel)**
```bash
# Navigate to frontend
cd frontend

# Build the project
npm run build

# Deploy to Vercel (Method 1 - Direct)
npx vercel --prod --yes

# Deploy to Vercel (Method 2 - Pre-built)
npx vercel build --prod --yes
npx vercel deploy --prod --prebuilt --yes

# Git-based deployment
git add . && git commit -m "Frontend update" && git push
```

### 🔧 **BACKEND DEPLOYMENT (Render)**
```bash
# Navigate to backend
cd backend

# Push to repository (triggers auto-deploy)
git add . && git commit -m "Backend update" && git push

# Verify deployment
curl -s "https://zerreta-backend.onrender.com/" | head -5
```

### 🚀 **FULL DEPLOYMENT (Both Services)**
```bash
# Deploy Backend First
cd backend
git add . && git commit -m "Deploy backend updates" && git push

# Deploy Frontend
cd ../frontend
npx vercel build --prod --yes
npx vercel deploy --prod --prebuilt --yes

# Alternative: Git-based frontend deploy
git add . && git commit -m "Deploy frontend updates" && git push
```

## 📋 **CONFIGURATION FILES**

### Frontend (`frontend/vercel.json`)
```json
{
  "version": 2,
  "buildCommand": "CI=false npm run build",
  "outputDirectory": "build",
  "installCommand": "npm install",
  "framework": "create-react-app",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Backend (`render.yaml`)
```yaml
services:
  - type: web
    name: zerreta-backend
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

## 🔧 **ENVIRONMENT VARIABLES**

### Backend (.env)
```
NODE_ENV=production
MONGODB_URI=<your_mongodb_connection_string>
JWT_SECRET=<your_jwt_secret>
PORT=3000
```

### Frontend (Production)
```
REACT_APP_API_URL=https://zerreta-backend.onrender.com
```

## 🚨 **TROUBLESHOOTING**

### Frontend Issues:
```bash
# Clear Vercel cache
cd frontend && rm -rf .vercel

# Rebuild and redeploy
npm run build
npx vercel --prod --yes
```

### Backend Issues:
```bash
# Check backend status
curl -s "https://zerreta-backend.onrender.com/"

# Force redeploy (push empty commit)
cd backend
git commit --allow-empty -m "Force redeploy"
git push
```

# Quick status check
echo "Frontend Status:"
curl -s "https://frontend-amber-sigma-11-6yvscsp0t-pratheep-bits-projects.vercel.app" | grep -o "<title>.*</title>" || echo "✅ Frontend Live"

echo "Backend Status:"  
curl -s "https://zerreta-backend.onrender.com/" | head -3 || echo "✅ Backend Live"
```

## 🔒 **VERCEL AUTHENTICATION NOTICE**
If you see a Vercel authentication page, follow these steps:
1. Visit the Vercel dashboard: https://vercel.com/dashboard
2. Navigate to your project settings
3. Go to "Deployment Protection" 
4. Disable "Vercel Authentication" to make the app publicly accessible
5. Or access the app while logged into your Vercel account

---
**Last Updated**: June 5, 2025
**Deployment Time**: ~30 seconds for both services
**Status**: ✅ Production Ready
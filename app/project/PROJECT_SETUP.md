PROJECT_SETUP.md
markdown
# School Generator - Setup Guide

## Project Structure
project/
├── backend/ # FastAPI server
├── web/ # React web app
├── mobile/ # React Native (Expo) mobile app
└── desktop/ # Electron (coming soon)

text

---

## 1. Backend Setup

### Prerequisites
- Python 3.10+
- pip

### Installation
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
Configuration
Create .env file in backend/:

text
APP_NAME=Schoole generator API
DEBUG=true
DATABASE_URL=sqlite:///./generator_school.db
SECRET_KEY=change-this-to-random-string
ACCESS_TOKEN_EXPIRE_MINUTES=30
ALGORITHM=HS256
UPLOAD_DIR=./uploads
Run
bash
cd backend
source .venv/bin/activate
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
API docs: http://localhost:8000/docs

2. Web App Setup
Prerequisites
Node.js 18+

Installation
bash
cd web
npm install
Configuration
File: web/src/api/client.js - Line 1

javascript
const API_BASE_URL = 'http://localhost:8000/api/v1';
// Change to your server URL when deployed:
// const API_BASE_URL = 'https://your-server.com/api/v1';
Run
bash
cd web
npm run dev
Open: http://localhost:5173

Build for Production
bash
cd web
npm run build
Output in web/dist/ - serve with any static file server.

3. Mobile App Setup
Prerequisites
Node.js 18+

Expo Go app on your phone (iOS/Android)

Installation
bash
cd mobile
npm install
Configuration
File: mobile/src/api/config.js

javascript
import { Platform } from 'react-native';

// === CHANGE THIS FOR DEPLOYMENT ===
const PRODUCTION_URL = 'https://your-server.com/api/v1';
// ==================================

const LOCAL_URL = Platform.select({
  android: 'http://10.0.2.2:8000/api/v1',  // Android emulator
  ios: 'http://localhost:8000/api/v1',       // iOS simulator
  default: 'http://localhost:8000/api/v1',
});

const IS_DEV = __DEV__;

export const API_BASE_URL = IS_DEV ? LOCAL_URL : PRODUCTION_URL;
For Testing on Real Phone (Same WiFi)
Change LOCAL_URL to your PC's IP:

javascript
const LOCAL_URL = 'http://192.168.X.X:8000/api/v1';  // Your IP
Find your IP:

bash
# Linux/Mac
ip addr show | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig
Also start backend on all interfaces:

bash
cd backend
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
Run
bash
cd mobile
npx expo start
Scan QR code with Expo Go app.

Build APK for Android
bash
cd mobile
npm install -g eas-cli
eas login
eas build --platform android --profile preview
Download APK from Expo dashboard.

4. Deploying Backend (Render.com Example)
Push code to GitHub

Go to render.com → New Web Service

Connect GitHub repo

Settings:

Build Command: pip install -r requirements.txt

Start Command: uvicorn src.main:app --host 0.0.0.0 --port $PORT

Environment Variables: Add all from .env

Get your URL: https://your-app.onrender.com

After Deploy - Update ALL Configs
File	Line	Change
web/src/api/client.js	1	const API_BASE_URL = 'https://your-app.onrender.com/api/v1'
mobile/src/api/config.js	4	const PRODUCTION_URL = 'https://your-app.onrender.com/api/v1'
Then rebuild:

Web: npm run build → redeploy

Mobile: eas build → new APK

5. Important: PDFs in Production
Backend stores PDFs in uploads/ folder. On Render.com, files reset on deploy.

Solution: Use cloud storage (S3, Cloudinary) or change UPLOAD_DIR to a persistent volume.

For quick testing, the local filesystem works fine.

6. Quick Test Checklist
Backend running: curl http://localhost:8000/api/v1/health/

Web app: http://localhost:5173 shows login page

Can register, login, create subjects

PDF upload works

Mobile app connects to backend

PDF view works on mobile

7. Common Issues
CORS Error:
Backend has allow_origins=["*"] in backend/src/main.py

Mobile can't connect:

Backend must run with --host 0.0.0.0

Phone and PC on same WiFi

Use PC's IP in config, not localhost

PDF view says "Method Not Allowed":

Backend main.py must have StaticFiles mount:

python
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
PDF schemas must include filepath field

422 Error on Create:

Subject uses name field, not title

Courses/Exams use title field

text

---

Save this as `PROJECT_SETUP.md` in your project root. Anyone can follow it to set up and deploy!

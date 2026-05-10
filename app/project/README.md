
markdown
# School Generator

A full-stack educational content management platform for teachers. Manage subjects, courses, exam series, and generate AI-powered educational content.

Teacher: Register → Login → Create Subjects → Add Courses/Series/Exams → Upload PDFs → Generate AI Content

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI (Python) + SQLAlchemy + SQLite |
| Web | React + Vite + React Router |
| Mobile | React Native (Expo) |
| Desktop | Electron (wraps Web) |

---

## Project Structure
project/
├── backend/ # FastAPI server
│ ├── src/
│ │ ├── main.py # App entry, CORS, static files
│ │ ├── api/ # Route definitions
│ │ ├── core/ # Config, file handler
│ │ ├── db/ # Database setup
│ │ └── modules/ # Feature modules
│ │ ├── auth/ # Login, JWT
│ │ ├── teacher/ # Teacher registration
│ │ ├── subject/ # Subjects CRUD
│ │ ├── course/ # Courses + PDFs
│ │ ├── exam/ # Exams + PDFs + AI generate
│ │ ├── practical_series/
│ │ └── theoretical_series/
│ ├── uploads/ # PDF storage (created on first upload)
│ ├── .env # Environment variables
│ └── requirements.txt
│
├── web/ # React web app
│ └── src/
│ ├── api/client.js # API functions (change URL here)
│ ├── context/ # AuthContext, ToastContext
│ ├── hooks/ # useAuth hook
│ ├── pages/ # Login, Register, Subjects, SubjectDetail
│ ├── components/ # Toast notifications
│ └── styles/ # theme.css, global.css
│
├── mobile/ # React Native (Expo)
│ └── src/
│ ├── api/
│ │ ├── config.js # URL config (change for production)
│ │ └── client.js # API functions
│ ├── context/ # AuthContext
│ ├── screens/ # Login, Register, Subjects, SubjectDetail
│ └── navigation/ # Stack navigator
│
├── desktop/ # Electron desktop app
│ ├── main.js # Electron main process
│ ├── preload.js # Secure bridge
│ └── package.json # Build configs
│
└── README.md

text

---

## Quick Start (Local Development)

### 1. Start Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
Check: http://localhost:8000/docs

2. Start Web App
bash
cd web
npm install
npm run dev
Open: http://localhost:5173

3. Start Mobile App
bash
cd mobile
npm install
npx expo start
Scan QR code with Expo Go app.

4. Start Desktop App
bash
cd desktop
npm install
npm run dev
Opens Electron window automatically.

Where to Change Backend URL
When deploying backend to a server:
Platform	File	Line/Variable
Web	web/src/api/client.js	const API_BASE_URL = '...'
Mobile	mobile/src/api/config.js	const PRODUCTION_URL = '...'
Desktop	Uses web config automatically	(same as web)
Change from:

javascript
const API_BASE_URL = 'http://localhost:8000/api/v1';
To:

javascript
const API_BASE_URL = 'https://your-server.com/api/v1';
How to Add AI Generation Endpoints (Future)
Currently, only Exams have a /generate endpoint (placeholder).

To add AI generation for Courses, Practical Series, Theoretical Series:
Backend - For each module, add these files:
Example: Adding AI generation to Courses

Create route in backend/src/modules/course/router.py:

python
@router.post("/{course_id}/generate")
async def generate_course_content(
    subject_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher)
):
    return controller.generate_content(db, teacher, course_id)
Add method in backend/src/modules/course/controller.py:

python
def generate_content(self, db: Session, teacher: Teacher, course_id: int) -> dict:
    course = self.service.get_by_id(db, teacher, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Gather all PDFs for this course
    pdfs = course.pdfs
    
    # Call AI service (implement later)
    # generated_content = ai_service.generate_from_pdfs(pdfs)
    
    return {"message": "AI generation not yet implemented", "course_id": course_id}
Add service method in backend/src/modules/course/service.py:

python
@staticmethod
def get_course_with_pdfs(db: Session, course_id: int) -> Course:
    return (
        db.query(Course)
        .options(joinedload(Course.pdfs))
        .filter(Course.id == course_id)
        .first()
    )
Repeat for practical_series and theoretical_series modules

Frontend already has the button - it will work automatically once the endpoint exists.

AI Service Implementation (Future):
bash
# Install AI library
pip install openai  # or anthropic, google-generativeai, etc.

# Create backend/src/core/ai_service.py
class AIService:
    def generate_from_pdfs(self, pdfs, content_type):
        # Extract text from PDFs
        # Send to AI API
        # Generate content based on type
        pass
Adding new content types:
Copy an existing module (e.g., course/)

Rename all references

Add to backend/src/api/__init__.py:

python
from src.modules.new_module.router import router as new_module_router
api_router.include_router(new_module_router, prefix="/subjects/{subject_id}/new-module")
Deploying to Production
Backend (Render.com / Railway / AWS)
Push code to GitHub

Create new Web Service

Set build command: pip install -r requirements.txt

Set start command: uvicorn src.main:app --host 0.0.0.0 --port $PORT

Set environment variables (copy from .env)

Important: Change UPLOAD_DIR to persistent storage:

Render: Use a disk (add in dashboard)

Or use cloud storage (S3, Cloudinary)

Web App (Vercel / Netlify / GitHub Pages)
bash
cd web
npm run build
# Upload dist/ folder to hosting service
Mobile App (Expo EAS Build)
bash
cd mobile

# Install EAS CLI
npm install -g eas-cli
eas login

# Configure
eas build:configure

# Update production URL in src/api/config.js FIRST

# Build Android APK
eas build --platform android --profile preview

# Build for stores
eas build --platform android --profile production
eas build --platform ios --profile production

# Submit to stores
eas submit --platform android
eas submit --platform ios
Desktop App
bash
cd desktop

# Build for each platform
npm run build:linux    # .AppImage, .deb
npm run build:mac      # .dmg
npm run build:win      # .exe

# Output in desktop/dist/
Environment Variables (Backend .env)
env
APP_NAME=Schoole generator API
DEBUG=true                          # false in production
DATABASE_URL=sqlite:///./generator_school.db
SECRET_KEY=change-this-to-random    # Use strong random string
ACCESS_TOKEN_EXPIRE_MINUTES=30
ALGORITHM=HS256
UPLOAD_DIR=./uploads               # Change to persistent path in production
Generate a secure SECRET_KEY:
bash
python -c "import secrets; print(secrets.token_hex(32))"
PDF Storage in Production
Option 1: Persistent Disk (Render.com)
Add a disk in Render dashboard

Set UPLOAD_DIR=/opt/render/project/uploads

Option 2: Cloud Storage (Recommended)
Use AWS S3, Cloudinary, or Supabase Storage

Update backend/src/core/file_handler.py to upload to cloud

Update PDF URLs to return cloud URLs

Option 3: Database Storage (Small files only)
Store PDFs as BLOB in database

Not recommended for large files

Common Issues & Fixes
Issue	Fix
CORS error	Backend has allow_origins=["*"] in main.py
422 on create subject	Subject uses name field, not title
PDF view "Method Not Allowed"	Need StaticFiles mount + filepath in schema
Mobile can't connect	Backend must run with --host 0.0.0.0
White page	Check BrowserRouter is only in main.jsx, not App.jsx
PDF upload fails	Check UPLOAD_DIR setting + directory exists
Future Enhancements
AI content generation (exam questions, summaries, lesson plans)

Student accounts and enrollment

Quiz/test taking interface

Progress tracking and analytics

Real-time collaboration

Multi-language support

Dark mode

Push notifications

Offline mode for mobile


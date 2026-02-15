# Accessible Digital Examination System

A full-stack examination platform designed for visually impaired students, featuring voice control, text-to-speech, and ML-powered grading.

## Architecture

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│   React App    │────▶│  Node.js API   │────▶│  Python ML     │
│   (Vite)       │     │  (Express)     │     │  (Flask)       │
│   Port 5173    │     │  Port 5000     │     │  Port 8000     │
└────────────────┘     └───────┬────────┘     └────────────────┘
                               │
                        ┌──────▼──────┐
                        │   MongoDB   │
                        │  Port 27017 │
                        └─────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- MongoDB running on `localhost:27017`

### 1. Backend

```bash
cd backend
cp .env .env.local       # Edit if needed
npm install
npm run seed             # Create demo data
npm run dev              # Starts on :5000
```

### 2. Python ML Service

```bash
cd ml-service
py -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # Mac/Linux
py -m pip install -r requirements.txt
py app.py               # Starts on :8000
```

> First run downloads ~90MB model. Requires ~500MB disk.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev              # Starts on :5173
```

Open **http://localhost:5173**

## Demo Credentials

| Role    | Login                                     |
|---------|-------------------------------------------|
| Admin   | Email: `admin@gmail.com`, Password: `admin123` |
| Student | ID: `STU001`                               |
| Student | ID: `STU002`                               |
| Student | ID: `STU003`                               |

## Voice Commands (During Exam)

| Command                    | Action                    |
|----------------------------|---------------------------|
| "Next Question"            | Navigate forward          |
| "Previous Question"        | Navigate backward         |
| "Option A/B/C/D"           | Select MCQ answer         |
| "Yes" / "No"               | Confirm or cancel         |
| "Repeat Question"          | TTS re-reads question     |
| "Skip Question"            | Skip current              |
| "How many remaining"       | Progress check            |
| "Return to Unanswered"     | Jump to first unanswered  |
| "Go to Part 1/2/3"         | Jump to section           |
| "Finish Exam"              | Submit exam               |

## Environment Variables

### Backend (`.env`)
```
MONGO_URI=mongodb://localhost:27017/accessible-exam
JWT_SECRET=your_jwt_secret_change_in_production
ML_SERVICE_URL=http://localhost:8000
PORT=5000
```

### ML Service (`.env`)
```
PORT=8000
MODEL_NAME=all-MiniLM-L6-v2
```

## API Endpoints

| Method | Endpoint                        | Auth     | Description              |
|--------|---------------------------------|----------|--------------------------|
| POST   | /api/student-login              | Public   | Student login            |
| POST   | /api/admin-login                | Public   | Admin login              |
| GET    | /api/exams                      | Admin    | List all exams           |
| POST   | /api/exams                      | Admin    | Create exam              |
| PUT    | /api/exams/:id                  | Admin    | Update exam              |
| DELETE | /api/exams/:id                  | Admin    | Delete exam              |
| POST   | /api/exams/:id/generate-codes   | Admin    | Generate exam codes      |
| POST   | /api/exams/:id/start            | Student  | Start exam               |
| POST   | /api/exams/:id/answer           | Student  | Submit/update answer     |
| POST   | /api/exams/:id/finish           | Student  | Finish exam              |
| GET    | /api/results/:studentId         | Auth     | Get student results      |
| GET    | /api/results/:sid/:eid/pdf      | Auth     | Download result PDF      |
| GET    | /api/logs/:examId/:studentId    | Admin    | View activity logs       |
| POST   | /ml/grade-open-ended            | Internal | ML grading endpoint      |

## Project Structure

```
accessible-exam-system/
├── backend/
│   ├── config/db.js           # MongoDB connection
│   ├── middleware/auth.js     # JWT & role middleware
│   ├── models/                # 8 Mongoose schemas
│   ├── routes/                # Auth, Exam, Log, Result routes
│   ├── utils/pdfExport.js     # PDF generation
│   ├── seed.js                # Demo data seeder
│   └── server.js              # Express entry point
├── frontend/
│   └── src/
│       ├── api/axios.js       # HTTP client
│       ├── context/           # Auth & Exam contexts
│       ├── hooks/             # Voice commands & TTS
│       ├── components/        # ProtectedRoute, VoiceFeedback
│       └── pages/             # 7 page components
└── ml-service/
    ├── app.py                 # Flask ML grading
    └── requirements.txt
```

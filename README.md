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
npm run seed             # Create demo data (overwrites existing records)
npm run dev              # Starts on :5000
```

> **Note:** The application also ensures a default admin account (`admin@gmail.com` / `123456`) is created automatically on startup if none exist. Running `npm run seed` will replace it along with other demo data.

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
| Admin   | Email: `admin@gmail.com`, Password: `123456` |
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
| "I don't understand"       | Ask the AI helper to explain the question |
| "Help me"                 | Get friendly support or definitions |
| "What does [word] mean"   | Ask for a definition      |
| "I feel nervous"          | Hear some calming advice  |

The built-in AI help assistant runs in the **ml-service** and can respond to
natural voice or text requests during the exam without revealing answers. Use
it if you're unsure about wording, definitions, or need reassurance. It
respects exam integrity and will never give away the correct option.

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
| POST   | /api/teacher-login              | Public   | Teacher login            |
| GET    | /api/exams                      | Admin    | List all exams           |


### Grading & Teacher Workflow

- **Auto‑grading**: When a student submits an answer, multiple‑choice and
  true/false questions (typically parts 1 and 2) are graded automatically by
  the backend. The correct answer is compared, the score assigned, and the
  response marked `autoGraded`. Teachers do **not** need to review these
  answers – they are recorded correctly immediately.

- **Manual grading**: Only open‑ended questions (usually part 3) are left for
  teacher review. In the teacher dashboard, only non‑auto‑graded responses
  appear; the instructor can then click **Correct** or **Incorrect** for each
  one. Once graded, the response is marked `manuallyGraded` and the choice is
  locked.

  Teachers (and administrators) can even use speech – select a row and say “correct” or
  “incorrect” – and the system will apply that grade. Student answers are
  preserved verbatim; grading does not overwrite the original response.  In
  fact teachers may even **override automatic grading**; options that were
  scored by the backend are shown to instructors so they can fix mistakes or
  give partial credit.

  Administrators have the same grading interface via the **Responses** link
  available on the *Exams* list page. This lets an admin correct or adjust a
  student’s answer without switching accounts.

This separation ensures that parts 1 and 2 are handled automatically and the
teacher/admin only focuses on the longer, subjective items in part 3.

- After grading, students can view their results page and use the “Read
  Feedback” button (or say “read feedback” aloud) to have the system speak
  whether each question was correct or incorrect along with any teacher
  comments. This lets the admin/teacher effectively tell the student which
  questions they got right or wrong.
| GET    | /api/exams/my                   | Admin/Teacher | List your exams      |
| POST   | /api/exams                      | Admin/Teacher | Create exam           |
| PUT    | /api/exams/:id                  | Admin    | Update exam              |
| DELETE | /api/exams/:id                  | Admin    | Delete exam              |
| POST   | /api/exams/:id/generate-codes   | Admin    | Generate exam codes      |
| GET    | /api/results/exam/:examId       | Admin    | Get all results for exam (includes question details)
| GET    | /api/results/analytics/:examId | Admin    | Exam analytics statistics
| POST   | /api/exams/:id/start            | Student  | Start exam               |
| POST   | /api/exams/:id/answer           | Student  | Submit/update answer     |
| POST   | /api/exams/:id/finish           | Student  | Finish exam              |
| GET    | /api/results/:studentId         | Auth     | Get student results      |
| POST   | /api/teachers                   | Admin    | Add teacher account      |
| GET    | /api/teachers                   | Admin    | List teachers            |
| GET    | /api/results/:sid/:eid/pdf      | Auth     | Download result PDF      |
| GET    | /api/logs/:examId/:studentId    | Admin    | View activity logs       |
| GET    | /api/exams/:examId/students     | Admin/Teacher | List students for exam|
| GET    | /api/exams/:examId/students/:studentId/responses | Admin/Teacher | Student answers   |
| POST   | /ml/grade-open-ended            | Internal | ML grading endpoint      |

## Git Automation ⚙️

A simple PowerShell script is provided at the project root to automate the Git workflow. It stages all changes, commits with your message, and pushes to the current branch.

```powershell
# from the repo root
.\auto_commit_push.ps1 "Your commit message here"
```

You can also adapt the script to turn it into a Git hook or alias depending on your preferences.

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

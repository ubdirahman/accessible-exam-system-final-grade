# Backend Documentation

## Hordhac

Backend-ka mashruucan waa API-ga ugu weyn ee nidaamka. Waxa lagu dhisay **Node.js + Express + MongoDB + Mongoose**. Shaqadiisu ma aha oo keliya inuu kaydiyo data, balse sidoo kale wuxuu xakameeyaa:

- authentication
- authorization
- exam creation
- exam participation
- answer saving
- result calculation
- teacher/admin grading
- reports
- PDF generation
- audio recording storage

Sababtoo ah database-ku waa **MongoDB**, backend-kan ma isticmaalo SQL tables. Halkii, wuxuu isticmaalaa **collections** oo Mongoose models lagu qeexay. Sidaas darteed, marka user-ku yiraahdo "tables", macnaha saxda ah ee project-kan waa **collections/models**.

Code-ka hadda jira backend-ku wuxuu leeyahay:

- `14` Mongoose models / collections
- `10` route files
- `3` utility files
- `59` route endpoints oo `GET/POST/PUT/DELETE` ah

## Collections-ka ama "Tables"-ka Backend-ka

Backend-kan wuxuu leeyahay `14` collection oo waaweyn:

1. `Admin`
2. `Student`
3. `Teacher`
4. `Faculty`
5. `Classroom`
6. `Semester`
7. `Subject`
8. `Exam`
9. `Section`
10. `Question`
11. `Response`
12. `Result`
13. `ActivityLog`
14. `ExamRecording`

Hoos waxaa ku yaal sharaxaad faahfaahsan:

### 1. `Admin`

Collection-kan wuxuu kaydiyaa admin accounts-ka. Fields-ka ugu waaweyn:

- `name`
- `email`
- `password`
- `role` oo noqon kara `admin` ama `super_admin`
- `facultyId`
- `createdAt`

Waxa muhiim ah:

- password-ka waa la hash gareeyaa iyadoo la adeegsanayo `bcryptjs`
- `super_admin` wuxuu maamuli karaa faculties oo dhan
- `admin` badanaa wuxuu ku xiran yahay faculty gaar ah

### 2. `Student`

Collection-kan wuxuu kaydiyaa ardayda. Fields-ka muhiimka ah:

- `name`
- `studentId`
- `email`
- `examCodes`
- `classId`
- `facultyId`
- `accessibilitySettings`
- `role`

Waxa uu si gaar ah u taageeraa accessibility:

- `highContrast`
- `fontSize`
- `speechRate`
- `preferredVoice`

### 3. `Teacher`

Collection-kan wuxuu kaydiyaa macallimiinta:

- `name`
- `email`
- `phone`
- `address`
- `password`
- `active`
- `facultyId`
- `classId`

Teacher-ka wuxuu ku xirmi karaa class iyo faculty gaar ah, taas oo ka dhigaysa in maamulka exam-ka iyo subjects-ku noqdaan scoped.

### 4. `Faculty`

Waxa uu kaydiyaa kulliyadaha ama faculties-ka:

- `name`
- `code`
- `adminId`
- `createdAt`

Tani waa collection-ka hierarchy-ga sare ee admin management-ka.

### 5. `Classroom`

Waxa uu kaydiyaa classes-ka:

- `name`
- `code`
- `semesterId`
- `facultyId`
- `createdBy`
- `createdAt`

Waxa uu leeyahay unique index ku saabsan `facultyId + code`, si class code isku mid ah aan laba jeer loogu samayn faculty isku mid ah.

### 6. `Semester`

Waxa uu kaydiyaa semester-yada:

- `name`
- `startDate`
- `endDate`
- `isActive`
- `facultyId`
- `createdBy`
- `createdAt`

### 7. `Subject`

Waxa uu kaydiyaa maadooyinka:

- `name`
- `code`
- `facultyId`
- `classId`
- `teacherId`
- `createdBy`
- `createdAt`

Subject-ku wuxuu noqdaa isku xirka:

- faculty
- class
- teacher
- exam

### 8. `Exam`

Tani waa collection-ka ugu muhiimsan ee exams-ka:

- `title`
- `description`
- `timeLimit`
- `sections`
- `active`
- `examCodes`
- `createdBy`
- `facultyId`
- `classId`
- `subjectId`
- `createdAt`

`examCodes` ma aha collection gaar ah; waa embedded array gudaha `Exam`.

### 9. `Section`

Waxay kala qaybinaysaa exam-ka qaybo:

- `examId`
- `name`
- `order`

Tusaale:

- Part 1
- Part 2
- Part 3

### 10. `Question`

Waxay kaydisaa su'aalaha exam-ka:

- `examId`
- `sectionId`
- `type`
- `questionText`
- `options`
- `correctAnswer`
- `points`
- `order`

Su'aaluhu waxay noqon karaan:

- `mcq`
- `true-false`
- `open-ended`

### 11. `Response`

Collection-kan wuxuu kaydiyaa jawaabta arday kasta:

- `studentId`
- `examId`
- `questionId`
- `selectedAnswer`
- `isCorrect`
- `score`
- `mlFeedback`
- `teacherFeedback`
- `manuallyGraded`
- `autoGraded`
- `answeredAt`
- `modifiedCount`

Waxa uu leeyahay unique index:

- `studentId + examId + questionId`

Taasi waxay ka hortagtaa duplicate responses.

### 12. `Result`

Waxa uu kaydiyaa natiijada guud ee exam-ka:

- `studentId`
- `examId`
- `score`
- `totalPoints`
- `correctCount`
- `wrongCount`
- `skippedCount`
- `timeTaken`
- `submittedAt`
- `locked`

Collection-kan wuxuu bixiyaa summary-ga rasmi ah ee exam attempt-ka.

### 13. `ActivityLog`

Waxa uu kaydiyaa dhaq-dhaqaaqa ardayga inta exam-ku socdo:

- `studentId`
- `examId`
- `action`
- `details`
- `questionId`
- `timestamp`

Actions-ka uu taageero waxaa ka mid ah:

- `exam_started`
- `question_opened`
- `answer_selected`
- `answer_modified`
- `question_skipped`
- `exam_finished`
- `voice_command`
- `tab_switch_attempt`

### 14. `ExamRecording`

Collection-kan wuxuu kaydiyaa metadata-ga audio recordings-ka:

- `studentId`
- `studentName`
- `examId`
- `examTitle`
- `subjectName`
- `facultyId`
- `classId`
- `mimeType`
- `fileName`
- `filePath`
- `fileSize`
- `durationSeconds`
- `status`
- `startedAt`
- `endedAt`
- `uploadedAt`

Audio file-ka laftiisa waxa lagu kaydiyaa disk, halka collection-kan uu hayo metadata iyo path.

## Qaab-dhismeedka Folder-ka Backend

Backend-ku wuxuu ku jiraa folder-ka `backend/`. Gudihiisa waxaa yaal qaybo si fiican loo kala soocay.

### `backend/server.js`

Waa entry point-ka ugu weyn ee backend-ka. Waxa uu qabtaa:

- load env vars
- MongoDB connection
- Express app creation
- middleware setup
- route mounting
- health endpoint
- default super admin creation
- app listen on port

### `backend/config/`

Folder-kan waxa ku jira `db.js`, oo qaabilsan MongoDB connection-ka.

Shaqadiisu waa:

- inuu akhriyo `MONGO_URI`
- inuu sameeyo `mongoose.connect`
- inuu bixiyo success/error logs

### `backend/middleware/`

Waxa ku jira `auth.js`, kaas oo maamula:

- JWT verification
- role checks
- helpers sida `requireAdmin`, `requireTeacher`, `requireStudent`, `requireAdminOrTeacher`, `requireSuperAdmin`

Middleware-kan ayaa backend-ka siinaya amniga ugu muhiimsan.

### `backend/models/`

Waa meesha ku yaal dhammaan `14` schema/model file. Tani waa layer-ka database abstraction-ka.

### `backend/routes/`

Folder-kan wuxuu leeyahay `10` files:

- `authRoutes.js`
- `examRoutes.js`
- `resultRoutes.js`
- `logRoutes.js`
- `recordingRoutes.js`
- `semesterRoutes.js`
- `teacherRoutes.js`
- `facultyRoutes.js`
- `classRoutes.js`
- `subjectRoutes.js`

Qayb kasta shaqadeeda:

`authRoutes.js`

- student login
- admin login
- teacher login

`examRoutes.js`

- create exam
- list exams
- teacher/admin exam ownership
- start exam
- save answer
- finish exam
- generate exam codes
- fetch students/responses
- manual grading update
- student CRUD ee maamulka
- participation summary

`resultRoutes.js`

- student results
- exam results
- analytics
- class matrix
- result PDFs
- class matrix PDF

`logRoutes.js`

- activity logs fetch
- activity logs create

`recordingRoutes.js`

- recordings list
- recording audio stream
- recording upload

`semesterRoutes.js`

- semester CRUD

`teacherRoutes.js`

- teacher CRUD

`facultyRoutes.js`

- faculty CRUD

`classRoutes.js`

- class CRUD
- teacher's own class fetch

`subjectRoutes.js`

- subject CRUD
- teacher's own subjects fetch

### `backend/utils/`

Waxaa ku jira `3` utility file:

- `pdfExport.js`
- `studentExamQueue.js`
- `examRecordingStorage.js`

`pdfExport.js`

- wuxuu sameeyaa result PDF
- wuxuu sameeyaa class matrix PDF
- wuxuu adeegsadaa `pdfkit`

`studentExamQueue.js`

- wuxuu xisaabiyaa exams-ka ardayga
- wuxuu kala saaraa `current`, `remaining`, iyo `completed`
- wuxuu ku shaqeeyaa class/faculty scope

`examRecordingStorage.js`

- wuxuu sameeyaa recordings directory
- wuxuu dhisaa file paths
- wuxuu delete gareeyaa old recordings
- wuxuu go'aamiyaa extension-ka ku habboon mime type-ka

### `backend/uploads/`

Halkan waxaa ku kaydsan recordings-ka exam-ka ee ardayda. Metadata-ga wuxuu galay `ExamRecording` model, halka file-ka laftiisu ku jiro disk.

### `backend/seed.js`

Waa file demo data lagu abuuro. Waxay samaysaa:

- admin
- students
- sample exam
- sections
- questions

Wuxuu faa'iido u leeyahay development iyo testing.

## Sidee Backend-ku U Shaqeeyaa

Socodka guud ee backend-ka waa sidan:

1. User-ku wuxuu login ku sameeyaa route ku habboon.
2. Backend-ku wuxuu hubiyaa credentials-ka.
3. Haddii sax noqdaan, JWT token ayaa la abuuraa.
4. Requests-ka xiga token-kaas ayaa lagu xaqiijiyaa middleware-ka.
5. Role-ka user-ka ayaa go'aamiya routes-ka uu geli karo.

Marka exam la sameynayo:

1. Admin ama teacher ayaa exam abuura.
2. Exam-ka waxaa lala xiriiriyaa faculty, class, subject, iyo creator.
3. Sections iyo questions ayaa lagu keydiyaa collections-kooda.
4. Exam codes ayaa la abuuri karaa.

Marka ardaygu exam galo:

1. Student login route ayaa helaya student-ka.
2. Exam queue ayaa loo xisaabiyaa.
3. Student-ku exam-ka ayuu bilaabaa.
4. Jawaab kasta route gaar ah ayaa lagu save-gareeyaa.
5. MCQ iyo true/false si toos ah ayaa loo grade gareeyaa.
6. Open-ended answer hadda wuxuu u sii jiraa manual grading.
7. Markuu student-ku finish sameeyo, result summary ayaa la sameeyaa oo la lock-gareeyaa.

## Qodob Muhiim ah oo ku Saabsan Grading

Code-ka hadda jira wuxuu muujinayaa xaqiiqo muhiim ah:

- `mcq` iyo `true-false` questions waa auto-graded
- `open-ended` questions backend-ku **si toos ah uguma diro** ml-service grading route marka student answer save/finish sameeyo
- open-ended answers waxaa loo daayaa **teacher/admin manual grading**

Tani waxay ka dhigan tahay in backend-ku weli leeyahay qaab grading oo adag oo aad loo xakameeyey, gaar ahaan subjective questions-ka.

In kasta oo `axios` lagu daray backend-ka oo `ml-service` route grading ahi jiro, code-ka hadda exam flow-ga firfircoon kuma waco endpoint-kaas.

## Reports, Analytics, iyo PDF

Backend-ku wuxuu leeyahay reporting layer fiican:

- exam analytics
- per-student results
- per-exam results
- class result matrix
- downloadable PDF reports
- audio recordings access
- activity logs

Tani waxay ka dhigaysaa backend-ka mid aan ku koobnayn CRUD oo kaliya, balse sidoo kale bixinaya maamulka iyo kormeerka nidaamka.

## Packages-ka Backend-ka iyo Faa'iidooyinkooda

Qaybtan hoose waxa ku qoran packages-ka si toos ah loogu sheegay `backend/package.json`.

| Package | Waxa loo adeegsado | Faa'iidada |
|---|---|---|
| `express` | API server iyo routes | Waxay fududeyneysaa dhismaha REST API, middleware, iyo route organization |
| `mongoose` | MongoDB ODM | Waxay bixisaa schemas, validation, query helpers, indexes, iyo model-based database design |
| `jsonwebtoken` | JWT auth | Waxay suurtagal ka dhigtaa login session stateless ah oo API-friendly ah |
| `bcryptjs` | Password hashing | Waxay ilaalisaa passwords-ka users-ka si ammaan ah |
| `cors` | Cross-origin access | Waxay u oggolaanaysaa frontend-ku inuu si sax ah ula xiriiro backend-ka |
| `dotenv` | Environment variables | Waxay ka dhigtaa configuration-ku mid ammaan iyo nadiif ah |
| `express-validator` | Request validation | Waxay gacan ka gaysan kartaa xakamaynta input khaldan iyo amniga API-ga |
| `axios` | HTTP requests to external/internal services | Waxaa loo diyaariyey isgaarsiinta services kale sida ml-service, inkastoo current flow-ga qaar aan wali si firfircoon u isticmaalin |
| `pdfkit` | PDF generation | Waxay suurto galisaa in result reports iyo class matrix reports loo dhoofiyo PDF |

## Gunaanad

Backend-kan waa laf dhabarta nidaamka. Waxa uu si dhab ah u maamulaa:

- user access
- exam lifecycle
- student responses
- results
- reports
- recordings

Marka la eego code-ka hadda jira, backend-ku waa nidaam si wanaagsan loo kala qaybiyey, oo leh collections badan, route coverage badan, iyo role-based security cad. Waxa kale oo uu diyaar u yahay inuu la shaqeeyo ml-service, inkastoo grading-ka open-ended-ka hadda ku jiro manual review flow.

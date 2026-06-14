# Frontend Documentation

## Hordhac

Frontend-ka mashruucan waa qaybta uu isticmaaluhu si toos ah ula falgalo. Waxa lagu dhisay **React 18 + Vite**, wuxuuna u adeegaa saddex nooc oo users ah:

- `student`
- `teacher`
- `admin` iyo `super_admin`

Frontend-kan waxaa si gaar ah loogu talagalay nidaam imtixaan oo la jaanqaadaya ardayda aragga naafada ka ah ama u baahan accessibility dheeraad ah. Sidaa darteed, code-ku wuxuu xooga saarayaa:

- voice interaction
- text-to-speech
- keyboard shortcuts
- route protection
- auto-save
- exam flow fudud
- dashboards kala duwan oo role-ku ku xiran yahay

Code-ka hadda jira, frontend-ku wuxuu leeyahay:

- `19` page components
- `4` shared components
- `2` context providers
- `3` custom hooks
- `3` utility files

Taasi waxay muujinaysaa in frontend-ku yahay qayb si fiican loo kala habeeyey, oo aan ahayn hal file oo keliya.

## Frontend Features-ka Ugu Muhiimsan

Haddii aan frontend-ka u kala saarno shaqooyin waaweyn, wuxuu leeyahay ugu yaraan `15` feature oo muuqda:

1. Student login oo ku shaqayn kara student ID.
2. Admin login oo email/password ah.
3. Teacher login oo email/password ah.
4. Role-based routing si user kasta loogu geeyo bogga ku habboon.
5. Protected routes si user aan fasax lahayn uusan u galin pages xaddidan.
6. Student dashboard oo muujinaya exam queue iyo imtixaanka xiga.
7. Exam page leh navigation, progress, answer saving, iyo finish flow.
8. Voice commands sida `next`, `previous`, `repeat`, `finish`, `option A-D`, iyo erayo Somali/English isugu jira.
9. Text-to-speech si su'aalaha cod ahaan loo akhriyo.
10. Open-ended dictation support iyo save confirmation.
11. Audio recording inta exam-ku socdo iyo upload gareyn backend-ka.
12. Result page oo muujinaya natiijooyinka iyo PDF download.
13. Admin management pages: faculties, classes, semesters, subjects, students, teachers.
14. Exam management: create, edit, delete, analytics, responses, exam codes.
15. Reports, recordings, result matrix, iyo monitoring pages.

## Qaab-dhismeedka Folder-ka Frontend

Frontend-ku waxa uu ku jiraa folder-ka `frontend/`. Qaybaha ugu muhiimsan waa kuwaan:

### `frontend/package.json`

Waa meesha laga maamulo packages-ka frontend-ka, scripts-ka `dev`, `build`, iyo `preview`.

### `frontend/vite.config.js`

File-kan wuxuu dejinayaa:

- Vite dev server
- port `5173`
- proxy-ga `/api` oo u gudbaya backend-ka `http://localhost:5000`
- proxy-ga `/ml` oo u gudbaya ml-service `http://localhost:8000`

Taasi waxay sahlaysaa in frontend-ku si nadiif ah ula hadlo backend iyo ml-service inta development-ku socdo.

### `frontend/index.html`

Waa entry HTML-ga ugu weyn. Waxaa ku jira:

- root element-ka React
- Google Fonts
- Font Awesome CDN links
- title iyo meta description

### `frontend/src/main.jsx`

Waa halka React app-ka laga boot gareeyo. Waxay ku mount-gareysaa `App` gudaha `#root`.

### `frontend/src/App.jsx`

Tani waa maskaxda routing-ka frontend-ka. Waxay dejisaa:

- public route
- student routes
- admin routes
- teacher routes
- catch-all redirect

Waxay sidoo kale ku duubtaa app-ka:

- `AuthProvider`
- `ExamProvider`
- `BrowserRouter`

### `frontend/src/api/`

Folder-kan waxa ku jira `axios.js`, oo ah HTTP client-ka guud. Shaqadiisu waa:

- inuu dejiyo `baseURL`
- inuu token-ka `Bearer` si toos ah ugu xiro request kasta
- inuu qabto `401 Unauthorized` oo uu user-ka dib ugu celiyo login

### `frontend/src/context/`

Waxa ku jira laba context oo waaweyn:

- `AuthContext.jsx`
- `ExamContext.jsx`

`AuthContext` wuxuu maamulaa:

- user state
- token
- login/logout
- role normalization
- default route per role

`ExamContext` wuxuu maamulaa:

- exam-ka current-ka ah
- sections
- questions
- current question index
- answers
- start time
- finish state
- result
- audio recording lifecycle
- answer save
- finish exam

Marka la eego architecture-ga, `ExamContext` waa wadnaha student exam experience-ka.

### `frontend/src/hooks/`

Waxaa yaal saddex custom hooks:

- `useVoiceCommands.js`
- `useTTS.js`
- `useAutoUpdate.js`

`useVoiceCommands`:

- wuxuu adeegsadaa Web Speech API
- wuxuu turjumaa codka user-ka una beddelaa command
- wuxuu taageeraa commands Somali iyo English ah
- wuxuu qaban karaa option letters, student ID, iyo exam code

`useTTS`:

- wuxuu adeegsadaa browser speech synthesis
- wuxuu akhriyaa su'aalaha
- wuxuu maamulaa rate, voice, pause, resume, stop

`useAutoUpdate`:

- wuxuu callback ku celiyaa interval joogto ah
- waxaa loo adeegsadaa pages qaarkood si xogtu u noqoto fresh

### `frontend/src/components/`

Waxa ku jira shared UI pieces:

- `ProtectedRoute.jsx`
- `AdminLayout.jsx`
- `SearchInput.jsx`
- `VoiceFeedback.jsx`

`ProtectedRoute` wuxuu xaqiijiyaa authentication iyo role authorization.

`AdminLayout` wuxuu bixiyaa:

- sidebar
- navigation
- role-specific menu
- logout
- main content wrapper

`SearchInput` wuxuu fududeeyaa raadinta admin pages-ka.

`VoiceFeedback` wuxuu soo bandhigaa alert/toast marka voice command la qabto.

### `frontend/src/pages/`

Folder-kan waa meesha ay ku jiraan bogagga ugu waaweyn ee system-ka. Code-ka hadda jira waxaa ku jira `19` page:

- `LoginPage.jsx`
- `StudentDashboard.jsx`
- `ExamPage.jsx`
- `ResultPage.jsx`
- `AdminDashboard.jsx`
- `AdminExams.jsx`
- `AdminStudents.jsx`
- `AdminTeachers.jsx`
- `AdminFaculties.jsx`
- `AdminClasses.jsx`
- `AdminSemesters.jsx`
- `AdminSubjects.jsx`
- `AdminResultExam.jsx`
- `AdminRecordings.jsx`
- `ExamCreator.jsx`
- `ReportsPage.jsx`
- `TeacherDashboard.jsx`
- `TeacherExams.jsx`
- `TeacherExamResponses.jsx`

Bog walba wuxuu leeyahay shaqo u gaar ah. Tusaale ahaan:

- `LoginPage` waa entry point-ka dhammaan users
- `ExamPage` waa bogga ugu culus, sababtoo ah wuxuu isku daraa TTS, voice, keyboard shortcuts, answer saving, help AI, iyo finish flow
- `ExamCreator` waa bogga lagu abuuro ama lagu edit-gareeyo imtixaan
- `ReportsPage` iyo `AdminResultExam` waa bogag reporting/analytics ah
- `AdminRecordings` wuxuu maamulaa dhageysiga recordings-ka exam-ka

### `frontend/src/utils/`

Waxaa yaal saddex utility file:

- `studentIdSpeech.js`
- `search.js`
- `resultExamSync.js`

`studentIdSpeech.js`:

- wuxuu ka caawiyaa parsing student ID laga sheegay cod ahaan
- wuxuu taageeraa digit words, letter words, iyo Somali/English mixed speech

`search.js`:

- wuxuu bixiyaa text normalization iyo search matching helpers

`resultExamSync.js`:

- wuxuu sameeyaa sync event u dhexeeya tabs/windows
- wuxuu adeegsadaa `localStorage`, `BroadcastChannel`, iyo `CustomEvent`

## Sidee Frontend-ku U Shaqeeyaa

Marka user-ku galo system-ka:

1. `LoginPage` ayaa qabata credentials-ka.
2. Request ayaa loo diraa backend.
3. Haddii login-ku sax noqdo, token iyo user info waxaa lagu kaydiyaa `localStorage`.
4. `AuthContext` ayaa user-ka normalise-gareeya kana dhigaya `student`, `teacher`, `admin`, ama `super_admin`.
5. `App.jsx` ayaa user-ka u redirect-gareeya route-kiisa saxda ah.

Marka student-ku exam galo:

1. `StudentDashboard` ayaa soo qaadata exam queue.
2. `ExamContext` ayaa diyaariya exam, sections, questions, answers, iyo timer.
3. `ExamPage` ayaa soo bandhigta su'aalaha.
4. Haddii question-ku yahay MCQ ama true/false, answer-ka si degdeg ah ayaa loo save-gareeyaa.
5. Haddii question-ku yahay open-ended, ardaygu wuu qori karaa ama cod ahaan ayuu u sheegi karaa.
6. Voice/TTS system-ku wuxuu kor u qaadaa accessibility.
7. Exam recording sidoo kale waa la shidi karaa si codka exam-ka loo keydiyo.
8. Marka la dhammeeyo, result page ayaa la tusaa.

## Accessibility-ga Frontend-ka

Mashruucan frontend-kiisa waxa laga dheehan karaa in accessibility-gu uu yahay feature aasaasi ah, ma aha wax dambe lagu daray. Tusaalooyinka muuqda:

- voice commands gudaha exam-ka
- text-to-speech
- keyboard shortcuts
- high contrast settings oo ku jira student model
- speech rate support
- live regions iyo alerts
- repeat question flow
- save confirmation ee dictation-ka

Waxa kale oo muhiim ah in frontend-ku uusan ku koobnayn command English keliya; files-ka qaarkood waxay muujinayaan erayo Somali ah sida `xiga`, `hore`, `caawi`, `dhammee`, `keydi`, iyo `tir tir`.

## Packages-ka Frontend-ka iyo Faa'iidooyinkooda

Qaybtan waxaan ku sharxayaa packages-ka si toos ah loogu qeexay `frontend/package.json`. Kuwani waa packages-ka ugu muhiimsan ee si rasmi ah frontend-ku u adeegsado. `node_modules` gudaheeda waxaa jiri kara dependencies kale oo ka dhasha kuwaan, laakiin kuwa hoose waa kuwa top-level ah.

| Package | Nooca | Waxa loo adeegsado | Faa'iidada |
|---|---|---|---|
| `react` | dependency | Dhismaha UI components | Waxay sahlaysaa component-based architecture, state management, iyo app weyn oo si nadiif ah loo maamulo |
| `react-dom` | dependency | React in browser-ka lagu render-gareeyo | Waxay xiriirisaa React components iyo DOM-ka browser-ka |
| `react-router-dom` | dependency | Routing iyo navigation | Waxay fududeyneysaa protected routes, nested navigation, redirects, iyo role-based page flow |
| `axios` | dependency | API requests | Waxay sahlaysaa requests consistent ah, interceptors, auth headers, iyo error handling |
| `vite` | devDependency | Dev server iyo bundling | Waa build tool degdeg badan leh, hot reload fiican, iyo setup fudud |
| `@vitejs/plugin-react` | devDependency | React support gudaha Vite | Waxay awood u siisaa Vite inuu si sax ah u fahmo React/JSX |
| `@types/react` | devDependency | Type definitions | Inkastoo project-ku JS yahay, package-kan wuxuu ka caawiyaa editor tooling iyo autocomplete |
| `@types/react-dom` | devDependency | Type definitions | Wuxuu hagaajiyaa editor support-ka ee React DOM APIs |

## Gunaanad

Frontend-kan ma aha UI fudud oo keliya; waa qayb si xeel dheer loo habeeyey oo isku darsatay:

- exam workflow
- accessibility workflow
- role management
- dashboards
- reporting
- audio interaction

Marka la eego code-ka hadda jira, frontend-ku wuxuu si gaar ah ugu xooggan yahay `ExamPage`, `AuthContext`, `ExamContext`, iyo admin/teacher management pages. Tani waxay ka dhigaysaa frontend-ka mashruucan mid leh shaqooyin badan, qaab dhismeed nadiif ah, iyo taageero muuqata oo accessibility ah.

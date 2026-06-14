# ML Service Documentation

## Hordhac

`ml-service` waa adeegga Python AI-ga ee mashruucan. Waxa lagu dhisay **Flask**, wuxuuna u shaqeeyaa sidii service gaar ah oo frontend-ka iyo backend-ku ka kaalmaysta howlaha AI iyo NLP. Waxaa lagu wadaa port `8000`.

Service-kan ma aha database service ama CRUD service; waa service diiradda saaraya:

- semantic similarity
- answer grading
- help/explanation generation
- voice command understanding
- AI safety gudaha exam-ka

Code-ka hadda jira `ml-service` folder-ku wuxuu leeyahay:

- `1` main app file: `app.py`
- `1` requirements file
- `2` test files oo tijaabiya AI endpoints
- `1` test output file
- `1` `.env` file

Waxa ugu muhiimsan dhammaantood waa `app.py`, kaas oo ah maskaxda adeegga AI-ga.

## Imisa Models ayuu leeyahay `ml-service`?

Haddii aan eegno code-ka hadda jira, `ml-service` wuxuu isticmaalaa **2 nooc oo AI model pretrained ah**, iyo dhowr logical AI layers oo kale.

### Models-ka AI ee sida tooska ah loo adeegsaday

1. `all-MiniLM-L6-v2`
2. `google/flan-t5-small`

### Qaabka loo adeegsado

`all-MiniLM-L6-v2`

- waxaa lagu load-gareeyaa `SentenceTransformer`
- waxaa loo adeegsadaa semantic similarity
- waxaa loo adeegsadaa open-ended grading
- sidoo kale waxaa loo adeegsadaa voice command intent matching gudaha `VoiceCommandAgent`

`google/flan-t5-small`

- waxaa lagu load-gareeyaa `AutoTokenizer` iyo `AutoModelForSeq2SeqLM`
- waxaa loo adeegsadaa `HelpAssistant`
- wuxuu sameeyaa sharaxaad ama caawimo aan answer-ka sheegin

### Logical AI Layers oo kale

Marka laga soo tago labada model ee pretrained-ka ah, service-kan wuxuu kaloo leeyahay layers kale oo muhiim ah:

- `keyword_similarity` fallback
- `VoiceCommandAgent` class
- `HelpAssistant` class
- regex-based entity extraction
- safety rules si answers toos ah aan loo bixin

Marka si guud loo hadlo:

- `2` pretrained ML/NLP models
- `2` AI workflow classes
- `1` fallback similarity method

## Qaab-dhismeedka Folder-ka `ml-service`

### `ml-service/app.py`

Tani waa file-ka ugu weyn. Waxa uu leeyahay ku dhowaad dhammaan logic-ka AI-ga:

- Flask app setup
- CORS
- lazy model loading
- semantic similarity grading
- feedback generation
- voice command agent
- help assistant
- health endpoint

### `ml-service/requirements.txt`

Waa file-ka qeexaya dependencies-ka Python ee service-kan.

### `ml-service/test_voice_agent.py`

Wuxuu tijaabiyaa endpoint-ka:

- `/ml/process-voice-command`

Wuxuu hubiyaa intents sida:

- login ID
- exam code
- next question
- previous question
- skip
- MCQ answer
- open answer
- confirm/cancel
- finish exam

### `ml-service/test_help_agent.py`

Wuxuu tijaabiyaa endpoint-ka:

- `/ml/help`

Wuxuu xaqiijiyaa:

- anxiety support
- answer-blocking
- explanation mode

### `ml-service/test_output.txt`

Waa file lagu kaydin karo output tijaabooyin ama logs la xiriira tests.

### `.env`

Waxa laga maamulaa config sida:

- `PORT`
- `MODEL_NAME`

`MODEL_NAME` wuxuu si gaar ah u saameeyaa sentence-transformer model-ka grading/intent-ka.

## Endpoints-ka uu leeyahay `ml-service`

Code-ka hadda jira wuxuu leeyahay `4` Flask routes:

1. `/ml/grade-open-ended`
2. `/ml/process-voice-command`
3. `/ml/help`
4. `/ml/health`

### 1. `/ml/grade-open-ended`

Route-kan wuxuu qaataa:

- `questionId`
- `studentAnswer`
- `referenceAnswer`

Kadib:

1. Wuxuu qaadayaa student answer-ka.
2. Wuxuu qaadayaa reference answer-ka.
3. Wuxuu sameeyaa semantic similarity.
4. Similarity-ga ayuu u rogaa score `0-100`.
5. Wuxuu abuuraa feedback ku xiran score-ka.

Haddii model-ku load-gareyn waayo:

- wuxuu u dhacayaa `keyword_similarity` fallback

Taasi waxay ka dhigan tahay service-ku inuusan si buuxda u joojin shaqada xitaa haddii model load-ku dhib galo.

### 2. `/ml/process-voice-command`

Route-kan wuxuu qaataa text laga soo saaray codka, kadib:

1. Wuxuu isku dayaa inuu garto intent-ka.
2. Wuxuu isticmaalaa direct phrase matching iyo semantic similarity.
3. Wuxuu ka saaraa entities sida:
   - `studentId`
   - `examCode`
   - `option`
   - `answerText`
4. Wuxuu soo celiyaa structured JSON.

Intent-yada uu fahmi karo waxaa ka mid ah:

- `LOGIN_ID`
- `EXAM_CODE`
- `ENTER_EXAM`
- `START_EXAM`
- `GO_TO_SECTION`
- `NEXT_QUESTION`
- `PREVIOUS_QUESTION`
- `REPEAT_QUESTION`
- `SKIP_QUESTION`
- `ANSWER_MCQ`
- `ANSWER_OPEN`
- `CONFIRM`
- `CANCEL`
- `HOW_MANY_REMAINING`
- `WHERE_AM_I`
- `GO_TO_UNANSWERED`
- `FINISH_EXAM`

### 3. `/ml/help`

Route-kan waa feature AI help assistant-ka. Wuxuu qaataa:

- `studentText`
- `questionText`

Kadib:

1. Wuxuu baarayaa haddii ardaygu si toos ah answer u dalbanayo.
2. Haddii answer la dalbanayo, wuxuu diidayaa.
3. Wuxuu baarayaa anxiety ama stress phrases.
4. Haddii ardaygu cabsi dareemayo, wuxuu bixiyaa support/calm response.
5. Haddii su'aal sharaxaad ah la dalbado, wuxuu sameeyaa prompt ammaan ah.
6. `flan-t5-small` ayaa ka soo saara sharaxaad kooban oo aan answer reveal-gareyn.

### 4. `/ml/health`

Waa health check endpoint. Wuxuu soo sheegaa:

- status
- model loaded mise maya
- model name

## Sidee Models-ka iyo AI-ga U Shaqeeyaan

Qaybtan waa tan ugu muhiimsan, sababtoo ah waxaad codsatay sharaxaad badan oo ku saabsan sida AI-ga u shaqeeyo.

### A. Semantic Grading Model

Model-ka `all-MiniLM-L6-v2` waxaa loo adeegsadaa inuu fahmo isku ekaanshaha macnaha laba qoraal:

- student answer
- reference answer

Tallaabooyinka:

1. Labada text waxaa loo rogaa embeddings.
2. Embeddings-kaas waxaa lagu sameeyaa cosine similarity.
3. Similarity-ga waxaa laga soo saaraa value u dhaxaysa `0` iyo `1`.
4. Value-gaas waxaa loo beddelaa score `0-100`.
5. Score-kaas waxaa lagu lifaaqaa feedback qoraal ah.

Faa'iidada habkan:

- ma eego kelmad keliya oo sax ah
- wuxuu qiimeeyaa macnaha guud
- wuxuu ka fiican yahay exact string matching

Laakiin waa muhiim in la caddeeyo:

- backend-ka current-ka ahi open-ended answers **si toos ah uguma xiro** route-kan grading-ka
- sidaas darteed endpoint-kan waa diyaarsan yahay, laakiin exam flow-ga hadda waxaa ka xoog badan manual grading

### B. Voice Command Understanding

`VoiceCommandAgent` wuxuu isticmaalaa laba hab:

1. direct keyword/anchor phrase matching
2. semantic similarity model

Marka text cod laga keenay yimaado:

1. agent-ku wuxuu barbar dhigaa anchors intents kala duwan leh
2. haddii phrase cad la helo, score sare ayuu siinayaa
3. haddii kale, embedding similarity ayuu adeegsadaa
4. intent-ka score-ga ugu sarreeya ayuu qaataa
5. kadib regex ayuu ku saaraa entity-ga saxda ah

Tusaale:

- "My ID is 2024001" -> `LOGIN_ID`
- "My exam code is 1 2 3 4 5 6" -> `EXAM_CODE`
- "My answer is B" -> `ANSWER_MCQ`
- "My answer is the powerhouse of the cell" -> `ANSWER_OPEN`

### C. Help Assistant

`HelpAssistant` waa qaybta ugu dareenka badan ee AI-ga exam-kan, sababtoo ah waa inuu caawiyo ardayga adigoon jebin integrity-ga exam-ka.

Wuxuu leeyahay saddex lakab:

1. `safety detection`
2. `emotion/anxiety support`
3. `safe generation`

#### 1. Safety Detection

Haddii student-ku yiraahdo wax la mid ah:

- "what is the answer"
- "tell me the answer"
- "give me the answer"
- "solve this"

assistant-ku si toos ah ayuu u diidayaa.

#### 2. Anxiety Support

Haddii student-ku yiraahdo:

- nervous
- scared
- panic
- anxious
- stress

assistant-ku wuxuu bixiyaa hadal dejin ah sida:

- neef qaado
- hal su'aal mar diiradda saar

#### 3. Safe Generation

Haddii student-ku rabo sharaxaad eray ama su'aal:

1. prompt ammaan ah ayaa la sameeyaa
2. prompt-ku si cad ayuu u leeyahay "explain without giving the answer"
3. `google/flan-t5-small` ayaa soo saara jawaabta

Tani waxay ka dhigaysaa AI-ga mid caawin kara ardayga, laakiin aan noqon answer engine.

## Sidee Codka AI-ku U Shaqeeyaa Mashruucan

Waxaa muhiim ah in la kala saaro laba heer:

### Heerka 1: Frontend voice handling

Frontend-ku wuxuu leeyahay `useVoiceCommands` oo browser-ka gudihiisa ku shaqeeya. Taasi waxay ka dhigan tahay in commands badan sida:

- next
- previous
- option A
- yes
- no

si local ah loogu maamulo frontend-ka, iyadoon ml-service la gaarin.

### Heerka 2: AI help flow

Marka frontend-ku arko hadallo u eg:

- help
- understand
- explain
- nervous
- what does

`ExamPage` ayaa u dira request:

- `POST /ml/help`

Markaa AI service-ku wuxuu bixiyaa sharaxaad ama support response.

### Qodob muhiim ah

Code-ka hadda jira:

- frontend-ku **wuxuu si firfircoon u isticmaalaa** `/ml/help`
- frontend-ku **ma waco hadda** `/ml/process-voice-command`
- backend-ku **ma waco hadda si firfircoon** `/ml/grade-open-ended`

Tani waa faahfaahin aad muhiim u ah, sababtoo ah waxay muujinaysaa farqiga u dhexeeya:

- waxa service-ku qaban karo
- iyo waxa current application flow-ku dhab ahaan wacayo

## Packages-ka `ml-service` iyo Faa'iidooyinkooda

Kuwan hoose waa packages-ka ku qoran `ml-service/requirements.txt`.

| Package | Waxa loo adeegsado | Faa'iidada |
|---|---|---|
| `flask` | Dhismaha API-ga Python | Waxay sahashaa routes, request handling, iyo lightweight service architecture |
| `flask-cors` | CORS support | Waxay u oggolaanaysaa frontend-ka inuu si ammaan ah ula xiriiro ml-service |
| `sentence-transformers` | Embedding models iyo semantic similarity | Waxay siisaa model awood u leh inuu fahmo macnaha qoraalka |
| `torch` | Deep learning backend | Waa engine-ka hoose ee models badan oo transformers ah |
| `numpy` | Numerical operations | Waxay ka caawisaa xisaabaadka tensors/vectors iyo processing guud |
| `transformers` | Hugging Face model loading iyo text generation | Waxay suurto galisaa isticmaalka `flan-t5-small` iyo models kale |
| `accelerate` | Efficient model execution | Waxay ka caawisaa performance iyo model runtime management |

## Faa'iidooyinka Guud ee `ml-service`

Service-kan wuxuu mashruuca siinayaa faa'iidooyin badan:

- semantic understanding halkii keyword matching keliya laga isticmaali lahaa
- AI help oo la xakameeyey
- voice command interpretation oo ka caqli badan regex keliya
- fallback behavior haddii model load-ku guuldareysto
- service gooni ah oo la kala maamuli karo kana madax-bannaan frontend iyo backend

## Gunaanad

`ml-service` waa maskaxda AI ee mashruucan. Inkasta oo current production flow-gu uusan weli wada isticmaalin endpoints-ka oo dhan, haddana code-ka hadda jira wuxuu muujinayaa adeeg si wanaagsan loo diyaariyey oo leh:

- `2` pretrained AI models
- `4` API endpoints
- grading logic
- help assistant logic
- voice command understanding
- safety controls

Haddii mustaqbalka mashruuca la balaariyo, service-kan wuxuu si fudud u noqon karaa xarunta ugu weyn ee:

- automated grading
- conversational accessibility support
- intelligent voice exam interaction

Sidaas darteed, `ml-service` waa qayb aad u qiimo badan, gaar ahaan dhinaca accessibility iyo AI-driven assistance.

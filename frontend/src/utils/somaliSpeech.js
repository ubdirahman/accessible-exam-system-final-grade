export const SOMALI_LANG = 'so-SO';
export const SOMALI_TTS_RATE = 0.82;

export const SOMALI_RECOGNITION_OPTIONS = {
    lang: SOMALI_LANG,
    fallbackLang: 'en-US',
    continuous: true,
    interimResults: true,
    maxAlternatives: 5
};

export const SOMALI_TTS_DEFAULTS = {
    lang: SOMALI_LANG,
    rate: SOMALI_TTS_RATE,
    pitch: 1,
    volume: 1
};

export const SOMALI_START_CONFIRMATION_PROMPT = 'Diyaar ma u tahay inaan kuu bilaabo imtixaanka? Fadlan dheh haa ama maya.';
export const SOMALI_LOGOUT_CONFIRMATION_PROMPT = 'Ma hubtaa inaad rabto inaad ka baxdo? Fadlan dheh haa ama maya.';

const SOMALI_DIGIT_NAMES = {
    0: 'eber',
    1: 'kow',
    2: 'labo',
    3: 'saddex',
    4: 'afar',
    5: 'shan',
    6: 'lix',
    7: 'todoba',
    8: 'sideed',
    9: 'sagaal'
};

const SOMALI_TENS_NAMES = {
    10: 'toban',
    20: 'labaatan',
    30: 'soddon',
    40: 'afartan',
    50: 'konton',
    60: 'lixdan',
    70: 'todobaatan',
    80: 'sideetan',
    90: 'sagaashan'
};

export function somaliTtsOptions(options = {}) {
    return {
        ...SOMALI_TTS_DEFAULTS,
        ...options,
        lang: options.lang || SOMALI_LANG,
        rate: options.rate ?? SOMALI_TTS_DEFAULTS.rate,
        pitch: options.pitch ?? SOMALI_TTS_DEFAULTS.pitch,
        volume: options.volume ?? SOMALI_TTS_DEFAULTS.volume
    };
}

export function formatSomaliNumber(value, fallback = 'eber') {
    const number = Number(value);

    if (!Number.isFinite(number)) return fallback;
    if (!Number.isInteger(number)) return String(value);
    if (number < 0) return `minus ${formatSomaliNumber(Math.abs(number), fallback)}`;
    if (number < 10) return SOMALI_DIGIT_NAMES[number] || String(number);
    if (number < 100) {
        const tens = Math.floor(number / 10) * 10;
        const ones = number % 10;
        return ones
            ? `${SOMALI_TENS_NAMES[tens]} iyo ${formatSomaliNumber(ones)}`
            : SOMALI_TENS_NAMES[tens];
    }
    if (number < 1000) {
        const hundreds = Math.floor(number / 100);
        const rest = number % 100;
        const hundredsText = hundreds === 1 ? 'boqol' : `${formatSomaliNumber(hundreds)} boqol`;
        return rest ? `${hundredsText} iyo ${formatSomaliNumber(rest)}` : hundredsText;
    }

    return String(number);
}

export function formatSomaliList(items = [], emptyText = 'ma jiraan') {
    const cleanItems = items
        .map((item) => String(item || '').trim())
        .filter(Boolean);

    if (!cleanItems.length) return emptyText;
    if (cleanItems.length === 1) return cleanItems[0];
    if (cleanItems.length === 2) return `${cleanItems[0]} iyo ${cleanItems[1]}`;
    return `${cleanItems.slice(0, -1).join(', ')} iyo ${cleanItems[cleanItems.length - 1]}`;
}

export function formatSomaliMinutes(value) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes <= 0) return '';
    return `${formatSomaliNumber(minutes)} daqiiqo`;
}

export function buildStudentDashboardSomaliSpeech({
    studentName = 'arday',
    currentExam = null,
    examData = null,
    queueData = null,
    completedExams = [],
    remainingAfterCurrent = [],
    latestCompletedExam = null,
    includeStartPrompt = true
} = {}) {
    const cleanName = String(studentName || 'arday').trim() || 'arday';
    const totalCount = queueData?.totalCount || 0;
    const completedCount = queueData?.completedCount || completedExams.length || 0;

    if (totalCount === 0) {
        return [
            `Soo dhawoow ${cleanName}.`,
            'Hadda ma jiro imtixaan kuu qorshaysan.',
            'Markaad rabto inaad nidaamka ka baxdo, dheh ka bax.'
        ].join(' ');
    }

    if (!currentExam) {
        return [
            `Soo dhawoow ${cleanName}.`,
            `Waxaad dhammeystirtay dhammaan ${formatSomaliNumber(completedCount)} imtixaan oo kuu qorshaysnaa.`,
            completedExams.length
                ? `Maaddooyinka aad dhammeystirtay waa ${formatSomaliList(completedExams.map((exam) => exam.subjectName))}.`
                : '',
            latestCompletedExam?.subjectName
                ? `Imtixaankii kuugu dambeeyay wuxuu ahaa ${latestCompletedExam.subjectName}.`
                : '',
            'Hadda ma jiro imtixaan kale oo kuu dhiman. Markaad rabto inaad baxdo, dheh ka bax.'
        ].filter(Boolean).join(' ');
    }

    const subjectName = currentExam.subjectName || currentExam.title || 'imtixaan';
    const examTitle = currentExam.title || currentExam.subjectName || '';
    const totalQuestions = examData?.questions?.length || 0;
    const timeLimit = currentExam.timeLimit || examData?.exam?.timeLimit || examData?.timeLimit || 0;
    return [
        `Soo dhawoow ${cleanName}.`,
        `Waxaa kuu yaalla imtixaanka maaddada ${subjectName}.`,
        examTitle && examTitle !== subjectName ? `Magaca imtixaanku waa ${examTitle}.` : '',
        timeLimit > 0
            ? `Waqtiga imtixaanku waa ${formatSomaliMinutes(timeLimit)}.`
            : 'Imtixaankani waqti xaddidan ma laha.',
        totalQuestions > 0 ? `Imtixaanku wuxuu ka kooban yahay ${formatSomaliNumber(totalQuestions)} su'aalood.` : '',
        includeStartPrompt ? SOMALI_START_CONFIRMATION_PROMPT : ''
    ].filter(Boolean).join(' ');
}

export function spellStudentIdInSomali(value = '') {
    const clean = String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

    if (!clean) return '';

    return clean
        .split('')
        .map((char, index) => {
            if (/\d/.test(char)) return SOMALI_DIGIT_NAMES[char] || char;
            return index === 0 ? `xarafka ${char}` : char;
        })
        .join(', ');
}
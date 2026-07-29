const ENGLISH_DIGIT_NAMES = {
    0: 'zero',
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine'
};

const DIGIT_WORDS = {
    zero: '0',
    oh: '0',
    ooh: '0',
    eber: '0',
    aber: '0',
    abir: '0',
    iber: '0',
    ever: '0',
    one: '1',
    won: '1',
    wan: '1',
    hal: '1',
    kow: '1',
    koow: '1',
    cow: '1',
    two: '2',
    to: '2',
    too: '2',
    laba: '2',
    labo: '2',
    labba: '2',
    labbo: '2',
    laabo: '2',
    three: '3',
    tree: '3',
    saddex: '3',
    sadex: '3',
    seddex: '3',
    sedex: '3',
    sadax: '3',
    seddax: '3',
    four: '4',
    for: '4',
    afar: '4',
    affar: '4',
    offer: '4',
    far: '4',
    five: '5',
    shan: '5',
    shaan: '5',
    sean: '5',
    shawn: '5',
    shaun: '5',
    six: '6',
    lix: '6',
    lex: '6',
    leaks: '6',
    licks: '6',
    seven: '7',
    todoba: '7',
    toddoba: '7',
    todooba: '7',
    todobo: '7',
    toddobo: '7',
    eight: '8',
    ate: '8',
    sideed: '8',
    siddeed: '8',
    sideet: '8',
    seeded: '8',
    sided: '8',
    nine: '9',
    sagaal: '9',
    sagal: '9',
    sagael: '9'
};

const LETTER_WORDS = {
    a: 'A',
    ay: 'A',
    ei: 'A',
    alpha: 'A',
    b: 'B',
    bee: 'B',
    bi: 'B',
    bravo: 'B',
    c: 'C',
    cee: 'C',
    si: 'C',
    sii: 'C',
    ci: 'C',
    see: 'C',
    sea: 'C',
    she: 'C',
    shi: 'C',
    charlie: 'C',
    d: 'D',
    dee: 'D',
    di: 'D',
    delta: 'D',
    e: 'E',
    ee: 'E',
    echo: 'E',
    f: 'F',
    ef: 'F',
    foxtrot: 'F',
    g: 'G',
    gee: 'G',
    golf: 'G',
    h: 'H',
    aitch: 'H',
    hotel: 'H',
    i: 'I',
    eye: 'I',
    india: 'I',
    j: 'J',
    jay: 'J',
    juliet: 'J',
    k: 'K',
    kay: 'K',
    kilo: 'K',
    l: 'L',
    el: 'L',
    lima: 'L',
    m: 'M',
    em: 'M',
    am: 'M',
    mike: 'M',
    n: 'N',
    en: 'N',
    an: 'N',
    november: 'N',
    oscar: 'O',
    p: 'P',
    pee: 'P',
    papa: 'P',
    q: 'Q',
    cue: 'Q',
    queue: 'Q',
    quebec: 'Q',
    r: 'R',
    ar: 'R',
    romeo: 'R',
    s: 'S',
    ess: 'S',
    sierra: 'S',
    t: 'T',
    tee: 'T',
    tango: 'T',
    u: 'U',
    you: 'U',
    uniform: 'U',
    v: 'V',
    vee: 'V',
    victor: 'V',
    w: 'W',
    doubleyou: 'W',
    whiskey: 'W',
    x: 'X',
    ex: 'X',
    xray: 'X',
    y: 'Y',
    why: 'Y',
    yankee: 'Y',
    z: 'Z',
    zee: 'Z',
    zed: 'Z',
    zulu: 'Z'
};

const IGNORED_TOKENS = new Set([
    'my',
    'student',
    'id',
    'is',
    'waa',
    'yahay',
    'this',
    'the',
    'please',
    'number',
    'numberka',
    'nambar',
    'nambarka',
    'nambarkayga',
    'nambarkaygu',
    'lambar',
    'lambarka',
    'lambarkayga',
    'lambarkaygu',
    'arday',
    'ardayga',
    'kayga',
    'kaaga',
    'aqoonsi',
    'aqoonsiga',
    'aqoonsigaygu',
    'fadlan',
    'akhri',
    'dheh'
]);

const PHRASE_REPLACEMENTS = [
    [/\bi\s*d\b/g, 'id'],
    [/\ba\s+far\b/g, 'afar'],
    [/\baf\s+ar\b/g, 'afar'],
    [/\bsa\s+ddex\b/g, 'saddex'],
    [/\bsa\s+dex\b/g, 'sadex'],
    [/\bse\s+dex\b/g, 'sedex'],
    [/\bto\s+do\s+ba\b/g, 'todoba'],
    [/\btodoo\s+ba\b/g, 'todooba'],
    [/\bside\s+ed\b/g, 'sideed'],
    [/\bsid\s+deed\b/g, 'siddeed'],
    [/\bsa\s+gaal\b/g, 'sagaal']
];

const ID_CUE_REGEX = /\b(?:my\s+student\s+id|student\s+id|my\s+id|my\s+i\s*d|i\s*d|id|aqoonsi(?:ga(?:ygu|yga|ga)?)?(?:\s+ardayga)?|nambark(?:a|ayga|eyga|aygu|aaga)?(?:\s+ardayga)?|lambark(?:a|ayga|eyga|aygu|aaga)?(?:\s+ardayga)?|numberk(?:a|ayga|eyga|aygu|aaga)?)(?:\s+(?:is|waa|yahay))?\s*(.*)$/i;

function normalizeSpeechText(input = '') {
    return PHRASE_REPLACEMENTS.reduce(
        (text, [pattern, replacement]) => text.replace(pattern, replacement),
        String(input || '')
            .toLowerCase()
            .replace(/[']/g, '')
            .replace(/[_-]+/g, ' ')
            .replace(/[^a-z0-9\s]+/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    );
}

function extractCandidateText(input = '') {
    const lower = normalizeSpeechText(input);

    const match = lower.match(ID_CUE_REGEX);
    if (match && match[1] && match[1].trim()) {
        return { candidate: match[1].trim(), hasCue: true };
    }

    return { candidate: lower.trim(), hasCue: false };
}

function isDigitLikeToken(token = '') {
    if (!token) return false;
    if (/^\d+$/.test(token)) return true;
    return !!DIGIT_WORDS[token];
}

function tokenToIdChunk(token = '', index = 0, tokens = [], hasCue = false) {
    if (!token) return '';

    if (token === 'o') {
        const prev = tokens[index - 1] || '';
        const next = tokens[index + 1] || '';
        const nearDigits = isDigitLikeToken(prev) || isDigitLikeToken(next);
        return nearDigits ? '0' : 'O';
    }

    if (DIGIT_WORDS[token]) return DIGIT_WORDS[token];
    if (LETTER_WORDS[token]) return LETTER_WORDS[token];

    if (/^\d+$/.test(token)) return token;
    if (/^[a-z]$/.test(token)) return token.toUpperCase();

    // Preserve compact typed/spoken IDs such as c1220199
    if (/^[a-z0-9]+$/.test(token) && /\d/.test(token)) {
        return token.toUpperCase();
    }

    if (/^[a-z]+$/.test(token)) {
        if (IGNORED_TOKENS.has(token)) return '';
        // Keep letter-only chunks such as CA, ABCD, etc.
        if (!hasCue && token.length > 8) return '';
        return token.toUpperCase();
    }

    return '';
}

export function extractStudentIdChunks(input = '') {
    const { candidate, hasCue } = extractCandidateText(input);
    if (!candidate) return [];

    const tokens = candidate
        .replace(/[^a-z0-9]+/gi, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (tokens.length === 0) return [];

    return tokens
        .map((token, index) => tokenToIdChunk(token, index, tokens, hasCue))
        .filter(Boolean);
}

export function normalizeStudentIdFromSpeech(input = '') {
    const parsed = extractStudentIdChunks(input).join('');
    return sanitizeStudentId(parsed);
}

export function extractSingleStudentIdCharacter(input = '') {
    const chunks = extractStudentIdChunks(input);
    if (chunks.length !== 1) return '';

    const single = sanitizeStudentId(chunks[0]);
    return single.length === 1 ? single : '';
}

export function sanitizeStudentId(value = '') {
    let clean = String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

    if (!clean) return '';

    const prefixIndex = clean.search(/[CMN]/);
    if (prefixIndex > 0) {
        clean = clean.slice(prefixIndex);
    }

    const firstChar = clean[0];

    // First character can only be C, M, or N if it is a letter.
    if (/[A-Z]/.test(firstChar) && firstChar !== 'C' && firstChar !== 'M' && firstChar !== 'N') {
        clean = clean.slice(1);
    }

    const firstPart = clean[0] || '';
    let restPart = clean.slice(1);

    if (firstPart === 'C' || firstPart === 'M' || firstPart === 'N') {
        restPart = restPart.replace(/[^0-9]/g, '');
        return firstPart + restPart;
    }

    return clean.replace(/[^0-9]/g, '');
}

export function isLikelyStudentId(value = '') {
    const id = sanitizeStudentId(value);
    return /^[CMN]\d+$/.test(id);
}

export function spellStudentId(value = '') {
    const clean = sanitizeStudentId(value);
    if (!clean) return '';

    return clean
        .split('')
        .map((char, index) => {
            if (/\d/.test(char)) return ENGLISH_DIGIT_NAMES[char] || char;
            return index === 0 ? `Letter ${char}` : char;
        })
        .join(' . . ');
}
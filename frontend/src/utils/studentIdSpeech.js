const DIGIT_WORDS = {
    zero: '0',
    oh: '0',
    one: '1',
    won: '1',
    two: '2',
    to: '2',
    too: '2',
    three: '3',
    tree: '3',
    four: '4',
    for: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    ate: '8',
    nine: '9',
    eber: '0',
    hal: '1',
    kow: '1',
    koow: '1',
    laba: '2',
    labbo: '2',
    saddex: '3',
    seddex: '3',
    afar: '4',
    shan: '5',
    lix: '6',
    todoba: '7',
    toddoba: '7',
    sideed: '8',
    sagaal: '9'
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
    ci: 'C',
    see: 'C',
    sea: 'C',
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
    mike: 'M',
    n: 'N',
    en: 'N',
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
    'this',
    'the',
    'please',
    'number',
    'nambar',
    'lambarka',
    'aqoonsi',
    'aqoonsiga',
    'aqoonsigaygu'
]);

const ID_CUE_REGEX = /\b(?:my\s+student\s+id|student\s+id|my\s+i\s*d|my\s+id|i\s*d|id|aqoonsi(?:ga(?:ygu)?)?)\b(?:\s+(?:is|waa))?\s*(.*)$/i;

function extractCandidateText(input = '') {
    const lower = input
        .toLowerCase()
        .replace(/[']/g, '')
        .replace(/[_-]+/g, ' ');

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
        // Keep letter-only chunks such as "CA", "ABCD", etc.
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

    return parsed.replace(/[^A-Z0-9]/g, '').toUpperCase();
}

export function extractSingleStudentIdCharacter(input = '') {
    const chunks = extractStudentIdChunks(input);
    if (chunks.length !== 1) return '';

    const single = sanitizeStudentId(chunks[0]);
    return single.length === 1 ? single : '';
}

export function sanitizeStudentId(value = '') {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

export function isLikelyStudentId(value = '') {
    const id = sanitizeStudentId(value);
    return /^[A-Z0-9]{4,40}$/.test(id);
}

export function spellStudentId(value = '') {
    return sanitizeStudentId(value).split('').join(' ');
}

/**
 * studentIdSpeech.js
 *
 * A comprehensive Somali + English voice-to-StudentID converter.
 * Handles how Somali speakers pronounce English digits and letters
 * through the browser speech recognition (which usually returns
 * Somali-influenced phonetics or English homophones).
 *
 * Goal: 100% accuracy when a blind student dictates their Student ID.
 */

// ─────────────────────────────────────────────
// Spelling-out map (for reading the ID back)
// ─────────────────────────────────────────────
const ENGLISH_DIGIT_NAMES = {
    0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four',
    5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine'
};

// ─────────────────────────────────────────────
// DIGIT recognition map
// Covers Somali pronunciation, English, and common ASR mismatches
// ─────────────────────────────────────────────
const DIGIT_WORDS = {
    // ── 0 ──
    'zero': '0', 'oh': '0', 'o': '0', 'ooh': '0', 'oo': '0',
    'eber': '0', 'aber': '0', 'abir': '0', 'iber': '0', 'ever': '0',
    'eeber': '0', 'nil': '0', 'nul': '0', 'null': '0',

    // ── 1 ──
    'one': '1', 'won': '1', 'wan': '1', 'wun': '1', 'un': '1',
    'kow': '1', 'koow': '1', 'kowow': '1', 'koo': '1', 'ku': '1',
    'hal': '1', 'haal': '1', 'cow': '1', 'ko': '1', 'kowaad': '1',
    'first': '1', '1st': '1',

    // ── 2 ──
    'two': '2', 'to': '2', 'too': '2', 'tu': '2', 'tuu': '2',
    'laba': '2', 'labo': '2', 'labba': '2', 'labbo': '2', 'laabo': '2',
    'laab': '2', 'labaad': '2', 'second': '2', '2nd': '2',

    // ── 3 ──
    'three': '3', 'tree': '3', 'tri': '3', 'free': '3', 'thre': '3',
    'saddex': '3', 'sadex': '3', 'seddex': '3', 'sedex': '3',
    'sadax': '3', 'seddax': '3', 'sadec': '3', 'sadik': '3',
    'saddec': '3', 'saadex': '3', 'saddexaad': '3', 'sadexaad': '3',

    // ── 4 ──
    'four': '4', 'for': '4', 'fore': '4', 'fur': '4', 'foor': '4',
    'afar': '4', 'affar': '4', 'offer': '4', 'afaar': '4',
    'afarr': '4', 'afer': '4', 'afaraad': '4',

    // ── 5 ──
    'five': '5', 'fife': '5', 'shan': '5', 'shaan': '5',
    'sean': '5', 'shawn': '5', 'shaun': '5', 'shon': '5',
    'shin': '5', 'shen': '5', 'shanaad': '5',

    // ── 6 ──
    'six': '6', 'siks': '6', 'lix': '6', 'lex': '6',
    'leaks': '6', 'licks': '6', 'lics': '6', 'liks': '6',
    'liix': '6', 'lixaad': '6',

    // ── 7 ──
    'seven': '7', 'sevin': '7', 'todoba': '7', 'toddoba': '7',
    'todooba': '7', 'todobo': '7', 'toddobo': '7', 'todaba': '7',
    'todba': '7', 'todobba': '7', 'toodoba': '7', 'todobaad': '7',

    // ── 8 ──
    'eight': '8', 'ate': '8', 'eit': '8', 'eiht': '8',
    'sideed': '8', 'siddeed': '8', 'sideet': '8', 'seeded': '8',
    'sided': '8', 'sidid': '8', 'sidiid': '8', 'siideed': '8',
    'siid': '8', 'sideedaad': '8',

    // ── 9 ──
    'nine': '9', 'nein': '9', 'nin': '9', 'nain': '9',
    'sagaal': '9', 'sagal': '9', 'sagael': '9', 'sagaall': '9',
    'sagaale': '9', 'sagaalaad': '9',

    // ── Tens & Hundreds ──
    'ten': '10', 'toban': '10', 'tobon': '10',
    'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14',
    'fifteen': '15', 'sixteen': '16', 'seventeen': '17', 'eighteen': '18',
    'nineteen': '19',
    'twenty': '20', 'labaatan': '20', 'labatan': '20',
    'thirty': '30', 'saddexdan': '30', 'sadexdan': '30', 'seddexdan': '30',
    'forty': '40', 'afartan': '40', 'afardaan': '40',
    'fifty': '50', 'konton': '50',
    'sixty': '60', 'lixon': '60', 'lixdan': '60',
    'seventy': '70', 'todobaatan': '70', 'toddobaatan': '70',
    'eighty': '80', 'sideedan': '80', 'siddeedan': '80',
    'ninety': '90', 'sagaashan': '90', 'sagashan': '90',
    'hundred': '00', 'boqol': '00'
};

// ─────────────────────────────────────────────
// LETTER recognition map
// Maps spoken words → uppercase letters
// Includes NATO phonetic alphabet + Somali phonetics
// ─────────────────────────────────────────────
const LETTER_WORDS = {
    // A
    'a': 'A', 'ay': 'A', 'ei': 'A', 'alpha': 'A', 'alef': 'A', 'alif': 'A',
    // B
    'b': 'B', 'bee': 'B', 'bi': 'B', 'bravo': 'B', 'be': 'B',
    // C — Somali "C" (ع) sounds like a voiced pharyngeal. Chrome may return:
    //     "I", "eye", "ah", "a", "ha", or even garbled words.
    //     We also handle standard English pronunciations.
    'c': 'C', 'cee': 'C', 'si': 'C', 'sii': 'C', 'ci': 'C',
    'see': 'C', 'sea': 'C', 'she': 'C', 'shi': 'C', 'charlie': 'C',
    'ce': 'C', 'cie': 'C', 'sei': 'C',
    // D
    'd': 'D', 'dee': 'D', 'di': 'D', 'delta': 'D', 'de': 'D',
    // E
    'e': 'E', 'ee': 'E', 'echo': 'E', 'ii': 'E',
    // F
    'f': 'F', 'ef': 'F', 'foxtrot': 'F', 'fe': 'F',
    // G
    'g': 'G', 'gee': 'G', 'golf': 'G', 'ge': 'G', 'ji': 'G',
    // H
    'h': 'H', 'aitch': 'H', 'hotel': 'H', 'haitch': 'H', 'he': 'H',
    // I
    'i': 'I', 'eye': 'I', 'india': 'I', 'ai': 'I',
    // J
    'j': 'J', 'jay': 'J', 'juliet': 'J', 'jey': 'J',
    // K
    'k': 'K', 'kay': 'K', 'kilo': 'K', 'ke': 'K',
    // L
    'l': 'L', 'el': 'L', 'lima': 'L', 'ell': 'L',
    // M
    'm': 'M', 'em': 'M', 'mike': 'M', 'me': 'M',
    // N
    'n': 'N', 'en': 'N', 'november': 'N', 'ne': 'N',
    // O — handled specially (could be digit 0 or letter O)
    'oscar': 'O',
    // P
    'p': 'P', 'pee': 'P', 'papa': 'P', 'pe': 'P',
    // Q
    'q': 'Q', 'cue': 'Q', 'queue': 'Q', 'quebec': 'Q',
    // R
    'r': 'R', 'ar': 'R', 'romeo': 'R', 're': 'R',
    // S
    's': 'S', 'ess': 'S', 'sierra': 'S', 'es': 'S',
    // T
    't': 'T', 'tee': 'T', 'tango': 'T', 'te': 'T',
    // U
    'u': 'U', 'you': 'U', 'uniform': 'U', 'yu': 'U',
    // V
    'v': 'V', 'vee': 'V', 'victor': 'V', 've': 'V',
    // W
    'w': 'W', 'doubleyou': 'W', 'whiskey': 'W', 'double': 'W',
    // X
    'x': 'X', 'ex': 'X', 'xray': 'X', 'eks': 'X',
    // Y
    'y': 'Y', 'why': 'Y', 'yankee': 'Y', 'ye': 'Y',
    // Z
    'z': 'Z', 'zee': 'Z', 'zed': 'Z', 'zulu': 'Z',
};

// ─────────────────────────────────────────────
// Tokens to completely ignore
// ─────────────────────────────────────────────
const IGNORED_TOKENS = new Set([
    'my', 'student', 'id', 'is', 'waa', 'yahay', 'this', 'the',
    'please', 'number', 'numberka', 'nambar', 'nambarka', 'nambarkayga',
    'nambarkaygu', 'lambar', 'lambarka', 'lambarkayga', 'lambarkaygu',
    'arday', 'ardayga', 'kayga', 'kaaga', 'aqoonsi', 'aqoonsiga',
    'aqoonsigaygu', 'fadlan', 'akhri', 'dheh', 'waxay', 'waxaan',
    'nambarkiisa', 'nambarkeyga', 'nambarkiiga', 'numberkeyga',
    'letter', 'letters', 'character', 'characters', 'char', 'digit', 'digits', 'symbol', 'code'
]);

// ─────────────────────────────────────────────
// Phrase pre-processing corrections
// ─────────────────────────────────────────────
const PHRASE_REPLACEMENTS = [
    // Fix split letters/digits
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
    [/\bsa\s+gaal\b/g, 'sagaal'],
    [/\bla\s+ba\b/g, 'laba'],
    [/\bla\s+bo\b/g, 'labo'],
    [/\bko\s+w\b/g, 'kow'],
    [/\bshan\s+an\b/g, 'shan'],
    [/\bli\s+ix\b/g, 'liix'],
    // Common ASR artifacts & English letter homophones
    [/double\s*u\b/gi, 'w'],
    [/\bx\s+ray\b/gi, 'xray'],
    // All sound-alike variations of letter C (see, seee, seeeee, si, sii, siiiii, cee, ceeee, sea, shee, etc.)
    [/\b[sc]e{1,10}\b/gi, 'c'],
    [/\b[sc]i{1,10}\b/gi, 'c'],
    [/\b[sc]ea{1,10}\b/gi, 'c'],
    [/\bshe{1,10}\b/gi, 'c'],
    [/\bshi{1,10}\b/gi, 'c'],
    [/\bbee\b/gi, 'b'],
    [/\bdee\b/gi, 'd'],
    [/\bkay\b/gi, 'k'],
    [/\bjay\b/gi, 'j'],
    [/\bwhy\b/gi, 'y'],
    // Chrome may return compound numbers — split them into individual digits
    // e.g. "c 1220199" spoken fast → Chrome returns "c1220199" or "see 1220199"
    // e.g. "twenty two" → we want "2" "2" not "22" as a block
    [/\btwenty\s*one\b/gi, 'two one'],
    [/\btwenty\s*two\b/gi, 'two two'],
    [/\btwenty\s*three\b/gi, 'two three'],
    [/\btwenty\s*four\b/gi, 'two four'],
    [/\btwenty\s*five\b/gi, 'two five'],
    [/\btwenty\s*six\b/gi, 'two six'],
    [/\btwenty\s*seven\b/gi, 'two seven'],
    [/\btwenty\s*eight\b/gi, 'two eight'],
    [/\btwenty\s*nine\b/gi, 'two nine'],
    [/\bninety\s*one\b/gi, 'nine one'],
    [/\bninety\s*two\b/gi, 'nine two'],
    [/\bninety\s*three\b/gi, 'nine three'],
    [/\bninety\s*four\b/gi, 'nine four'],
    [/\bninety\s*five\b/gi, 'nine five'],
    [/\bninety\s*six\b/gi, 'nine six'],
    [/\bninety\s*seven\b/gi, 'nine seven'],
    [/\bninety\s*eight\b/gi, 'nine eight'],
    [/\bninety\s*nine\b/gi, 'nine nine'],
    [/\bthirty\s*one\b/gi, 'three one'],
    [/\bthirty\s*two\b/gi, 'three two'],
    [/\bthirty\s*three\b/gi, 'three three'],
    [/\bforty\s*one\b/gi, 'four one'],
    [/\bforty\s*two\b/gi, 'four two'],
    [/\bfifty\s*one\b/gi, 'five one'],
    [/\bfifty\s*two\b/gi, 'five two'],
    [/\bsixty\s*one\b/gi, 'six one'],
    [/\bsixty\s*two\b/gi, 'six two'],
    [/\bseventy\s*one\b/gi, 'seven one'],
    [/\bseventy\s*two\b/gi, 'seven two'],
    [/\beighty\s*one\b/gi, 'eight one'],
    [/\beighty\s*two\b/gi, 'eight two'],
    // Handle "double" patterns: "double one" → "one one", "double nine" → "nine nine"
    [/\bdouble\s+zero\b/gi, 'zero zero'],
    [/\bdouble\s+one\b/gi, 'one one'],
    [/\bdouble\s+two\b/gi, 'two two'],
    [/\bdouble\s+three\b/gi, 'three three'],
    [/\bdouble\s+four\b/gi, 'four four'],
    [/\bdouble\s+five\b/gi, 'five five'],
    [/\bdouble\s+six\b/gi, 'six six'],
    [/\bdouble\s+seven\b/gi, 'seven seven'],
    [/\bdouble\s+eight\b/gi, 'eight eight'],
    [/\bdouble\s+nine\b/gi, 'nine nine']
];

// ─────────────────────────────────────────────
// Cue phrase regex — extracts what comes after
// the student says "my ID is..." or Somali equivalents
// ─────────────────────────────────────────────
const ID_CUE_REGEX = /\b(?:my\s+student\s+id|student\s+id|my\s+id|my\s+i\s*d|i\s*d|id|aqoonsi(?:ga(?:ygu|yga|ga)?)?(?:\s+ardayga)?|nambark(?:a|ayga|eyga|aygu|aaga)?(?:\s+ardayga)?|lambark(?:a|ayga|eyga|aygu|aaga)?(?:\s+ardayga)?|numberk(?:a|ayga|eyga|aygu|aaga)?)(?:\s+(?:is|waa|yahay))?\s*(.*)$/i;

// ─────────────────────────────────────────────
// Normalize raw speech text
// ─────────────────────────────────────────────
function normalizeSpeechText(input = '') {
    let text = String(input || '')
        .toLowerCase()
        .replace(/[''']/g, '')
        .replace(/[_-]+/g, ' ')
        .replace(/[^a-z0-9\s]+/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return PHRASE_REPLACEMENTS.reduce(
        (t, [pattern, replacement]) => t.replace(pattern, replacement),
        text
    );
}

// ─────────────────────────────────────────────
// Extract the actual candidate text after cue word
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Try to split a compact alphanumeric token like "c1220199"
// into letter prefix + digit characters: ['C','1','2','2','0','1','9','9']
// ─────────────────────────────────────────────
function splitCompactIdToken(token = '') {
    // Match pattern: optional letter prefix + digits (e.g. "c1220199", "1220199", "a12345")
    const match = token.match(/^([a-z]?)(\d+)$/i);
    if (!match) return null;

    const [, letterPart, digitPart] = match;
    const result = [];

    if (letterPart) {
        result.push(letterPart.toUpperCase());
    }

    // Split digits individually for student ID
    for (const d of digitPart) {
        result.push(d);
    }

    return result.length > 0 ? result : null;
}

// ─────────────────────────────────────────────
// Convert a single spoken token to an ID character
// Priority: digit → letter → raw single char
// ─────────────────────────────────────────────
function tokenToIdChunk(token = '', index = 0, tokens = [], hasCue = false) {
    if (!token) return '';

    // Special case: "o" could be 0 or O depending on surrounding tokens
    if (token === 'o') {
        const prev = tokens[index - 1] || '';
        const next = tokens[index + 1] || '';
        const nearDigits = isDigitLikeToken(prev) || isDigitLikeToken(next);
        return nearDigits ? '0' : 'O';
    }

    // Digit word takes priority
    if (DIGIT_WORDS[token] !== undefined) return DIGIT_WORDS[token];

    // Letter word
    if (LETTER_WORDS[token] !== undefined) return LETTER_WORDS[token];

    // Raw numeric string (e.g. "123") — split into individual digits
    if (/^\d+$/.test(token)) return token;

    // Single alphabetic character
    if (/^[a-z]$/.test(token)) return token.toUpperCase();

    // Alphanumeric compact ID chunk, e.g. "c1220199" spoken as one word
    // Split into individual characters for proper student ID format
    if (/^[a-z0-9]+$/.test(token) && /\d/.test(token) && /[a-z]/i.test(token)) {
        const split = splitCompactIdToken(token);
        if (split) return split.join('');
        return token.toUpperCase();
    }

    // Word-only tokens: skip ignored, keep only recognized single letters or letter words
    if (/^[a-z]+$/.test(token)) {
        if (IGNORED_TOKENS.has(token)) return '';
        if (LETTER_WORDS[token] !== undefined) return LETTER_WORDS[token];
        if (token.length === 1) return token.toUpperCase();
        return '';
    }

    return '';
}

// ─────────────────────────────────────────────
// Public: extract an array of ID character chunks
// e.g. "C one two two zero one nine nine" → ['C','1','2','2','0','1','9','9']
// ─────────────────────────────────────────────
export function extractStudentIdChunks(input = '') {
    const { candidate, hasCue } = extractCandidateText(input);
    if (!candidate) return [];

    const tokens = candidate
        .replace(/[^a-z0-9]+/gi, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (tokens.length === 0) return [];

    // If we have a single token that looks like a complete student ID (e.g. "c1220199"),
    // split it directly into characters for best accuracy
    if (tokens.length === 1) {
        const compact = splitCompactIdToken(tokens[0]);
        if (compact && compact.length >= 4) return compact;
    }

    return tokens
        .map((token, index) => tokenToIdChunk(token, index, tokens, hasCue))
        .filter(Boolean);
}

// ─────────────────────────────────────────────
// Public: convert speech text → Student ID string
// ─────────────────────────────────────────────
export function normalizeStudentIdFromSpeech(input = '') {
    const parsed = extractStudentIdChunks(input).join('');
    return sanitizeStudentId(parsed);
}

// ─────────────────────────────────────────────
// Public: get exactly one character from speech
// ─────────────────────────────────────────────
export function extractSingleStudentIdCharacter(input = '') {
    const chunks = extractStudentIdChunks(input);
    if (chunks.length !== 1) return '';
    const single = sanitizeStudentId(chunks[0]);
    return single.length === 1 ? single : '';
}

// ─────────────────────────────────────────────
// Public: clean/normalize a typed or spoken ID string
// ─────────────────────────────────────────────
export function sanitizeStudentId(value = '') {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

// ─────────────────────────────────────────────
// Public: is this likely a valid student ID?
// ─────────────────────────────────────────────
export function isLikelyStudentId(value = '') {
    const id = sanitizeStudentId(value);
    if (!id) return false;
    // At least 4 characters for silence fallback after 10 seconds
    if (id.length >= 4) return true;
    if (/^[A-Z]\d{2,}/.test(id)) return true;
    if (/^\d{4,}/.test(id)) return true;
    return false;
}

// ─────────────────────────────────────────────
// Public: is this a complete student ID (full length)?
// ─────────────────────────────────────────────
export function isCompleteStudentId(value = '') {
    const id = sanitizeStudentId(value);
    if (!id) return false;
    // Complete student ID is at least 7 characters (e.g. C1220199 or 20240001)
    return id.length >= 7;
}

// ─────────────────────────────────────────────
// Public: read back the ID character by character
// e.g. "C1220199" → "Letter C . . . one . . . two . . . two . . . zero . . . one . . . nine . . . nine"
// ─────────────────────────────────────────────
export function spellStudentId(value = '') {
    const clean = sanitizeStudentId(value);
    if (!clean) return '';

    return clean
        .split('')
        .map((char, index) => {
            if (/\d/.test(char)) return ENGLISH_DIGIT_NAMES[char] || char;
            return `Letter ${char}`;
        })
        .join(' . . . ');
}

// ─────────────────────────────────────────────
// Public: merge existing student ID with new spoken ID chunk
// Handles two main scenarios:
//   A) Cumulative ASR transcript: each interim/final contains the full text
//      spoken so far, so spoken is a superset of current (e.g. "C" → "C12" → "C1220199")
//   B) Separate utterances after a pause: student said "C12" (final), then
//      starts a new recognition with "20199", so we append.
// ─────────────────────────────────────────────
export function mergeStudentIdSpeech(currentId = '', spokenId = '') {
    const current = sanitizeStudentId(currentId);
    const spoken = sanitizeStudentId(spokenId);

    if (!spoken) return current;
    if (!current) return spoken;

    // 1. Spoken is a complete valid student ID (starts with a letter + 4-7 digits, or 7-8 digits)
    if (/^[A-Z]\d{4,7}$/.test(spoken) || /^\d{7,8}$/.test(spoken)) {
        return spoken; // REPLACE completely
    }

    // 2. If current is garbled or too long (>= 9 chars), any new attempt REPLACES current
    if (current.length >= 9 || !/^[A-Z]?\d+$/.test(current)) {
        return spoken;
    }

    // 3. Cumulative transcript: spoken extends current
    if (spoken.startsWith(current)) {
        return spoken.length <= 8 ? spoken : spoken.slice(0, 8);
    }

    // 4. Current extends spoken (ASR repeated shorter fragment): keep current
    if (current.startsWith(spoken)) {
        return current;
    }

    // 5. Spoken is a new attempt with letter prefix (e.g. current="C99", spoken="C1220199")
    if (/^[A-Z]/.test(spoken) && /^[A-Z]/.test(current)) {
        if (spoken.length >= current.length) return spoken.length <= 8 ? spoken : spoken.slice(0, 8);
    }

    // 6. Append digits if combined length <= 8
    if (/^\d+$/.test(spoken)) {
        const combined = current + spoken;
        return combined.length <= 8 ? combined : spoken;
    }

    // Default cap at 8 characters
    const merged = current + spoken;
    return merged.length <= 8 ? merged : spoken;
}
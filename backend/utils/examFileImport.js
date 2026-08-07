const xlsx = require('xlsx');
const mammoth = require('mammoth');
const { PDFParse } = require('pdf-parse');

class ImportFormatError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'ImportFormatError';
        this.status = status;
    }
}

const MCQ_LABELS = ['A', 'B', 'C', 'D'];

function cleanCell(value) {
    return String(value ?? '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

function normalizeKey(value) {
    return cleanCell(value)
        .toLowerCase()
        .replace(/['`]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function normalizeAnswerText(value) {
    return cleanCell(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function hasText(row) {
    return Array.isArray(row) && row.some((cell) => cleanCell(cell));
}

function toRowsFromText(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map((line) => {
            if (line.includes('\t')) return line.split('\t').map(cleanCell);
            return [line];
        })
        .filter(hasText);
}

function parsePositiveNumber(value, fallback = null) {
    const match = cleanCell(value).match(/(\d+(?:\.\d+)?)/);
    if (!match) return fallback;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseMetadataLine(line) {
    const text = cleanCell(line);
    let match = text.match(/^(?:exam\s*)?(?:title|name|imtixaan)\s*[:\-]\s*(.+)$/i);
    if (match && cleanCell(match[1])) {
        return { type: 'title', value: cleanCell(match[1]) };
    }

    match = text.match(/^(?:time\s*limit|duration|minutes|time|waqti|mudo)\s*[:\-]?\s*(\d{1,4})/i);
    if (match) {
        return { type: 'timeLimit', value: parsePositiveNumber(match[1], 60) };
    }

    match = text.match(/^(\d{1,4})\s*(?:minutes?|mins?|daqiiqo)\b/i);
    if (match) {
        return { type: 'timeLimit', value: parsePositiveNumber(match[1], 60) };
    }

    return null;
}

function normalizeQuestionType(value) {
    const key = normalizeKey(value);
    if (!key) return '';
    if (['mcq', 'multiplechoice', 'choice', 'choices', 'objective'].includes(key)) return 'mcq';
    if (['truefalse', 'tf', 'torf', 'boolean', 'saxqalad'].includes(key)) return 'true-false';
    if (['open', 'openended', 'essay', 'shortanswer', 'written', 'paragraph'].includes(key)) return 'open-ended';
    if (key.includes('multiplechoice')) return 'mcq';
    if (key.includes('true') && key.includes('false')) return 'true-false';
    if (key.includes('open') || key.includes('essay') || key.includes('shortanswer')) return 'open-ended';
    return '';
}

function parseSectionLine(line) {
    const text = cleanCell(line);
    if (!/^(section|part|qayb|qaybta)\b/i.test(text)) return null;
    if (text.length > 140) return null;

    const type = normalizeQuestionType(text);
    let name = cleanCell(
        text
            .replace(/^(?:section|part|qayb|qaybta)\s*[:\-]?\s*/i, '')
            .replace(/\b(?:type|nooca)\s*[:\-].*$/i, '')
            .replace(/\b(?:mcq|multiple\s*choice|true\s*\/?\s*false|open\s*ended|open-ended|essay|short\s*answer)\b.*$/i, '')
    );
    name = cleanCell(name.replace(/^[:\-]+|[:\-]+$/g, '')) || 'Section 1';

    return { name, type };
}

function parseTypeLine(line) {
    const match = cleanCell(line).match(/^(?:type|question\s*type|nooca)\s*[:\-]\s*(.+)$/i);
    return match ? normalizeQuestionType(match[1]) : '';
}

function parseAnswerLine(line) {
    const match = cleanCell(line).match(/^(?:answer|ans|correct|correct\s*answer|jawaab|jawaabta|sax)\s*(?:is)?\s*[:\-]?\s*(.+)$/i);
    return match ? cleanCell(match[1]) : '';
}

function parsePointsLine(line) {
    const match = cleanCell(line).match(/^(?:points|marks|score|pts|dhibco)\s*[:\-]\s*(.+)$/i);
    return match ? parsePositiveNumber(match[1], 1) : null;
}

function parseQuestionLine(line) {
    const text = cleanCell(line);
    const patterns = [
        /^(?:question|ques|su\s*aal|suaal|su'aal)\s*(?:no\.?|#)?\s*\d*\s*[:.)\-]\s*(.+)$/i,
        /^(?:q)\s*\d{1,3}\s*[:.)\-]\s*(.+)$/i,
        /^\d{1,3}\s*[\).:\-]\s+(.+)$/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && cleanCell(match[1])) return cleanCell(match[1]);
    }

    return '';
}

function parseOptionLine(line) {
    const text = cleanCell(line);
    const match = text.match(/^([A-D])\s*[\).:\-]\s*(.+)$/i);
    if (!match) return null;
    return normalizeOption(match[2], match[1].toUpperCase());
}

function hasCorrectMarker(text) {
    return /\b(?:correct|answer|sax)\b/i.test(text)
        || /\[(?:x|correct|answer)\]/i.test(text)
        || /\((?:correct|answer)\)/i.test(text)
        || /(?:\*{1,2})\s*$/.test(text);
}

function removeCorrectMarker(text) {
    return cleanCell(text)
        .replace(/\[(?:x|correct|answer)\]/ig, '')
        .replace(/\((?:correct|answer)\)/ig, '')
        .replace(/\b(?:correct|answer|sax)\b/ig, '')
        .replace(/\*+$/g, '')
        .trim();
}

function normalizeOption(rawText, fallbackLabel) {
    let text = cleanCell(rawText);
    let label = fallbackLabel ? fallbackLabel.toUpperCase() : '';

    const marker = text.match(/^([A-D])\s*[\).:\-]\s*(.+)$/i);
    if (marker) {
        label = marker[1].toUpperCase();
        text = marker[2];
    }

    const markedCorrect = hasCorrectMarker(text);
    text = removeCorrectMarker(text);

    if (!label || !MCQ_LABELS.includes(label)) {
        label = fallbackLabel ? fallbackLabel.toUpperCase() : '';
    }

    return text ? { label, text, markedCorrect } : null;
}

function splitInlineOptions(value) {
    const text = cleanCell(value);
    if (!text) return [];

    const markerRegex = /(?:^|\s)([A-D])\s*[\).:\-]\s*/gi;
    const matches = [...text.matchAll(markerRegex)];
    if (matches.length >= 2) {
        return matches.map((match, index) => {
            const start = match.index + match[0].length;
            const end = index + 1 < matches.length ? matches[index + 1].index : text.length;
            return normalizeOption(text.slice(start, end), match[1].toUpperCase());
        }).filter(Boolean);
    }

    const delimiter = text.includes('|') ? '|' : text.includes(';') ? ';' : null;
    if (!delimiter) return [];

    return text.split(delimiter)
        .map((part, index) => normalizeOption(part, MCQ_LABELS[index]))
        .filter(Boolean);
}

function normalizeOptions(values) {
    const options = [];

    for (const value of values) {
        if (!value) continue;

        if (typeof value === 'object' && value.text !== undefined) {
            const option = normalizeOption(value.text, value.label);
            if (option) options.push(option);
            continue;
        }

        const text = cleanCell(value);
        if (!text) continue;

        const inline = splitInlineOptions(text);
        if (inline.length > 1) {
            options.push(...inline);
        } else {
            const fallbackLabel = MCQ_LABELS[options.length];
            const option = normalizeOption(text, fallbackLabel);
            if (option) options.push(option);
        }
    }

    const seen = new Set();
    return options
        .map((option, index) => ({
            label: MCQ_LABELS.includes(option.label) ? option.label : MCQ_LABELS[index],
            text: option.text,
            markedCorrect: option.markedCorrect
        }))
        .filter((option) => {
            if (!option.label || !option.text || seen.has(option.label)) return false;
            seen.add(option.label);
            return true;
        });
}

function areTrueFalseOptions(options) {
    if (options.length !== 2) return false;
    const values = options.map((option) => normalizeAnswerText(option.text));
    return values.includes('true') && values.includes('false');
}

function normalizeTrueFalseAnswer(rawAnswer, options) {
    const marked = options.find((option) => option.markedCorrect);
    if (marked) return marked.label;

    const answer = normalizeAnswerText(rawAnswer);
    if (!answer) return '';
    if (/^a\b|^1\b/.test(answer)) return 'A';
    if (/^b\b|^2\b/.test(answer)) return 'B';

    const trueTokens = new Set(['true', 't', 'yes', 'y', 'haa', 'sax']);
    const falseTokens = new Set(['false', 'f', 'no', 'n', 'maya', 'qalad', 'been']);
    if (trueTokens.has(answer)) return 'A';
    if (falseTokens.has(answer)) return 'B';

    const optionMatch = options.find((option) => normalizeAnswerText(option.text) === answer);
    return optionMatch?.label || '';
}

function normalizeMcqAnswer(rawAnswer, options) {
    const marked = options.find((option) => option.markedCorrect);
    if (marked) return marked.label;

    const raw = cleanCell(rawAnswer);
    const answer = normalizeAnswerText(raw);
    if (!answer) return '';

    const labelMatch = raw.match(/\b([A-D])\b/i) || raw.match(/^([A-D])\s*[\).:\-]/i);
    if (labelMatch) {
        const label = labelMatch[1].toUpperCase();
        if (options.some((option) => option.label === label)) return label;
    }

    const numericMatch = raw.match(/\b([1-4])\b/);
    if (numericMatch) {
        const label = MCQ_LABELS[Number(numericMatch[1]) - 1];
        if (options.some((option) => option.label === label)) return label;
    }

    const optionMatch = options.find((option) => normalizeAnswerText(option.text) === answer);
    return optionMatch?.label || '';
}

function stripAnswerAndOptionsFromQuestion(text) {
    return cleanCell(text)
        .replace(/\s+(?:answer|ans|correct|correct\s*answer|jawaab|jawaabta|sax)\s*(?:is)?\s*[:\-]?\s*.+$/i, '')
        .replace(/\s+(?:points|marks|score|pts|dhibco)\s*[:\-]\s*\d+(?:\.\d+)?\s*$/i, '')
        .trim();
}

function buildQuestion(input) {
    const questionText = stripAnswerAndOptionsFromQuestion(input.questionText);
    if (!questionText) return null;

    let options = normalizeOptions(input.options || []);
    let type = normalizeQuestionType(input.type);
    const correctRaw = cleanCell(input.correctRaw);

    if (!type) {
        if (areTrueFalseOptions(options) || ['true', 'false'].includes(normalizeAnswerText(correctRaw))) {
            type = 'true-false';
        } else if (options.length >= 2) {
            type = 'mcq';
        } else {
            type = 'open-ended';
        }
    }

    if (type === 'true-false') {
        const normalizedAnswer = normalizeTrueFalseAnswer(correctRaw, options);
        options = [
            { label: 'A', text: 'True' },
            { label: 'B', text: 'False' }
        ];
        if (!normalizedAnswer) return null;
        return {
            type,
            questionText,
            options,
            correctAnswer: normalizedAnswer,
            points: input.points || 1
        };
    }

    if (type === 'mcq') {
        if (options.length < 2) return null;
        const correctAnswer = normalizeMcqAnswer(correctRaw, options);
        if (!correctAnswer) return null;
        return {
            type,
            questionText,
            options: options.map(({ label, text }) => ({ label, text })),
            correctAnswer,
            points: input.points || 1
        };
    }

    return {
        type: 'open-ended',
        questionText,
        options: [],
        correctAnswer: '',
        points: input.points || 1
    };
}

function addQuestionToSections(sectionsMap, sectionName, question) {
    const safeSectionName = cleanCell(sectionName) || 'Section 1';
    if (!sectionsMap.has(safeSectionName)) sectionsMap.set(safeSectionName, []);
    sectionsMap.get(safeSectionName).push(question);
}

function parseOptionsLine(line) {
    const match = cleanCell(line).match(/^(?:options|choices|doorashooyin)\s*[:\-]\s*(.+)$/i);
    return match ? splitInlineOptions(match[1]) : [];
}

function tokenizeExamText(text) {
    const normalized = String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\u00a0/g, ' ');

    const withBreaks = normalized
        .replace(/\s+(?=(?:answer|ans|correct|correct\s*answer|jawaab|jawaabta|sax)\s*(?:is)?\s*[:\-])/gi, '\n')
        .replace(/\s+(?=(?:points|marks|score|pts|dhibco)\s*[:\-])/gi, '\n')
        .replace(/\s+(?=[A-Da-d]\s*[\).:\-]\s+)/g, '\n')
        .replace(/\s+(?=(?:Q(?:uestion)?\s*)?\d{1,3}\s*[\).]\s+)/gi, '\n');

    return withBreaks
        .split('\n')
        .map(cleanCell)
        .filter(Boolean);
}

function parseExamText(text, fallbackTitle = 'Imported Exam') {
    const lines = tokenizeExamText(text);
    const sectionsMap = new Map();
    let title = fallbackTitle;
    let timeLimit = 60;
    let currentSection = 'Section 1';
    let currentSectionType = '';
    let current = null;
    let lastField = '';

    const finalizeCurrent = () => {
        if (!current) return;
        const question = buildQuestion(current);
        if (question) addQuestionToSections(sectionsMap, current.sectionName, question);
        current = null;
        lastField = '';
    };

    for (const line of lines) {
        const metadata = parseMetadataLine(line);
        if (metadata && !current) {
            if (metadata.type === 'title') title = metadata.value;
            if (metadata.type === 'timeLimit') timeLimit = metadata.value;
            continue;
        }

        const section = parseSectionLine(line);
        if (section) {
            finalizeCurrent();
            currentSection = section.name;
            currentSectionType = section.type || '';
            continue;
        }

        const type = parseTypeLine(line);
        if (type) {
            if (current) current.type = type;
            else currentSectionType = type;
            continue;
        }

        const points = parsePointsLine(line);
        if (points !== null && current) {
            current.points = points;
            lastField = 'points';
            continue;
        }

        const answer = parseAnswerLine(line);
        if (answer && current) {
            current.correctRaw = answer;
            lastField = 'answer';
            continue;
        }

        const optionsLine = parseOptionsLine(line);
        if (optionsLine.length && current) {
            current.options.push(...optionsLine);
            lastField = 'option';
            continue;
        }

        const option = parseOptionLine(line);
        if (option && current) {
            current.options.push(option);
            if (option.markedCorrect) current.correctRaw = option.label;
            lastField = 'option';
            continue;
        }

        const questionText = parseQuestionLine(line);
        if (questionText) {
            finalizeCurrent();

            const inlineOptions = splitInlineOptions(questionText);
            const inlineAnswer = parseAnswerLine(questionText);
            const inlinePoints = parsePointsLine(questionText);
            current = {
                sectionName: currentSection,
                type: currentSectionType,
                questionText,
                options: inlineOptions,
                correctRaw: inlineAnswer,
                points: inlinePoints || 1
            };
            lastField = 'question';
            continue;
        }

        if (!current) {
            if (title === fallbackTitle && !parseMetadataLine(line) && !parseSectionLine(line)) {
                title = line.length > 100 ? fallbackTitle : line;
            }
            continue;
        }

        if (lastField === 'option' && current.options.length) {
            const lastOption = current.options[current.options.length - 1];
            lastOption.text = cleanCell(`${lastOption.text} ${line}`);
        } else {
            current.questionText = cleanCell(`${current.questionText} ${line}`);
            lastField = 'question';
        }
    }

    finalizeCurrent();

    return sectionsFromMap(sectionsMap, title, timeLimit);
}

const HEADER_ALIASES = {
    section: ['section', 'part', 'qayb', 'qaybta'],
    type: ['type', 'questiontype', 'nooca'],
    question: ['question', 'questiontext', 'q', 'suaal', 'sual', 'suual'],
    options: ['options', 'choices', 'answers', 'doorashooyin'],
    correct: ['correct', 'answer', 'correctanswer', 'jawaab', 'jawaabta', 'sax'],
    points: ['points', 'pts', 'marks', 'score', 'dhibco'],
    title: ['title', 'examtitle', 'examname', 'imtixaan'],
    timeLimit: ['timelimit', 'duration', 'minutes', 'time', 'waqti', 'mudo'],
    A: ['a', 'optiona', 'choicea', 'doora', 'doorashoa'],
    B: ['b', 'optionb', 'choiceb', 'doorb', 'doorashob'],
    C: ['c', 'optionc', 'choicec', 'doorc', 'doorashoc'],
    D: ['d', 'optiond', 'choiced', 'doord', 'doorashod']
};

function findColumn(headers, aliases) {
    return headers.findIndex((header) => aliases.includes(header));
}

function isHeaderRow(row) {
    const headers = row.map(normalizeKey);
    const hasQuestion = headers.some((header) => HEADER_ALIASES.question.includes(header));
    const hasAnswerOrOptions = headers.some((header) => (
        HEADER_ALIASES.correct.includes(header)
        || HEADER_ALIASES.options.includes(header)
        || MCQ_LABELS.some((label) => HEADER_ALIASES[label].includes(header))
    ));
    return hasQuestion && hasAnswerOrOptions;
}

function looksTabular(rows) {
    const dataRows = rows.filter(hasText);
    if (!dataRows.length) return false;
    return dataRows.some((row) => row.filter((cell) => cleanCell(cell)).length >= 4);
}

function rowToLine(row) {
    return row.map(cleanCell).filter(Boolean).join(' ');
}

function sectionsFromMap(sectionsMap, title, timeLimit) {
    const sections = [...sectionsMap.entries()]
        .filter(([, questions]) => questions.length > 0)
        .map(([name, questions]) => ({ name, questions }));

    return {
        title: cleanCell(title) || 'Imported Exam',
        timeLimit: timeLimit || 60,
        sections
    };
}

function parseExamRows(rows, fallbackTitle = 'Imported Exam') {
    const cleanRows = rows
        .map((row) => Array.from(row || []).map(cleanCell))
        .filter(hasText);

    if (!cleanRows.length) {
        return { title: fallbackTitle, timeLimit: 60, sections: [] };
    }

    const headerIndex = cleanRows.findIndex((row, index) => index < 10 && isHeaderRow(row));
    if (headerIndex === -1 && !looksTabular(cleanRows)) {
        return parseExamText(cleanRows.map(rowToLine).join('\n'), fallbackTitle);
    }

    const headers = headerIndex >= 0 ? cleanRows[headerIndex].map(normalizeKey) : [];
    const dataRows = headerIndex >= 0 ? cleanRows.slice(headerIndex + 1) : cleanRows;

    const column = (key) => headerIndex >= 0 ? findColumn(headers, HEADER_ALIASES[key]) : -1;
    let sectionIdx = column('section');
    let typeIdx = column('type');
    let questionIdx = column('question');
    let optionsIdx = column('options');
    let correctIdx = column('correct');
    let pointsIdx = column('points');
    const titleIdx = column('title');
    const timeLimitIdx = column('timeLimit');
    let optionIndexes = MCQ_LABELS.map((label) => column(label));

    if (headerIndex === -1) {
        const firstWideRow = dataRows.find((row) => row.filter((cell) => cleanCell(cell)).length >= 4) || [];
        const likelyQuestionFirst = parseQuestionLine(firstWideRow[0]) || firstWideRow.length <= 7;
        if (likelyQuestionFirst) {
            sectionIdx = -1;
            typeIdx = -1;
            questionIdx = 0;
            optionIndexes = [1, 2, 3, 4];
            correctIdx = 5;
            pointsIdx = 6;
        } else {
            sectionIdx = 0;
            typeIdx = 1;
            questionIdx = 2;
            optionIndexes = [3, 4, 5, 6];
            correctIdx = 7;
            pointsIdx = 8;
        }
    }

    const sectionsMap = new Map();
    let title = fallbackTitle;
    let timeLimit = 60;
    let defaultSection = 'Section 1';

    for (const row of dataRows) {
        const line = rowToLine(row);
        const metadata = parseMetadataLine(line);
        if (metadata && row.filter(Boolean).length <= 2) {
            if (metadata.type === 'title') title = metadata.value;
            if (metadata.type === 'timeLimit') timeLimit = metadata.value;
            continue;
        }

        if (titleIdx !== -1 && row[titleIdx]) title = cleanCell(row[titleIdx]) || title;
        if (timeLimitIdx !== -1 && row[timeLimitIdx]) timeLimit = parsePositiveNumber(row[timeLimitIdx], timeLimit);

        const sectionLine = row.length === 1 ? parseSectionLine(row[0]) : null;
        if (sectionLine) {
            defaultSection = sectionLine.name;
            continue;
        }

        const questionText = questionIdx !== -1 ? cleanCell(row[questionIdx]) : cleanCell(row[0]);
        if (!questionText) continue;

        const options = [];
        if (optionsIdx !== -1 && row[optionsIdx]) options.push(...splitInlineOptions(row[optionsIdx]));
        for (const idx of optionIndexes) {
            if (idx !== -1 && row[idx]) options.push(row[idx]);
        }

        const question = buildQuestion({
            sectionName: sectionIdx !== -1 ? cleanCell(row[sectionIdx]) : defaultSection,
            type: typeIdx !== -1 ? row[typeIdx] : '',
            questionText,
            options,
            correctRaw: correctIdx !== -1 ? row[correctIdx] : '',
            points: pointsIdx !== -1 ? parsePositiveNumber(row[pointsIdx], 1) : 1
        });

        if (question) {
            addQuestionToSections(
                sectionsMap,
                sectionIdx !== -1 ? cleanCell(row[sectionIdx]) || defaultSection : defaultSection,
                question
            );
        }
    }

    const parsed = sectionsFromMap(sectionsMap, title, timeLimit);
    if (parsed.sections.length > 0) return parsed;

    return parseExamText(cleanRows.map(rowToLine).join('\n'), fallbackTitle);
}

function stripHtml(text) {
    return String(text || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
}

function stripRtf(text) {
    return String(text || '')
        .replace(/\\par[d]?/g, '\n')
        .replace(/\\tab/g, '\t')
        .replace(/\\'[0-9a-f]{2}/gi, ' ')
        .replace(/[{}]/g, ' ')
        .replace(/\\[a-z]+\d* ?/gi, ' ')
        .replace(/\s+\n/g, '\n');
}

function readableRuns(text) {
    const runs = String(text || '').match(/[A-Za-z0-9.,;:?!'"()\/\-\s]{4,}/g) || [];
    return runs.join('\n');
}

function isMostlyReadableText(text) {
    const value = String(text || '');
    if (!value.trim()) return false;

    let readable = 0;
    let suspicious = 0;
    for (const char of value) {
        const code = char.charCodeAt(0);
        if (char === '\n' || char === '\r' || char === '\t' || (code >= 32 && code !== 127 && code !== 65533)) {
            readable += 1;
        } else {
            suspicious += 1;
        }
    }

    return readable > 0 && suspicious / (readable + suspicious) < 0.05;
}

function extractLegacyDocText(buffer) {
    const utf8 = buffer.toString('utf8');
    const start = utf8.slice(0, 500).toLowerCase();

    if (start.includes('{\\rtf')) return stripRtf(utf8);
    if (start.includes('<html') || start.includes('<!doctype html')) return stripHtml(utf8);
    if (isMostlyReadableText(utf8)) return utf8;

    const candidates = [
        readableRuns(utf8),
        readableRuns(buffer.toString('latin1')),
        readableRuns(buffer.toString('utf16le'))
    ].sort((a, b) => b.length - a.length);

    return candidates[0] || '';
}

async function extractExamContent(file) {
    const mime = file.mimetype || '';
    const originalName = (file.originalname || '').toLowerCase();
    const buffer = file.buffer;

    if (mime.includes('sheet') || mime.includes('excel') || originalName.endsWith('.xlsx') || originalName.endsWith('.xls')) {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        return {
            kind: 'rows',
            rows: xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        };
    }

    if (mime.includes('wordprocessingml') || originalName.endsWith('.docx') || buffer.slice(0, 2).toString() === 'PK') {
        const result = await mammoth.extractRawText({ buffer });
        return { kind: 'text', text: result.value || '' };
    }

    if (mime.includes('msword') || originalName.endsWith('.doc')) {
        const text = extractLegacyDocText(buffer);
        if (!cleanCell(text)) {
            throw new ImportFormatError('Could not read text from this .doc file. Save it as .docx or export a selectable-text PDF, then import again.');
        }
        return { kind: 'text', text };
    }

    if (mime === 'application/pdf' || originalName.endsWith('.pdf')) {
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        if (typeof parser.destroy === 'function') await parser.destroy();
        if (!cleanCell(result.text)) {
            throw new ImportFormatError('Could not read text from this PDF. Scanned/image-only PDFs need OCR before importing.');
        }
        return { kind: 'text', text: result.text };
    }

    throw new ImportFormatError('Unsupported file type. Use Word (.doc/.docx), PDF (.pdf), or Excel (.xlsx/.xls).');
}

async function parseExamFile(file) {
    const fallbackTitle = file.originalname
        ? file.originalname.replace(/\.[^.]+$/, '')
        : 'Imported Exam';
    const content = await extractExamContent(file);
    const parsed = content.kind === 'rows'
        ? parseExamRows(content.rows, fallbackTitle)
        : parseExamRows(toRowsFromText(content.text), fallbackTitle);

    if (!parsed.sections.length) {
        throw new ImportFormatError('No valid questions found. Use numbered questions with A-D options and an "Answer: A" line, or a table with Question, A, B, C, D, Correct columns.');
    }

    return parsed;
}

module.exports = {
    ImportFormatError,
    parseExamFile,
    parseExamRows,
    parseExamText
};

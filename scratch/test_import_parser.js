const { parseExamFile, parseExamText, parseExamRows } = require('../backend/utils/examFileImport');

console.log('Testing Exam Parser...');

// Test 1: Plain Text / Word format parsing
const textInput = `
Title: Web Development Final Exam
Time Limit: 90

Section: HTML & CSS Basics
Type: mcq

1. What does HTML stand for?
A) Hyper Text Markup Language
B) High Tech Modern Language
C) Home Tool Markup Language
D) Hyperlinks Text Management Language
Answer: A
Points: 2

2. CSS is used for styling web pages.
A) True
B) False
Answer: A
Points: 1

Section: JavaScript & Logic
Type: open-ended

3. Describe how Promises work in JavaScript.
Points: 5
`;

const parsedFromText = parseExamText(textInput, 'Default Exam');
console.log('\n--- Text Parser Output ---');
console.log('Title:', parsedFromText.title);
console.log('Time Limit:', parsedFromText.timeLimit);
console.log('Sections Count:', parsedFromText.sections.length);

parsedFromText.sections.forEach(sec => {
    console.log(`\nSection: ${sec.name}`);
    sec.questions.forEach((q, idx) => {
        console.log(` Q${idx + 1} (${q.type}, ${q.points}pts): ${q.questionText}`);
        if (q.options && q.options.length) {
            console.log('    Options:', q.options.map(o => `${o.label}) ${o.text}`).join(', '));
        }
        if (q.correctAnswer) {
            console.log('    Correct Answer:', q.correctAnswer);
        }
    });
});

// Test 2: Tabular / Excel rows format parsing
const rowsInput = [
    ['Section', 'Type', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Points'],
    ['Part 1', 'mcq', 'What is 10 + 5?', '12', '15', '20', '25', 'B', '2'],
    ['Part 1', 'true-false', 'Water freezes at 0 degrees Celsius.', 'True', 'False', '', '', 'A', '1'],
    ['Part 2', 'open-ended', 'Explain Newton third law of motion.', '', '', '', '', '', '5']
];

const parsedFromRows = parseExamRows(rowsInput, 'Excel Exam');
console.log('\n--- Rows Parser Output ---');
console.log('Title:', parsedFromRows.title);
console.log('Sections Count:', parsedFromRows.sections.length);

parsedFromRows.sections.forEach(sec => {
    console.log(`\nSection: ${sec.name}`);
    sec.questions.forEach((q, idx) => {
        console.log(` Q${idx + 1} (${q.type}, ${q.points}pts): ${q.questionText}`);
        if (q.options && q.options.length) {
            console.log('    Options:', q.options.map(o => `${o.label}) ${o.text}`).join(', '));
        }
        if (q.correctAnswer) {
            console.log('    Correct Answer:', q.correctAnswer);
        }
    });
});

console.log('\nAll Parser Tests Passed!');

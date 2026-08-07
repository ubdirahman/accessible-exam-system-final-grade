// Template Generator Utility for Exam Import

export function downloadExcelTemplate() {
    const csvContent = [
        ['Section', 'Type', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Points'],
        ['Part 1', 'mcq', 'What is the primary function of an Operating System?', 'Hardware management', 'Web browsing', 'Document editing', 'Photo processing', 'A', '2'],
        ['Part 1', 'mcq', 'Which data structure follows First-In, First-Out (FIFO)?', 'Stack', 'Queue', 'Tree', 'Graph', 'B', '2'],
        ['Part 1', 'true-false', 'RAM loses its contents when the computer is turned off.', 'True', 'False', '', '', 'A', '1'],
        ['Part 2', 'open-ended', 'Explain the concept of recursion in programming with an example.', '', '', '', '', '', '5']
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'Exam_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function downloadWordTemplate() {
    const textContent = `Exam Title: Midterm Examination 2026
Time Limit: 60

Section: Part 1
Type: mcq

1. What is the primary function of an Operating System?
A) Hardware management
B) Web browsing
C) Document editing
D) Photo processing
Answer: A
Points: 2

2. Which data structure follows First-In, First-Out (FIFO)?
A) Stack
B) Queue
C) Tree
D) Graph
Answer: B
Points: 2

3. RAM loses its contents when power is turned off.
A) True
B) False
Answer: A
Points: 1

Section: Part 2
Type: open-ended

4. Explain the concept of recursion in programming with an example.
Points: 5
`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'Exam_Import_Template.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

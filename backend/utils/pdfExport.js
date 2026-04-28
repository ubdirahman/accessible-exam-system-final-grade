const PDFDocument = require('pdfkit');

/**
 * Generate a PDF report for an exam result
 */
function generateResultPDF({ student, exam, result, questions, responses }) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];

            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // Header
            doc.fontSize(20).font('Helvetica-Bold').text('Exam Result Report', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
            doc.moveDown(1);

            // Divider
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#333333');
            doc.moveDown(0.5);

            // Student Info
            doc.fontSize(14).font('Helvetica-Bold').text('Student Information');
            doc.moveDown(0.3);
            doc.fontSize(11).font('Helvetica');
            doc.text(`Name: ${student ? student.name : 'N/A'}`);
            doc.text(`Student ID: ${student ? student.studentId : 'N/A'}`);
            doc.moveDown(0.5);

            // Exam Info
            doc.fontSize(14).font('Helvetica-Bold').text('Exam Details');
            doc.moveDown(0.3);
            doc.fontSize(11).font('Helvetica');
            doc.text(`Title: ${exam ? exam.title : 'N/A'}`);
            doc.text(`Description: ${exam ? exam.description : 'N/A'}`);
            doc.moveDown(0.5);

            // Results Summary
            doc.fontSize(14).font('Helvetica-Bold').text('Results Summary');
            doc.moveDown(0.3);
            doc.fontSize(11).font('Helvetica');

            const percentage = result.totalPoints > 0
                ? Math.round((result.score / result.totalPoints) * 100)
                : 0;

            doc.text(`Score: ${result.score} / ${result.totalPoints} (${percentage}%)`);
            doc.text(`Correct: ${result.correctCount}`);
            doc.text(`Wrong: ${result.wrongCount}`);
            doc.text(`Skipped: ${result.skippedCount}`);

            const mins = Math.floor(result.timeTaken / 60);
            const secs = result.timeTaken % 60;
            doc.text(`Time Taken: ${mins} min ${secs} sec`);
            doc.text(`Status: ${percentage >= 50 ? 'PASSED' : 'FAILED'}`);
            doc.moveDown(1);

            // Divider
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#333333');
            doc.moveDown(0.5);

            // Question Details
            doc.fontSize(14).font('Helvetica-Bold').text('Question Details');
            doc.moveDown(0.5);

            questions.forEach((q, idx) => {
                const resp = responses.find(r => r.questionId.toString() === q._id.toString());

                // Check page space
                if (doc.y > 680) {
                    doc.addPage();
                }

                doc.fontSize(11).font('Helvetica-Bold').text(`Q${idx + 1}. ${q.questionText}`);
                doc.fontSize(10).font('Helvetica');
                doc.text(`Type: ${q.type} | Points: ${q.points}`);

                if (q.options && q.options.length > 0) {
                    q.options.forEach(opt => {
                        doc.text(`  ${opt.label}) ${opt.text}`);
                    });
                }

                if (resp && resp.selectedAnswer) {
                    doc.text(`Your Answer: ${resp.selectedAnswer}`);
                    if (q.type !== 'open-ended' && q.correctAnswer) {
                        doc.text(`Correct Answer: ${q.correctAnswer}`);
                    }
                    doc.text(`Result: ${resp.isCorrect ? '✓ Correct' : '✗ Incorrect'} (${resp.score || 0} pts)`);
                    if (resp.mlFeedback) {
                        doc.text(`ML Feedback: ${resp.mlFeedback}`);
                    }
                } else {
                    doc.text('Your Answer: (Skipped)');
                }

                doc.moveDown(0.5);
            });

            // Footer
            doc.moveDown(1);
            doc.fontSize(9).font('Helvetica').fillColor('#666666')
                .text('Accessible Digital Examination System — Confidential', { align: 'center' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

function generateClassMatrixPDF({ faculty, classroom, subjects, students }) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                margin: 28,
                size: 'A3',
                layout: 'landscape'
            });
            const buffers = [];

            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            const truncate = (value, length = 18) => {
                const text = String(value || '-');
                return text.length > length ? `${text.slice(0, Math.max(0, length - 3))}...` : text;
            };

            const renderPageHeader = () => {
                doc.font('Helvetica-Bold').fontSize(18).fillColor('#111111')
                    .text('Result Exam Report', 28, 24, { align: 'center' });
                doc.moveDown(0.4);
                doc.font('Helvetica').fontSize(10).fillColor('#555555');
                doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
                doc.moveDown(0.5);
                doc.text(`Faculty: ${faculty?.name || '-'}`, { align: 'left' });
                doc.text(`Class: ${classroom?.name || '-'}${classroom?.semesterName ? ` | Semester: ${classroom.semesterName}` : ''}`, { align: 'left' });
                doc.moveDown(0.4);
            };

            const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            const baseColumns = [
                { key: 'name', label: 'Name', width: 120 },
                { key: 'studentId', label: 'Student ID', width: 85 },
                { key: 'facultyName', label: 'Faculty', width: 120 },
                { key: 'className', label: 'Class', width: 95 },
                { key: 'subjectCount', label: 'Subjects', width: 55 },
                { key: 'totalScore', label: 'Total Score', width: 80 }
            ];
            const baseWidth = baseColumns.reduce((sum, column) => sum + column.width, 0);
            const remainingWidth = Math.max(220, pageWidth - baseWidth);
            const subjectWidth = subjects.length > 0
                ? Math.max(42, Math.floor(remainingWidth / subjects.length))
                : 0;

            const columns = [
                ...baseColumns,
                ...subjects.map((subject) => ({
                    key: subject.key,
                    label: subject.label,
                    width: subjectWidth
                }))
            ];

            const drawTableHeader = (y) => {
                let x = doc.page.margins.left;
                const headerHeight = 24;

                columns.forEach((column) => {
                    doc.rect(x, y, column.width, headerHeight).fillAndStroke('#e8eefc', '#b9c8f2');
                    doc.fillColor('#16325c')
                        .font('Helvetica-Bold')
                        .fontSize(8)
                        .text(truncate(column.label, 18), x + 4, y + 7, {
                            width: column.width - 8,
                            align: 'center'
                        });
                    x += column.width;
                });

                return y + headerHeight;
            };

            renderPageHeader();
            let y = drawTableHeader(doc.y + 6);

            students.forEach((student) => {
                const rowHeight = 22;
                const bottomLimit = doc.page.height - doc.page.margins.bottom - 24;

                if (y + rowHeight > bottomLimit) {
                    doc.addPage({ margin: 28, size: 'A3', layout: 'landscape' });
                    renderPageHeader();
                    y = drawTableHeader(doc.y + 6);
                }

                let x = doc.page.margins.left;
                const cells = [
                    truncate(student.name, 22),
                    truncate(student.studentId, 14),
                    truncate(student.facultyName, 18),
                    truncate(student.className, 16),
                    String(student.subjectCount || 0),
                    student.totalPoints > 0 ? `${student.totalScore}/${student.totalPoints}` : '-',
                    ...subjects.map((subject) => {
                        const entry = student.subjectScores?.[subject.key];
                        return entry ? `${entry.score}/${entry.totalPoints}` : '-';
                    })
                ];

                columns.forEach((column, index) => {
                    doc.rect(x, y, column.width, rowHeight).stroke('#d7dce5');
                    doc.fillColor('#222222')
                        .font('Helvetica')
                        .fontSize(7.5)
                        .text(truncate(cells[index], 18), x + 4, y + 7, {
                            width: column.width - 8,
                            align: index >= 5 ? 'center' : 'left'
                        });
                    x += column.width;
                });

                y += rowHeight;
            });

            if (students.length === 0) {
                doc.moveDown(1);
                doc.font('Helvetica').fontSize(11).fillColor('#666666')
                    .text('No students or subject results found for the selected class.', { align: 'center' });
            }

            doc.moveDown(1);
            doc.font('Helvetica').fontSize(9).fillColor('#666666')
                .text('Accessible Digital Examination System - Result Exam Report', { align: 'center' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { generateResultPDF, generateClassMatrixPDF };

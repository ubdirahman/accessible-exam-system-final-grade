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

module.exports = { generateResultPDF };

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate a PDF report for an exam result
 */
function generateResultPDF({ student, exam, result, questions, responses }) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const buffers = [];
            
            const logoPath = path.join(__dirname, 'logo.png');
            
            // Register page decorations function
            const drawPageDecorations = (d) => {
                const width = d.page.width;
                const height = d.page.height;
                
                // Bottom-left blue triangle
                d.save();
                d.fillColor('#2563eb');
                d.moveTo(0, height);
                d.lineTo(0, height - 45);
                d.lineTo(45, height);
                d.closePath();
                d.fill();
                
                // Bottom-right blue triangle
                d.moveTo(width, height);
                d.lineTo(width, height - 45);
                d.lineTo(width - 45, height);
                d.closePath();
                d.fill();
                d.restore();
                
                // Running footer text
                d.save();
                const oldBottomMargin = d.page.margins.bottom;
                d.page.margins.bottom = 0; // Temporarily disable bottom margin to prevent automatic page breaks
                d.fillColor('#94a3b8').font('Helvetica').fontSize(8);
                d.text('Jamhuriya University of Science and Technology (JUST) — Student Exam Result', 0, height - 25, {
                    align: 'center',
                    width: width
                });
                d.page.margins.bottom = oldBottomMargin;
                d.restore();
            };

            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // Draw decorations on the first page
            drawPageDecorations(doc);
            doc.x = 40; // Ensure margin is reset
            
            // Listen for subsequent page additions
            doc.on('pageAdded', () => {
                drawPageDecorations(doc);
                doc.x = 40;
                doc.y = 50; // Set top offset for new pages
            });

            // Draw Logo Banner
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 40, 35, { width: 515 });
            }
            
            // Exam Title (centered)
            doc.y = 130;
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13)
                .text(exam?.title || 'Exam Name and Years', { align: 'center', width: 515 });
            doc.moveDown(0.8);
            
            // Student Info Underlined Fields
            const r1Y = 160;
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b');
            doc.text('Name', 40, r1Y);
            doc.text('ID', 445, r1Y);
            
            doc.strokeColor('#cbd5e1').lineWidth(0.8)
               .moveTo(75, r1Y + 10)
               .lineTo(430, r1Y + 10)
               .moveTo(462, r1Y + 10)
               .lineTo(555, r1Y + 10)
               .stroke();
               
            doc.font('Helvetica').fontSize(10).fillColor('#0f172a');
            doc.text(student?.name || 'N/A', 80, r1Y);
            doc.text(student?.studentId || 'N/A', 467, r1Y);
            
            const r2Y = 185;
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b');
            doc.text('Class', 40, r2Y);
            doc.text('Semister', 242, r2Y);
            doc.text('Data', 445, r2Y);
            
            doc.strokeColor('#cbd5e1').lineWidth(0.8)
               .moveTo(75, r2Y + 10)
               .lineTo(230, r2Y + 10)
               .moveTo(300, r2Y + 10)
               .lineTo(430, r2Y + 10)
               .moveTo(472, r2Y + 10)
               .lineTo(555, r2Y + 10)
               .stroke();
               
            doc.font('Helvetica').fontSize(10).fillColor('#0f172a');
            doc.text(student?.classId?.name || student?.className || 'N/A', 80, r2Y);
            doc.text(student?.classId?.semesterId?.name || 'N/A', 305, r2Y);
            doc.text(new Date(result.submittedAt || exam.createdAt).toLocaleDateString(), 477, r2Y);

            // Score Summary Box
            const percentage = result.totalPoints > 0
                ? Math.round((result.score / result.totalPoints) * 100)
                : 0;
            const statusText = percentage >= 50 ? 'PASSED' : 'FAILED';
            const statusColor = percentage >= 50 ? '#16a34a' : '#dc2626';
            
            const summaryY = 215;
            doc.save();
            doc.rect(40, summaryY, 515, 42)
               .fillAndStroke('#f8fafc', '#e2e8f0');
               
            doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8);
            doc.text('TOTAL SCORE', 45, summaryY + 8, { width: 100, align: 'center' });
            doc.text('PERCENTAGE', 145, summaryY + 8, { width: 100, align: 'center' });
            doc.text('CORRECT/WRONG', 245, summaryY + 8, { width: 100, align: 'center' });
            doc.text('TIME TAKEN', 345, summaryY + 8, { width: 100, align: 'center' });
            doc.text('STATUS', 445, summaryY + 8, { width: 100, align: 'center' });
            
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10);
            doc.text(`${result.score} / ${result.totalPoints}`, 45, summaryY + 22, { width: 100, align: 'center' });
            doc.text(`${percentage}%`, 145, summaryY + 22, { width: 100, align: 'center' });
            doc.text(`${result.correctCount} / ${result.wrongCount}`, 245, summaryY + 22, { width: 100, align: 'center' });
            doc.text(`${Math.floor(result.timeTaken / 60)}m ${result.timeTaken % 60}s`, 345, summaryY + 22, { width: 100, align: 'center' });
            doc.fillColor(statusColor).text(statusText, 445, summaryY + 22, { width: 100, align: 'center' });
            doc.restore();
            
            doc.x = 40; // Reset X position to avoid grid width inheritance
            doc.y = summaryY + 55;
            
            // Question grouping
            const mcqs = questions.filter(q => q.type === 'mcq');
            const tfs = questions.filter(q => q.type === 'true-false');
            const opens = questions.filter(q => q.type === 'open-ended');
            
            const checkPageBreak = (neededHeight = 60) => {
                if (doc.y > doc.page.height - doc.page.margins.bottom - neededHeight) {
                    doc.addPage();
                    doc.x = 40;
                    doc.y = 50; // top padding on new pages
                }
            };

            const mapTF = (val) => val === 'A' ? 'True' : (val === 'B' ? 'False' : val);
            
            let globalQIndex = 1;
            
            // Part A: MCQ
            if (mcqs.length > 0) {
                checkPageBreak(40);
                doc.x = 40;
                doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13)
                   .text('Part A: Multiple Choice Questions (Choose the correct answer)', { width: 515, align: 'left' });
                doc.moveDown(0.4);
                
                mcqs.forEach((q) => {
                    const resp = responses.find(r => r.questionId.toString() === q._id.toString());
                    
                    checkPageBreak(70);
                    const currentY = doc.y;
                    
                    // Points in the left margin (x = 40)
                    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(13)
                       .text(`(${q.points} pt${q.points > 1 ? 's' : ''})`, 40, currentY, { width: 45, align: 'left' });
                       
                    // Question text (x = 90)
                    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(13)
                       .text(`${globalQIndex++}. ${q.questionText}`, 90, currentY, { width: 465, align: 'left' });
                    doc.moveDown(0.1);
                    
                    doc.x = 90;
                    
                    // Options
                    if (q.options && q.options.length > 0) {
                        const optStrings = q.options.map(opt => `${opt.label}. ${opt.text}`);
                        const joinedOpts = optStrings.join('    ');
                        doc.font('Helvetica').fontSize(13).fillColor('#475569');
                        if (joinedOpts.length < 70) {
                            doc.text(joinedOpts, { indent: 15, width: 465, align: 'left' });
                        } else {
                            q.options.forEach(opt => {
                                doc.text(`${opt.label}. ${opt.text}`, { indent: 15, width: 465, align: 'left' });
                            });
                        }
                        doc.moveDown(0.1);
                    }
                    
                    // Answer
                    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e293b')
                       .text('Answer: ', { indent: 15, continued: true, width: 465 });
                    
                    const answerLabel = resp?.selectedAnswer || '(Skipped)';
                    let answerText = answerLabel;
                    if (q.options) {
                        const matchedOpt = q.options.find(o => o.label === answerLabel);
                        if (matchedOpt) answerText = `${answerLabel} (${matchedOpt.text})`;
                    }
                    
                    doc.font('Helvetica').fillColor('#1e293b').text(answerText, { indent: 15, width: 465, align: 'left' });
                    
                    doc.moveDown(0.5);
                });
                doc.moveDown(0.5);
            }
            
            // Part B: True/False
            if (tfs.length > 0) {
                checkPageBreak(40);
                doc.x = 40;
                doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13)
                   .text('Part B: True or False', { width: 515, align: 'left' });
                doc.moveDown(0.4);
                
                tfs.forEach((q) => {
                    const resp = responses.find(r => r.questionId.toString() === q._id.toString());
                    
                    checkPageBreak(60);
                    const currentY = doc.y;
                    
                    // Points in the left margin (x = 40)
                    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(13)
                       .text(`(${q.points} pt${q.points > 1 ? 's' : ''})`, 40, currentY, { width: 45, align: 'left' });
                       
                    // Question text (x = 90)
                    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(13)
                       .text(`${globalQIndex++}. ${q.questionText}`, 90, currentY, { width: 465, align: 'left' });
                    doc.moveDown(0.1);
                    
                    doc.x = 90;
                    
                    // Answer (TF does not show options!)
                    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e293b')
                       .text('Answer: ', { indent: 15, continued: true, width: 465 });
                    
                    const answerLabel = resp?.selectedAnswer;
                    const answerText = answerLabel ? mapTF(answerLabel) : '(Skipped)';
                    
                    doc.font('Helvetica').fillColor('#1e293b').text(answerText, { indent: 15, width: 465, align: 'left' });
                    
                    doc.moveDown(0.5);
                });
                doc.moveDown(0.5);
            }
            
            // Part C: Open-ended
            if (opens.length > 0) {
                checkPageBreak(40);
                doc.x = 40;
                doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13)
                   .text('Part C: Open Questions', { width: 515, align: 'left' });
                doc.moveDown(0.4);
                
                opens.forEach((q) => {
                    const resp = responses.find(r => r.questionId.toString() === q._id.toString());
                    
                    checkPageBreak(85);
                    const currentY = doc.y;
                    
                    // Points in the left margin (x = 40)
                    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(13)
                       .text(`(${q.points} pt${q.points > 1 ? 's' : ''})`, 40, currentY, { width: 45, align: 'left' });
                       
                    // Question text (x = 90)
                    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(13)
                       .text(`${globalQIndex++}. ${q.questionText}`, 90, currentY, { width: 465, align: 'left' });
                    doc.moveDown(0.1);
                    
                    doc.x = 90;
                    
                    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e293b')
                       .text('Answer: ', { indent: 15, continued: true, width: 465 });
                    
                    doc.font('Helvetica').fillColor('#1e293b').text(resp?.selectedAnswer || '(No answer)', { indent: 15, width: 465, align: 'left' });
                    
                    if (resp) {
                        doc.save();
                        doc.fontSize(13).font('Helvetica-Bold');
                        doc.fillColor('#1e293b').text(`Score: ${resp.score || 0} / ${q.points} pts`, { indent: 15, width: 465, align: 'left' });
                        doc.restore();
                        
                        if (resp.mlFeedback) {
                            doc.fontSize(13).fillColor('#475569').font('Helvetica-Oblique')
                               .text(`ML Feedback: ${resp.mlFeedback}`, { indent: 15, width: 465, align: 'left' });
                        }
                        if (resp.teacherFeedback) {
                            doc.fontSize(13).fillColor('#1e40af').font('Helvetica-Bold')
                               .text('Teacher Feedback: ', { indent: 15, continued: true, width: 465 });
                            doc.font('Helvetica').fillColor('#334155').text(resp.teacherFeedback);
                        }
                    }
                    
                    doc.moveDown(0.5);
                });
            }

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
                doc.fillColor('#111827').font('Helvetica-Bold').fontSize(18)
                    .text('Accessible Exam System', 28, 24, { align: 'center' });
                doc.moveDown(0.2);
                doc.font('Helvetica').fontSize(12).fillColor('#475569')
                    .text('Class Result Matrix', { align: 'center' });
                doc.moveDown(0.3);
                doc.font('Helvetica').fontSize(10).fillColor('#6b7280')
                    .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
                doc.moveDown(0.5);
                doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2937')
                    .text(`Faculty: ${faculty?.name || '-'}`, { align: 'left' });
                doc.font('Helvetica').fontSize(10).fillColor('#374151')
                    .text(`Class: ${classroom?.name || '-'}${classroom?.semesterName ? ` | Semester: ${classroom.semesterName}` : ''}`, { align: 'left' });
                doc.moveDown(0.5);
                doc.strokeColor('#d1d5db').lineWidth(1)
                    .moveTo(doc.page.margins.left, doc.y)
                    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
                    .stroke();
                doc.moveDown(0.4);
            };

            const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            const baseColumns = [
                { key: 'name', label: 'Name', width: 140 },
                { key: 'studentId', label: 'Student ID', width: 90 },
                { key: 'facultyName', label: 'Faculty', width: 110 },
                { key: 'className', label: 'Class', width: 100 },
                { key: 'subjectCount', label: 'Subjects', width: 60 },
                { key: 'totalScore', label: 'Total Score', width: 90 }
            ];
            const baseWidth = baseColumns.reduce((sum, column) => sum + column.width, 0);
            const remainingWidth = Math.max(240, pageWidth - baseWidth);
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
                const headerHeight = 26;

                columns.forEach((column) => {
                    doc.rect(x, y, column.width, headerHeight).fill('#e0e7ff').stroke('#c7d2fe');
                    doc.fillColor('#1e293b')
                        .font('Helvetica-Bold')
                        .fontSize(8)
                        .text(truncate(column.label, 20), x + 4, y + 7, {
                            width: column.width - 8,
                            align: 'center'
                        });
                    x += column.width;
                });

                return y + headerHeight;
            };

            renderPageHeader();
            let y = drawTableHeader(doc.y + 6);

            students.forEach((student, rowIndex) => {
                const rowHeight = 22;
                const bottomLimit = doc.page.height - doc.page.margins.bottom - 30;

                if (y + rowHeight > bottomLimit) {
                    doc.addPage({ margin: 28, size: 'A3', layout: 'landscape' });
                    renderPageHeader();
                    y = drawTableHeader(doc.y + 6);
                }

                let x = doc.page.margins.left;
                const cells = [
                    truncate(student.name, 24),
                    truncate(student.studentId, 14),
                    truncate(student.facultyName, 16),
                    truncate(student.className, 16),
                    String(student.subjectCount || 0),
                    student.totalPoints > 0 ? `${student.totalScore}/${student.totalPoints}` : '-',
                    ...subjects.map((subject) => {
                        const entry = student.subjectScores?.[subject.key];
                        return entry ? `${entry.score}/${entry.totalPoints}` : '-';
                    })
                ];

                columns.forEach((column, index) => {
                    if (rowIndex % 2 === 0) {
                        doc.rect(x, y, column.width, rowHeight).fillOpacity(0.08).fill('#f8fafc').fillOpacity(1);
                    }
                    doc.rect(x, y, column.width, rowHeight).stroke('#e2e8f0');
                    doc.fillColor('#111827')
                        .font('Helvetica')
                        .fontSize(8)
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
                doc.font('Helvetica').fontSize(11).fillColor('#6b7280')
                    .text('No students or subject results found for the selected class.', { align: 'center' });
            }

            doc.moveDown(1);
            doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
                .text('Accessible Digital Examination System - Result Exam Report', { align: 'center' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { generateResultPDF, generateClassMatrixPDF };

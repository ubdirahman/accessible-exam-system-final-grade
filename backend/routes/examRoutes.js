const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');
const xlsx = require('xlsx');
const mammoth = require('mammoth');
const { PDFParse } = require('pdf-parse');
const { verifyToken, requireAdmin, requireStudent, requireAdminOrTeacher } = require('../middleware/auth');
const Exam = require('../models/Exam');
const Section = require('../models/Section');
const Question = require('../models/Question');
const Response = require('../models/Response');
const Result = require('../models/Result');
const ActivityLog = require('../models/ActivityLog');
const ExamRecording = require('../models/ExamRecording');
const Student = require('../models/Student');
const axios = require('axios');
const { buildStudentExamQueue } = require('../utils/studentExamQueue');
const { deleteRecordingFile } = require('../utils/examRecordingStorage');
const { ImportFormatError, parseExamFile } = require('../utils/examFileImport');

// Multer memory storage (no files saved to disk)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });


const router = express.Router();

// Resolve faculty for writes based on caller role
function resolveFacultyId(req) {
    if (req.user.role === 'admin') return req.user.facultyId;
    if (req.user.role === 'teacher') return req.user.facultyId;
    return req.body.facultyId || req.user.facultyId || null;
}

// Ensure the caller is allowed to access a specific exam
async function loadExamIfAllowed(user, examId) {
    const exam = await Exam.findById(examId);
    if (!exam) return null;
    if (user.role === 'super_admin') return exam;
    if (user.role === 'admin' && exam.facultyId && exam.facultyId.toString() === String(user.facultyId)) return exam;
    if (user.role === 'teacher' && exam.createdBy && exam.createdBy.toString() === String(user.id)) return exam;
    return null;
}

// Helper: recompute result totals after grading updates
async function recomputeResult(examId, studentId) {
    try {
        const questions = await Question.find({ examId });
        const responses = await Response.find({ examId, studentId });

        const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
        let score = 0;
        let correctCount = 0;
        let wrongCount = 0;
        let skippedCount = 0;

        questions.forEach(q => {
            const resp = responses.find(r => r.questionId && r.questionId.toString() === q._id.toString());
            const hasAnswer = resp && (resp.selectedAnswer != null && resp.selectedAnswer !== '' || resp.autoGraded || resp.manuallyGraded);
            if (!resp || !hasAnswer) {
                skippedCount += 1;
                return;
            }
            if (resp.isCorrect === true) {
                correctCount += 1;
                score += resp.score != null ? resp.score : q.points || 0;
            } else if (resp.isCorrect === false) {
                wrongCount += 1;
                score += resp.score || 0;
            } else {
                // Ungraded manual question: keep in skipped/pending bucket
                skippedCount += 1;
            }
        });

        const existing = await Result.findOne({ examId, studentId });
        const timeTaken = existing?.timeTaken || 0;
        const submittedAt = existing?.submittedAt || new Date();

        await Result.findOneAndUpdate(
            { examId, studentId },
            {
                score,
                totalPoints,
                correctCount,
                wrongCount,
                skippedCount,
                timeTaken,
                submittedAt,
                locked: true
            },
            { upsert: true, new: true }
        );
    } catch (err) {
        console.error('Recompute result failed', err);
        // do not throw to avoid breaking grading call; leave existing totals unchanged
    }
}

/* ============================================================
   ADMIN ROUTES
   ============================================================ */

/* ----------------------------------------------------------
   EXAM FILE PARSE PREVIEW: Excel, Word (.doc/.docx), PDF
   POST /parse-file
   Parses file and returns JSON payload without creating exam
   ---------------------------------------------------------- */
router.post('/parse-file', verifyToken, requireAdminOrTeacher, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

        const parsedData = await parseExamFile(req.file);
        res.json(parsedData);
    } catch (error) {
        console.error('Exam file parse error:', error);
        if (error instanceof ImportFormatError || error.status === 400) {
            return res.status(error.status || 400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error parsing exam file: ' + error.message });
    }
});

/* ----------------------------------------------------------
   EXAM FILE IMPORT: Excel, Word (.doc/.docx), PDF
   POST /import-file
   Supports tabular files and plain text:
     Section | Type | Question | A | B | C | D | Correct | Points
     1. Question text
     A. Option text
     B. Option text
     Answer: A
   ---------------------------------------------------------- */
router.post('/import-file', verifyToken, requireAdminOrTeacher, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

        const { classId, subjectId, facultyId: bodyFacultyId } = req.body;
        const Classroom = require('../models/Classroom');

        let facultyId = req.user.role === 'admin' || req.user.role === 'super_admin'
            ? (req.user.facultyId || bodyFacultyId)
            : (req.user.facultyId || bodyFacultyId);

        if (!facultyId && classId) {
            const klass = await Classroom.findById(classId);
            if (klass) facultyId = klass.facultyId;
        }

        if (!classId) return res.status(400).json({ message: 'classId is required.' });
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });

        const { title: examTitle, timeLimit: examTimeLimit, sections: sectionsData } = await parseExamFile(req.file);

        const klass = await Classroom.findOne({ _id: classId, facultyId });
        if (!klass) return res.status(400).json({ message: 'Class not found for this faculty.' });

        const exam = await Exam.create({
            title: examTitle,
            timeLimit: examTimeLimit,
            classId,
            subjectId: subjectId || null,
            facultyId,
            createdBy: req.user.id,
            active: false,
            examCodes: []
        });

        for (let i = 0; i < sectionsData.length; i++) {
            const sData = sectionsData[i];
            const section = await Section.create({ examId: exam._id, name: sData.name, order: i + 1 });
            exam.sections.push(section._id);

            for (let j = 0; j < sData.questions.length; j++) {
                const q = sData.questions[j];
                await Question.create({
                    sectionId: section._id,
                    examId: exam._id,
                    type: q.type,
                    questionText: q.questionText,
                    options: q.options,
                    correctAnswer: q.type === 'open-ended' ? '' : q.correctAnswer,
                    points: q.points,
                    order: j + 1
                });
            }
        }

        await exam.save();

        const questionCount = sectionsData.reduce((sum, section) => sum + section.questions.length, 0);
        res.status(201).json({
            message: 'Exam imported successfully.',
            importedCount: questionCount,
            exam: { _id: exam._id, title: examTitle, sections: sectionsData.length, questions: questionCount }
        });
    } catch (error) {
        console.error('Exam file import error:', error);
        if (error instanceof ImportFormatError || error.status === 400) {
            return res.status(error.status || 400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error processing exam file: ' + error.message });
    }
});

// POST /api/exams - Create exam (admin or teacher)
router.post('/', verifyToken, requireAdminOrTeacher, async (req, res) => {

    try {
        const { title, description, timeLimit, sections: sectionsData, active = false, classId, subjectId } = req.body;
        const facultyId = resolveFacultyId(req);
        if (!facultyId) {
            return res.status(400).json({ message: 'facultyId is required to create an exam.' });
        }

        let finalClassId = classId || null;
        if (req.user.role === 'teacher') {
            finalClassId = req.user.classId?.toString() || null;
            if (!finalClassId) return res.status(403).json({ message: 'Teacher has no assigned class account.' });
        }

        if (subjectId) {
            const Subject = require('../models/Subject');
            const subj = await Subject.findOne({ _id: subjectId, facultyId });
            if (!subj) return res.status(400).json({ message: 'Subject not found for this faculty.' });

            if (req.user.role === 'teacher') {
                if (subj.teacherId?.toString() !== req.user.id) {
                    return res.status(403).json({ message: 'You can only create exams for your own subjects.' });
                }
                if (subj.classId?.toString() !== req.user.classId?.toString()) {
                    return res.status(403).json({ message: 'This subject does not belong to your assigned class.' });
                }
            }
            // align class with subject if subject has one
            if (subj.classId) {
                finalClassId = subj.classId.toString();
            }
        }

        if (finalClassId) {
            const Classroom = require('../models/Classroom');
            const klass = await Classroom.findOne({ _id: finalClassId, facultyId });
            if (!klass) return res.status(400).json({ message: 'Class not found for this faculty.' });
        }

        const exam = await Exam.create({
            title,
            description,
            timeLimit,
            createdBy: req.user.id,
            facultyId,
            classId: finalClassId,
            subjectId: subjectId || null,
            // teachers cannot activate exams; admins/super_admins can
            active: req.user.role === 'teacher' ? false : !!active,
            examCodes: []
        });

        // Create sections and questions
        if (sectionsData && sectionsData.length > 0) {
            for (let i = 0; i < sectionsData.length; i++) {
                const sec = sectionsData[i];
                const section = await Section.create({
                    examId: exam._id,
                    name: sec.name,
                    order: i + 1
                });

                exam.sections.push(section._id);

                if (sec.questions && sec.questions.length > 0) {
                    for (let j = 0; j < sec.questions.length; j++) {
                        const q = sec.questions[j];
                        await Question.create({
                            examId: exam._id,
                            sectionId: section._id,
                            type: q.type,
                            questionText: q.questionText,
                            options: q.options || [],
                            correctAnswer: q.type === 'open-ended' ? '' : q.correctAnswer,
                            points: q.points || 1,
                            order: j + 1
                        });
                    }
                }
            }
        }

        await exam.save();
        res.status(201).json({ message: 'Exam created successfully.', exam });
    } catch (error) {
        console.error('Create exam error:', error);
        res.status(500).json({ message: 'Error creating exam.' });
    }
});

// GET /api/exams — List all exams (admin only)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? { facultyId: req.user.facultyId } : {};
        const exams = await Exam.find(query)
            .populate('sections')
            .populate({
                path: 'subjectId',
                populate: { path: 'teacherId', select: 'name' }
            })
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });
        console.log(`[DEBUG] Found ${exams.length} exams in database.`);
        res.json(exams);
    } catch (error) {
        console.error('Fetch exams error:', error);
        res.status(500).json({ message: 'Error fetching exams.' });
    }
});

// GET /api/exams/participation/summary - participant counts per exam (admin/teacher)
router.get('/participation/summary', verifyToken, requireAdminOrTeacher, async (req, res) => {
    try {
        const baseQuery = req.user.role === 'admin'
            ? { facultyId: req.user.facultyId }
            : req.user.role === 'teacher'
                ? { createdBy: req.user.id }
                : {};
        const exams = await Exam.find(baseQuery).select('_id title facultyId classId');
        const summaries = await Promise.all(exams.map(async (exam) => {
            const participants = await Response.find({ examId: exam._id }).distinct('studentId');
            return {
                examId: exam._id,
                title: exam.title,
                participants: participants.length
            };
        }));
        res.json(summaries);
    } catch (error) {
        console.error('Participation summary error:', error);
        res.status(500).json({ message: 'Error fetching participation summary.' });
    }
});

// Admin routes moved here
// GET /api/exams/students — List all students (Admin)
// MOVED UP to avoid conflict with /:id
router.get('/students', verifyToken, requireAdmin, async (req, res) => {
    try {
        const query = req.user.role === 'admin'
            ? { facultyId: req.user.facultyId }
            : (req.query.facultyId ? { facultyId: req.query.facultyId } : {});
        
        if (req.query.classId) {
            query.classId = req.query.classId;
        }

        const students = await Student.find(query).sort({ createdAt: -1 });

        // Calculate actual exams taken by counting Result documents per student
        const resultCounts = await Result.aggregate([
            { $group: { _id: "$studentId", count: { $sum: 1 } } }
        ]);
        const countMap = {};
        resultCounts.forEach(r => { countMap[r._id] = r.count; });

        const studentsWithCounts = students.map(s => {
            const doc = s.toObject();
            doc.examsTaken = countMap[s.studentId] || 0;
            return doc;
        });

        console.log(`[DEBUG] Found ${students.length} students in database.`);
        res.json(studentsWithCounts);
    } catch (error) {
        console.error('CRITICAL FETCH STUDENTS ERROR:', error.message);
        console.error(error.stack);
        res.status(500).json({ message: 'Error fetching students.', error: error.message });
    }
});

// ---------- TEACHER-SPECIFIC HELPERS ----------
// GET /api/exams/my - exams created by current user (admin or teacher)
router.get('/my', verifyToken, requireAdminOrTeacher, async (req, res) => {
    try {
        const query = { createdBy: req.user.id };
        if (req.user.role === 'teacher' && req.user.classId) {
            query.classId = req.user.classId;
        }

        const exams = await Exam.find(query)
            .populate('sections')
            .populate({
                path: 'subjectId',
                populate: { path: 'teacherId', select: 'name' }
            })
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });
        res.json(exams);
    } catch (error) {
        console.error('Error fetching my exams:', error);
        res.status(500).json({ message: 'Error fetching exams.' });
    }
});

// GET /api/exams/my/students - unique students who have participated in the caller's exams
router.get('/my/students', verifyToken, requireAdminOrTeacher, async (req, res) => {
    try {
        const myExams = await Exam.find({ createdBy: req.user.id }).select('_id');
        const examIds = myExams.map(e => e._id);
        const responses = await Response.find({ examId: { $in: examIds } }).select('studentId');
        const unique = [...new Set(responses.map(r => r.studentId))];
        const students = await Student.find({ studentId: { $in: unique } });
        res.json(students);
    } catch (error) {
        console.error('Error fetching my students:', error);
        res.status(500).json({ message: 'Error fetching students.' });
    }
});

// GET /api/exams/:examId/students - list students who have interacted with a particular exam
router.get('/:examId/students', verifyToken, requireAdminOrTeacher, async (req, res) => {
    try {
        const examId = req.params.examId;
        const exam = await loadExamIfAllowed(req.user, examId);
        if (!exam) return res.status(403).json({ message: 'Access denied for this exam.' });

        // include students who started the exam (activity log) even if no responses yet
        const responses = await Response.find({ examId }).select('studentId');
        const started = await ActivityLog.find({ examId, action: 'exam_started' }).select('studentId');
        const uniqueIds = [
            ...new Set([
                ...responses.map(r => r.studentId),
                ...started.map(l => l.studentId)
            ])
        ];
        const students = await Student.find({ studentId: { $in: uniqueIds } });
        res.json(students);
    } catch (error) {
        console.error('Error fetching exam students:', error);
        res.status(500).json({ message: 'Error fetching students.' });
    }
});

// GET /api/exams/:examId/students/:studentId/responses - return student's responses + question data
router.get('/:examId/students/:studentId/responses', verifyToken, requireAdminOrTeacher, async (req, res) => {
    try {
        const { examId, studentId } = req.params;
        const exam = await loadExamIfAllowed(req.user, examId);
        if (!exam) return res.status(403).json({ message: 'Access denied for this exam.' });
        const questions = await Question.find({ examId }).sort({ order: 1 });
        const responses = await Response.find({ examId, studentId });
        res.json({ questions, responses });
    } catch (error) {
        console.error('Error fetching student responses:', error);
        res.status(500).json({ message: 'Error fetching responses.' });
    }
});

// GET /api/exams/:examId/all-responses - return all responses + question data for an exam
router.get('/:examId/all-responses', verifyToken, requireAdminOrTeacher, async (req, res) => {
    try {
        const { examId } = req.params;
        const exam = await loadExamIfAllowed(req.user, examId);
        if (!exam) return res.status(403).json({ message: 'Access denied for this exam.' });
        
        const questions = await Question.find({ examId }).sort({ order: 1 });
        const responses = await Response.find({ examId });
        res.json({ questions, responses });
    } catch (error) {
        console.error('Error fetching all responses:', error);
        res.status(500).json({ message: 'Error fetching responses.' });
    }
});

// PUT /api/exams/:examId/students/:studentId/responses/:responseId
// teacher or admin can update correctness, score, feedback
router.put('/:examId/students/:studentId/responses/:responseId', verifyToken, requireAdminOrTeacher, async (req, res) => {
    try {
        const { examId, studentId, responseId } = req.params;
        const exam = await loadExamIfAllowed(req.user, examId);
        if (!exam) return res.status(403).json({ message: 'Access denied for this exam.' });
        // only accept grading fields, questionId is optional to allow creating a missing response
        const updates = (({ isCorrect, teacherFeedback, questionId, score }) => ({ isCorrect, teacherFeedback, questionId, score }))(req.body);
        updates.manuallyGraded = true;

        let response = (responseId && mongoose.isValidObjectId(responseId)) ? await Response.findById(responseId) : null;

        // if response doesn't exist, try to find it by student/exam/question first before creating
        if (!response && updates.questionId) {
            response = await Response.findOne({ studentId, examId, questionId: updates.questionId });
        }

        // if still no response, allow creation (for skipped questions)
        if (!response) {
            if (!updates.questionId || !mongoose.isValidObjectId(updates.questionId)) {
                return res.status(400).json({ message: 'Response not found and questionId missing.' });
            }
            response = new Response({
                studentId,
                examId,
                questionId: updates.questionId,
                selectedAnswer: '(No Answer Provided)',
                answeredAt: new Date()
            });
        }

        const question = await Question.findById(response.questionId);
        if (!question) return res.status(404).json({ message: 'Question not found.' });

        const maxPoints = Number(question.points || 1);
        // If score is explicitly provided in updates, use it; otherwise default to points/0
        if (typeof updates.score === 'undefined' || updates.score === null || updates.score === '') {
            updates.score = updates.isCorrect ? maxPoints : 0;
        }

        const numericScore = Number(updates.score);
        const safeScore = Number.isFinite(numericScore) ? numericScore : 0;
        updates.score = Math.min(Math.max(safeScore, 0), maxPoints);

        response.isCorrect = !!updates.isCorrect;
        response.score = Number(updates.score);
        response.teacherFeedback = updates.teacherFeedback;
        response.manuallyGraded = true;
        response.autoGraded = false;
        await response.save();

        // log grading event so admin corrections are audited
        await ActivityLog.create({
            studentId,
            examId,
            action: 'graded_response',
            questionId: response.questionId,
            details: `Marked ${updates.isCorrect ? 'correct' : 'incorrect'} by ${req.user.role} ${req.user.name || req.user.email}`
        });

        // Refresh aggregated result so students/admin see updated counts
        await recomputeResult(examId, studentId);

        res.json(response);
    } catch (error) {
        console.error('Error updating response:', error);
        res.status(500).json({ message: 'Error updating response.' });
    }
});


// GET /api/exams/:id — Get single exam with sections + questions
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id).populate('sections');
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });

        if (req.user.role === 'admin' && exam.facultyId && exam.facultyId.toString() !== String(req.user.facultyId)) {
            return res.status(403).json({ message: 'Access denied for this faculty.' });
        }
        if (req.user.role === 'teacher' && exam.createdBy && exam.createdBy.toString() !== String(req.user.id)) {
            return res.status(403).json({ message: 'Not authorized to view this exam.' });
        }

        const questions = await Question.find({ examId: exam._id }).sort({ order: 1 });
        res.json({ exam, questions });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching exam.' });
    }
});

// PUT /api/exams/:id — Update exam (including sections and questions)
router.put('/:id', verifyToken, requireAdminOrTeacher, async (req, res) => {
    try {
        const { title, description, timeLimit, active, classId, subjectId, sections: sectionsData } = req.body;
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });

        if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to modify this exam.' });
        }
        if (req.user.role === 'admin' && exam.facultyId && exam.facultyId.toString() !== String(req.user.facultyId)) {
            return res.status(403).json({ message: 'Access denied for this faculty.' });
        }

        exam.title = title;
        exam.description = description;
        exam.timeLimit = timeLimit;

        if (req.user.role !== 'teacher') {
            exam.active = active;
            if (classId) exam.classId = classId;
            if (subjectId) exam.subjectId = subjectId;
        }

        // --- Deep sync for Sections & Questions ---
        if (sectionsData) {
            const incomingSectionIds = sectionsData.filter(s => s._id).map(s => String(s._id));
            
            // Delete sections no longer in the list
            await Section.deleteMany({ examId: exam._id, _id: { $nin: incomingSectionIds } });
            // Delete questions belonging to deleted sections is handled by examId filter usually but better be safe
            await Question.deleteMany({ examId: exam._id, sectionId: { $nin: incomingSectionIds } });

            const newSectionIds = [];
            for (let i = 0; i < sectionsData.length; i++) {
                const secData = sectionsData[i];
                let section;

                if (secData._id && mongoose.isValidObjectId(secData._id)) {
                    section = await Section.findById(secData._id);
                }

                if (section) {
                    section.name = secData.name;
                    section.order = i + 1;
                    await section.save();
                } else {
                    section = await Section.create([{
                        examId: exam._id,
                        name: secData.name,
                        order: i + 1
                    }]);
                    section = section[0];
                }
                newSectionIds.push(section._id);

                // --- Sync Questions for this section ---
                if (secData.questions) {
                    const incomingQuestionIds = secData.questions.filter(q => q._id).map(q => String(q._id));
                    // Delete questions no longer in this section
                    await Question.deleteMany({ sectionId: section._id, _id: { $nin: incomingQuestionIds } });

                    for (let j = 0; j < secData.questions.length; j++) {
                        const qData = secData.questions[j];
                        let question;

                        if (qData._id && mongoose.isValidObjectId(qData._id)) {
                            question = await Question.findById(qData._id);
                        }

                        const qPayload = {
                            examId: exam._id,
                            sectionId: section._id,
                            type: qData.type,
                            questionText: qData.questionText,
                            options: qData.options || [],
                            correctAnswer: qData.type === 'open-ended' ? '' : qData.correctAnswer,
                            points: qData.points || 1,
                            order: j + 1
                        };

                        if (question) {
                            Object.assign(question, qPayload);
                            await question.save();
                        } else {
                            await Question.create([qPayload]);
                        }
                    }
                }
            }
            exam.sections = newSectionIds;
        }

        await exam.save();
        res.json({ message: 'Exam updated successfully.', exam });
    } catch (error) {
        console.error('Update exam error:', error);
        res.status(500).json({ message: 'Error updating exam.' });
    }
});

// PATCH /api/exams/:id/active — toggle active status (admin/super_admin only)
router.patch('/:id/active', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { active } = req.body;
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });
        if (req.user.role === 'admin' && exam.facultyId && exam.facultyId.toString() !== String(req.user.facultyId)) {
            return res.status(403).json({ message: 'Access denied for this faculty.' });
        }
        exam.active = !!active;
        await exam.save();
        res.json({ message: `Exam ${exam.active ? 'activated' : 'deactivated'}.`, exam });
    } catch (error) {
        console.error('Active toggle error:', error);
        res.status(500).json({ message: 'Error updating active status.' });
    }
});

// DELETE /api/exams/:id — Delete exam and related data (admin or owner teacher)
router.delete('/:id', verifyToken, requireAdminOrTeacher, async (req, res) => {
    try {
        const examId = req.params.id;
        const exam = await Exam.findById(examId);
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });
        if (req.user.role === 'teacher' && exam.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to delete this exam.' });
        }
        if (req.user.role === 'admin' && exam.facultyId && exam.facultyId.toString() !== String(req.user.facultyId)) {
            return res.status(403).json({ message: 'Access denied for this faculty.' });
        }
        const recordings = await ExamRecording.find({ examId }).select('filePath');
        recordings.forEach((recording) => {
            if (recording.filePath) {
                deleteRecordingFile(recording.filePath);
            }
        });
        await Question.deleteMany({ examId });
        await Section.deleteMany({ examId });
        await Response.deleteMany({ examId });
        await ActivityLog.deleteMany({ examId });
        await Result.deleteMany({ examId });
        await ExamRecording.deleteMany({ examId });
        await Exam.findByIdAndDelete(examId);
        res.json({ message: 'Exam and related data deleted.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting exam.' });
    }
});

// POST /api/exams/:id/generate-codes — Generate exam codes
router.post('/:id/generate-codes', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { count = 1, expiryHours = 24 } = req.body;
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });
        if (req.user.role === 'admin' && exam.facultyId && exam.facultyId.toString() !== String(req.user.facultyId)) {
            return res.status(403).json({ message: 'Access denied for this faculty.' });
        }

        const codes = [];
        for (let i = 0; i < count; i++) {
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            const entry = {
                code,
                used: false,
                studentId: null,
                expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000)
            };
            exam.examCodes.push(entry);
            codes.push(entry);
        }

        await exam.save();
        res.json({ message: `${count} exam code(s) generated.`, codes });
    } catch (error) {
        res.status(500).json({ message: 'Error generating codes.' });
    }
});

/* ============================================================
   STUDENT ROUTES
   ============================================================ */

// GET /api/exams/student/queue — active exams queue for current student
router.get('/student/queue', verifyToken, requireStudent, async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.user.studentId });
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const queue = await buildStudentExamQueue(student);
        res.json({
            student: {
                id: student._id,
                name: student.name,
                studentId: student.studentId
            },
            ...queue
        });
    } catch (error) {
        console.error('Student queue error:', error);
        res.status(500).json({ message: 'Error fetching student exam queue.' });
    }
});

// POST /api/exams/:id/start — Start exam
router.post('/:id/start', verifyToken, requireStudent, async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id).populate('subjectId', 'name');
        if (!exam || !exam.active) {
            return res.status(404).json({ message: 'Exam not found or not active.' });
        }

        // Check if already has result (exam already finished)
        const existingResult = await Result.findOne({ studentId: req.user.studentId, examId: exam._id });
        if (existingResult && existingResult.locked) {
            return res.status(400).json({ message: 'You have already completed this exam.' });
        }

        // Get questions
        const questions = await Question.find({ examId: exam._id }).sort({ sectionId: 1, order: 1 });
        const sections = await Section.find({ examId: exam._id }).sort({ order: 1 });

        // Log activity
        await ActivityLog.create({
            studentId: req.user.studentId,
            examId: exam._id,
            action: 'exam_started'
        });

        res.json({
            exam: {
                id: exam._id,
                title: exam.title,
                description: exam.description,
                timeLimit: exam.timeLimit,
                subjectName: exam.subjectId?.name || exam.title
            },
            sections,
            questions: questions.map(q => ({
                id: q._id,
                sectionId: q.sectionId,
                type: q.type,
                questionText: q.questionText,
                options: q.options,
                points: q.points,
                order: q.order
            }))
        });
    } catch (error) {
        console.error('Start exam error:', error);
        res.status(500).json({ message: 'Error starting exam.' });
    }
});

// POST /api/exams/:id/answer — Save / update an answer
router.post('/:id/answer', verifyToken, requireStudent, async (req, res) => {
    try {
        const { questionId, selectedAnswer } = req.body;
        const examId = req.params.id;
        const studentId = req.user.studentId;

        const question = await Question.findById(questionId);
        if (!question) return res.status(404).json({ message: 'Question not found.' });

        // Check if response already exists
        let response = await Response.findOne({ studentId, examId, questionId });
        let action = 'answer_selected';

        if (response) {
            response.selectedAnswer = selectedAnswer;
            response.modifiedCount += 1;
            response.answeredAt = new Date();
            action = 'answer_modified';
        } else {
            response = new Response({
                studentId,
                examId,
                questionId,
                selectedAnswer,
                answeredAt: new Date()
            });
        }

        // Auto-grade MCQ and true-false
        if (question.type === 'mcq' || question.type === 'true-false') {
            response.isCorrect = selectedAnswer.toLowerCase() === question.correctAnswer.toLowerCase();
            response.score = response.isCorrect ? question.points : 0;
            response.autoGraded = true;
        }

        // Open-ended answers are reviewed manually; skip ML service entirely
        if (question.type === 'open-ended') {
            // leave isCorrect/score null until teacher grades
        }

        await response.save();

        // Log activity
        await ActivityLog.create({
            studentId,
            examId,
            action,
            questionId,
            details: `Answer: ${selectedAnswer.substring(0, 100)}`
        });

        res.json({
            message: 'Answer saved.',
            response: {
                questionId: response.questionId,
                selectedAnswer: response.selectedAnswer,
                score: response.score,
                mlFeedback: response.mlFeedback
            }
        });
    } catch (error) {
        console.error('Answer error:', error);
        res.status(500).json({ message: 'Error saving answer.' });
    }
});

// POST /api/exams/:id/finish — Finish exam & calculate results
router.post('/:id/finish', verifyToken, requireStudent, async (req, res) => {
    try {
        const examId = req.params.id;
        const studentId = req.user.studentId;
        const { timeTaken } = req.body;

        // Check if already locked
        const existingResult = await Result.findOne({ studentId, examId });
        if (existingResult && existingResult.locked) {
            return res.status(400).json({ message: 'Exam already submitted.' });
        }

        const questions = await Question.find({ examId });
        const responses = await Response.find({ studentId, examId });

        const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
        let score = 0;
        let correctCount = 0;
        let wrongCount = 0;
        let skippedCount = 0;

        const answeredQuestionIds = responses.map(r => r.questionId.toString());

        questions.forEach(q => {
            const resp = responses.find(r => r.questionId.toString() === q._id.toString());
            const hasAnswer = resp && (resp.selectedAnswer || resp.autoGraded || resp.manuallyGraded);
            if (!resp || !hasAnswer) {
                skippedCount++;
            } else if (resp.isCorrect === true) {
                correctCount++;
                score += resp.score || 0;
            } else if (resp.isCorrect === false) {
                wrongCount++;
                score += resp.score || 0; // partial credit for open-ended
            } else {
                // Pending manual grading; treat as skipped for now
                skippedCount++;
            }
        });

        const result = await Result.findOneAndUpdate(
            { studentId, examId },
            {
                score,
                totalPoints,
                correctCount,
                wrongCount,
                skippedCount,
                timeTaken: timeTaken || 0,
                submittedAt: new Date(),
                locked: true
            },
            { upsert: true, new: true }
        );

        // Log activity
        await ActivityLog.create({
            studentId,
            examId,
            action: 'exam_finished',
            details: `Score: ${score}/${totalPoints}`
        });

        res.json({
            message: 'Exam submitted successfully.',
            result: {
                score,
                totalPoints,
                percentage: totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0,
                correctCount,
                wrongCount,
                skippedCount,
                timeTaken: timeTaken || 0
            }
        });
    } catch (error) {
        console.error('Finish exam error:', error);
        res.status(500).json({ message: 'Error finishing exam.' });
    }
});

// GET /api/exams/:id/progress — Get student progress during exam
router.get('/:id/progress', verifyToken, requireStudent, async (req, res) => {
    try {
        const examId = req.params.id;
        const studentId = req.user.studentId;
        const responses = await Response.find({ studentId, examId });
        const totalQuestions = await Question.countDocuments({ examId });

        res.json({
            totalQuestions,
            answeredCount: responses.filter(r => r.selectedAnswer).length,
            responses: responses.map(r => ({
                questionId: r.questionId,
                selectedAnswer: r.selectedAnswer,
                answeredAt: r.answeredAt
            }))
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching progress.' });
    }
});

/* ============================================================
   STUDENT MANAGEMENT (ADMIN)
   ============================================================ */

// GET /students moved up to avoid conflict with /:id

/* ----------------------------------------------------------
   FILE IMPORT: Excel, Word (.docx), PDF
   POST /students/import-file
   ---------------------------------------------------------- */
// Helper: detect header row and normalize column names
function detectColumns(headers) {
    const norm = (s) => String(s || '').toLowerCase().replace(/[\s_\-]/g, '');
    const nameIdx  = headers.findIndex(h => ['name','fullname','studentname'].includes(norm(h)));
    const idIdx    = headers.findIndex(h => ['id','studentid','sid','no','number'].includes(norm(h)));
    const emailIdx = headers.findIndex(h => ['email','emailaddress','mail'].includes(norm(h)));
    return { nameIdx, idIdx, emailIdx };
}

// Helper: parse a 2D array of rows into student objects
function rowsToStudents(rows) {
    if (!rows || rows.length === 0) return [];
    const students = [];

    // Try to detect header in the first row
    const first = rows[0].map(c => String(c || ''));
    const { nameIdx, idIdx, emailIdx } = detectColumns(first);
    const hasHeader = nameIdx !== -1 || idIdx !== -1;
    const dataRows = hasHeader ? rows.slice(1) : rows;

    // Column positions (fallback: col0=name, col1=id, col2=email)
    const nI = nameIdx  !== -1 ? nameIdx  : 0;
    const iI = idIdx    !== -1 ? idIdx    : 1;
    const eI = emailIdx !== -1 ? emailIdx : 2;

    for (const row of dataRows) {
        const name      = String(row[nI] || '').trim();
        const studentId = String(row[iI] || '').trim();
        const email     = String(row[eI] || '').trim();
        if (name && studentId) students.push({ name, studentId, email });
    }
    return students;
}

// Helper: parse plain text (PDF / Word text extraction) into rows
function textToRows(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    return lines.map(line => {
        // Try tab-separated first, then comma-separated
        if (line.includes('\t')) return line.split('\t');
        return line.split(',').map(p => p.trim());
    });
}

router.post('/students/import-file', verifyToken, requireAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

        const { classId, facultyId: bodyFacultyId } = req.body;
        const facultyId = req.user.role === 'admin' ? req.user.facultyId : (bodyFacultyId || req.user.facultyId);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });

        if (classId) {
            const Classroom = require('../models/Classroom');
            const klass = await Classroom.findOne({ _id: classId, facultyId });
            if (!klass) return res.status(400).json({ message: 'Class not found for this faculty.' });
        }

        const mime = req.file.mimetype;
        const originalName = req.file.originalname.toLowerCase();
        let parsedStudents = [];

        if (
            mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mime === 'application/vnd.ms-excel' ||
            originalName.endsWith('.xlsx') || originalName.endsWith('.xls')
        ) {
            // ---- Excel ----
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const raw = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            parsedStudents = rowsToStudents(raw);

        } else if (
            mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            mime === 'application/msword' ||
            originalName.endsWith('.docx') || originalName.endsWith('.doc')
        ) {
            // ---- Word ----
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            const rows = textToRows(result.value);
            parsedStudents = rowsToStudents(rows);

        } else if (
            mime === 'application/pdf' ||
            originalName.endsWith('.pdf')
        ) {
            // ---- PDF ----
            const parser = new PDFParse({ data: req.file.buffer });
            const pdfRes = await parser.getText();
            if (typeof parser.destroy === 'function') await parser.destroy();
            const rows = textToRows(pdfRes?.text || '');
            parsedStudents = rowsToStudents(rows);

        } else {
            return res.status(400).json({ message: 'Unsupported file type. Use Excel (.xlsx), Word (.docx), or PDF.' });
        }

        if (parsedStudents.length === 0) {
            return res.status(400).json({ message: 'No student records found in file. Ensure columns: Name, StudentID, Email.' });
        }

        // Save to database
        const imported = [];
        const errors = [];
        for (const item of parsedStudents) {
            const { name, studentId, email } = item;
            try {
                const student = await Student.create({ name, studentId, email, facultyId, classId: classId || null });
                imported.push(student);
            } catch (err) {
                if (err.code === 11000) {
                    errors.push({ item, reason: `Student ID ${studentId} already exists.` });
                } else {
                    errors.push({ item, reason: err.message || 'Database error.' });
                }
            }
        }

        res.status(201).json({
            message: `Successfully imported ${imported.length} of ${parsedStudents.length} students.`,
            importedCount: imported.length,
            failedCount: errors.length,
            errors
        });
    } catch (error) {
        console.error('File import error:', error);
        res.status(500).json({ message: 'Error processing file: ' + error.message });
    }
});

router.post('/students/import', verifyToken, requireAdmin, async (req, res) => {

    try {
        const { students, classId, facultyId: bodyFacultyId } = req.body;
        const facultyId = req.user.role === 'admin' ? req.user.facultyId : (bodyFacultyId || req.user.facultyId);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });
        if (!Array.isArray(students)) return res.status(400).json({ message: 'students must be an array.' });

        if (classId) {
            const Classroom = require('../models/Classroom');
            const klass = await Classroom.findOne({ _id: classId, facultyId });
            if (!klass) return res.status(400).json({ message: 'Class not found for this faculty.' });
        }

        const imported = [];
        const errors = [];

        for (const item of students) {
            const { name, studentId, email } = item;
            if (!name || !studentId) {
                errors.push({ item, reason: 'Name and Student ID are required.' });
                continue;
            }
            try {
                const student = await Student.create({
                    name,
                    studentId,
                    email,
                    facultyId,
                    classId: classId || null
                });
                imported.push(student);
            } catch (err) {
                if (err.code === 11000) {
                    errors.push({ item, reason: `Student ID ${studentId} already exists.` });
                } else {
                    errors.push({ item, reason: err.message || 'Database error.' });
                }
            }
        }

        res.status(201).json({
            message: `Successfully imported ${imported.length} students.`,
            importedCount: imported.length,
            failedCount: errors.length,
            errors
        });
    } catch (error) {
        console.error('Import students error:', error);
        res.status(500).json({ message: 'Error importing students.' });
    }
});

router.post('/students', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { name, studentId, email, classId, facultyId: bodyFacultyId } = req.body;
        const facultyId = req.user.role === 'admin' ? req.user.facultyId : (bodyFacultyId || req.user.facultyId);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });

        if (!name || !/^[a-zA-Z\s\u0600-\u06FF]+$/.test(name.trim())) {
            return res.status(400).json({ message: 'Student name must contain text only (letters and spaces).' });
        }

        // optional class validation happens in classRoutes but ensure class belongs to faculty if provided
        if (classId) {
            const Classroom = require('../models/Classroom');
            const klass = await Classroom.findOne({ _id: classId, facultyId });
            if (!klass) return res.status(400).json({ message: 'Class not found for this faculty.' });
        }

        const student = await Student.create({ name: name.trim(), studentId, email, facultyId, classId: classId || null });
        res.status(201).json(student);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Student ID already exists.' });
        }
        res.status(500).json({ message: 'Error creating student.' });
    }
});

router.put('/students/:studentId', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { name, email, accessibilitySettings, facultyId: bodyFacultyId, classId } = req.body;
        const facultyId = req.user.role === 'admin' ? req.user.facultyId : (bodyFacultyId || req.user.facultyId);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });

        if (name && !/^[a-zA-Z\s\u0600-\u06FF]+$/.test(name.trim())) {
            return res.status(400).json({ message: 'Student name must contain text only (letters and spaces).' });
        }

        if (classId) {
            const Classroom = require('../models/Classroom');
            const klass = await Classroom.findOne({ _id: classId, facultyId });
            if (!klass) return res.status(400).json({ message: 'Class not found for this faculty.' });
        }

        const student = await Student.findOneAndUpdate(
            { studentId: req.params.studentId, facultyId },
            { ...(name && { name: name.trim() }), email, accessibilitySettings, classId: classId || null },
            { new: true }
        );
        if (!student) return res.status(404).json({ message: 'Student not found.' });
        res.json(student);
    } catch (error) {
        res.status(500).json({ message: 'Error updating student.' });
    }
});

router.delete('/students/:studentId', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = req.user.role === 'admin' ? req.user.facultyId : (req.query.facultyId || req.user.facultyId);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });
        await Student.findOneAndDelete({ studentId: req.params.studentId, facultyId });
        res.json({ message: 'Student deleted.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting student.' });
    }
});

module.exports = router;

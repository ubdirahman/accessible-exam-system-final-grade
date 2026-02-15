const express = require('express');
const crypto = require('crypto');
const { verifyToken, requireAdmin, requireStudent } = require('../middleware/auth');
const Exam = require('../models/Exam');
const Section = require('../models/Section');
const Question = require('../models/Question');
const Response = require('../models/Response');
const Result = require('../models/Result');
const ActivityLog = require('../models/ActivityLog');
const Student = require('../models/Student');
const axios = require('axios');

const router = express.Router();

/* ============================================================
   ADMIN ROUTES
   ============================================================ */

// POST /api/exams — Create exam
router.post('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { title, description, timeLimit, sections: sectionsData } = req.body;

        const exam = await Exam.create({
            title,
            description,
            timeLimit,
            createdBy: req.user.id,
            active: false,
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
                            correctAnswer: q.correctAnswer,
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

// GET /api/exams — List all exams
router.get('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const exams = await Exam.find().populate('sections').sort({ createdAt: -1 });
        console.log(`[DEBUG] Found ${exams.length} exams in database.`);
        res.json(exams);
    } catch (error) {
        console.error('Fetch exams error:', error);
        res.status(500).json({ message: 'Error fetching exams.' });
    }
});

// GET /api/exams/students — List all students (Admin)
// MOVED UP to avoid conflict with /:id
router.get('/students', verifyToken, requireAdmin, async (req, res) => {
    try {
        const students = await Student.find().sort({ createdAt: -1 });
        console.log(`[DEBUG] Found ${students.length} students in database.`);
        res.json(students);
    } catch (error) {
        console.error('CRITICAL FETCH STUDENTS ERROR:', error.message);
        console.error(error.stack);
        res.status(500).json({ message: 'Error fetching students.', error: error.message });
    }
});

// GET /api/exams/:id — Get single exam with sections + questions
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id).populate('sections');
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });

        const questions = await Question.find({ examId: exam._id }).sort({ order: 1 });
        res.json({ exam, questions });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching exam.' });
    }
});

// PUT /api/exams/:id — Update exam
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { title, description, timeLimit, active } = req.body;
        const exam = await Exam.findByIdAndUpdate(
            req.params.id,
            { title, description, timeLimit, active },
            { new: true }
        );
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });
        res.json({ message: 'Exam updated.', exam });
    } catch (error) {
        res.status(500).json({ message: 'Error updating exam.' });
    }
});

// DELETE /api/exams/:id — Delete exam and related data
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const examId = req.params.id;
        await Question.deleteMany({ examId });
        await Section.deleteMany({ examId });
        await Response.deleteMany({ examId });
        await ActivityLog.deleteMany({ examId });
        await Result.deleteMany({ examId });
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

// POST /api/exams/:id/start — Start exam
router.post('/:id/start', verifyToken, requireStudent, async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
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
                timeLimit: exam.timeLimit
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
        }

        // Grade open-ended via ML service
        if (question.type === 'open-ended' && selectedAnswer.trim()) {
            try {
                const mlRes = await axios.post(`${process.env.ML_SERVICE_URL}/ml/grade-open-ended`, {
                    questionId: question._id.toString(),
                    studentAnswer: selectedAnswer,
                    referenceAnswer: question.correctAnswer
                }, { timeout: 15000 });

                response.score = (mlRes.data.score / 100) * question.points;
                response.mlFeedback = mlRes.data.feedback;
                response.isCorrect = mlRes.data.score >= 50;
            } catch (mlError) {
                console.error('ML grading error:', mlError.message);
                // Store answer anyway, admin can grade manually
                response.score = null;
                response.mlFeedback = 'ML grading unavailable. Pending manual review.';
            }
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
            if (!resp || !resp.selectedAnswer) {
                skippedCount++;
            } else if (resp.isCorrect) {
                correctCount++;
                score += resp.score || 0;
            } else {
                wrongCount++;
                score += resp.score || 0; // partial credit for open-ended
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


router.post('/students', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { name, studentId, email } = req.body;
        const student = await Student.create({ name, studentId, email });
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
        const { name, email, accessibilitySettings } = req.body;
        const student = await Student.findOneAndUpdate(
            { studentId: req.params.studentId },
            { name, email, accessibilitySettings },
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
        await Student.findOneAndDelete({ studentId: req.params.studentId });
        res.json({ message: 'Student deleted.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting student.' });
    }
});

module.exports = router;

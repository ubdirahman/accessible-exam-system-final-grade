const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const Result = require('../models/Result');
const Exam = require('../models/Exam');
const Response = require('../models/Response');
const Question = require('../models/Question');
const Student = require('../models/Student');
const { generateResultPDF } = require('../utils/pdfExport');

const router = express.Router();

// Helper: ensure results match latest teacher grading
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
            const hasAnswer = resp && (resp.selectedAnswer || resp.autoGraded || resp.manuallyGraded);
            if (!resp || !hasAnswer) {
                skippedCount++;
            } else if (resp.isCorrect === true) {
                correctCount++;
                score += resp.score != null ? resp.score : q.points || 0;
            } else if (resp.isCorrect === false) {
                wrongCount++;
                score += resp.score || 0;
            } else {
                skippedCount++;
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
        console.error('Recompute result (results route) failed', err);
    }
}

// GET /api/results/:studentId — Get all results for a student
router.get('/:studentId', verifyToken, async (req, res) => {
    try {
        const studentId = req.params.studentId;
        // Recompute all exams this student touched to ensure freshness
        const examIds = await Response.find({ studentId }).distinct('examId');
        for (const examId of examIds) {
            await recomputeResult(examId, studentId);
        }

        const results = await Result.find({ studentId })
            .populate('examId', 'title description')
            .sort({ submittedAt: -1 });

        // for each result include per-question details so students can see
        // which items were correct/incorrect and any teacher feedback
        const enriched = await Promise.all(results.map(async (r) => {
            const examId = r.examId._id || r.examId;
            const questions = await Question.find({ examId });
            const responses = await Response.find({ studentId, examId });

            const details = questions.map(q => {
                const resp = responses.find(rr => rr.questionId.toString() === q._id.toString());
                return {
                    questionId: q._id,
                    questionText: q.questionText,
                    isCorrect: resp?.isCorrect,
                    teacherFeedback: resp?.teacherFeedback || '',
                    selectedAnswer: resp?.selectedAnswer || ''
                };
            });

            return { ...r.toObject(), details };
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Results fetch error:', error);
        res.status(500).json({ message: 'Error fetching results.' });
    }
});

// GET /api/results/exam/:examId — Get all results for an exam (admin)
router.get('/exam/:examId', verifyToken, requireAdmin, async (req, res) => {
    try {
        const examId = req.params.examId;
        const exam = await Exam.findById(examId);
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });
        if (req.user.role === 'admin' && exam.facultyId && exam.facultyId.toString() !== String(req.user.facultyId)) {
            return res.status(403).json({ message: 'Access denied for this faculty.' });
        }
        // Ensure every participant is recomputed before returning
        const studentIds = await Response.find({ examId }).distinct('studentId');
        for (const sid of studentIds) {
            await recomputeResult(examId, sid);
        }

        const results = await Result.find({ examId }).sort({ score: -1 });

        // Enrich each result with student name and optional question-level details
        const enriched = await Promise.all(results.map(async (r) => {
            const student = await Student.findOne({ studentId: r.studentId });
            const obj = { ...r.toObject(), studentName: student ? student.name : 'Unknown' };

            // fetch question details so admin can drill in
            const questions = await Question.find({ examId });
            const responses = await Response.find({ studentId: r.studentId, examId });
            const details = questions.map(q => {
                const resp = responses.find(rr => rr.questionId.toString() === q._id.toString());
                return {
                    questionId: q._id,
                    questionText: q.questionText,
                    isCorrect: resp?.isCorrect,
                    teacherFeedback: resp?.teacherFeedback || '',
                    selectedAnswer: resp?.selectedAnswer || ''
                };
            });
            obj.details = details;
            return obj;
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Exam results error:', error);
        res.status(500).json({ message: 'Error fetching exam results.' });
    }
});

// GET /api/results/:studentId/:examId/pdf — Download result as PDF
router.get('/:studentId/:examId/pdf', verifyToken, async (req, res) => {
    try {
        const { studentId, examId } = req.params;
        const result = await Result.findOne({ studentId, examId });
        if (!result) return res.status(404).json({ message: 'Result not found.' });

        const exam = await Exam.findById(examId);
        const student = await Student.findOne({ studentId });
        const questions = await Question.find({ examId });
        const responses = await Response.find({ studentId, examId });

        const pdfBuffer = await generateResultPDF({
            student,
            exam,
            result,
            questions,
            responses
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=result_${studentId}_${examId}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF export error:', error);
        res.status(500).json({ message: 'Error generating PDF.' });
    }
});

// GET /api/results/analytics/:examId — Analytics for an exam
router.get('/analytics/:examId', verifyToken, requireAdmin, async (req, res) => {
    try {
        const examId = req.params.examId;
        const exam = await Exam.findById(examId);
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });
        if (req.user.role === 'admin' && exam.facultyId && exam.facultyId.toString() !== String(req.user.facultyId)) {
            return res.status(403).json({ message: 'Access denied for this faculty.' });
        }
        const results = await Result.find({ examId });
        const participants = await Response.find({ examId }).distinct('studentId');

        if (results.length === 0) {
            return res.json({
                totalStudents: 0,
                finishedCount: 0,
                participants: participants.length,
                averageScore: 0,
                averagePercentage: 0,
                highestScore: 0,
                lowestScore: 0,
                totalPoints: 0,
                passRate: 0
            });
        }

        const scores = results.map(r => r.score);
        const totalPoints = results[0].totalPoints || 1;

        res.json({
            totalStudents: results.length,
            finishedCount: results.length,
            participants: participants.length,
            averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10,
            averagePercentage: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length / totalPoints) * 100),
            highestScore: Math.max(...scores),
            lowestScore: Math.min(...scores),
            totalPoints,
            passRate: Math.round((results.filter(r => (r.score / r.totalPoints) >= 0.5).length / results.length) * 100)
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching analytics.' });
    }
});

module.exports = router;

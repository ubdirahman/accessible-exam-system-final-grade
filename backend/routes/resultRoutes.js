const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const Result = require('../models/Result');
const Exam = require('../models/Exam');
const Response = require('../models/Response');
const Question = require('../models/Question');
const Student = require('../models/Student');
const { generateResultPDF } = require('../utils/pdfExport');

const router = express.Router();

// GET /api/results/:studentId — Get all results for a student
router.get('/:studentId', verifyToken, async (req, res) => {
    try {
        const results = await Result.find({ studentId: req.params.studentId })
            .populate('examId', 'title description')
            .sort({ submittedAt: -1 });

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching results.' });
    }
});

// GET /api/results/exam/:examId — Get all results for an exam (admin)
router.get('/exam/:examId', verifyToken, requireAdmin, async (req, res) => {
    try {
        const results = await Result.find({ examId: req.params.examId })
            .sort({ score: -1 });

        // Enrich with student names
        const enriched = await Promise.all(results.map(async (r) => {
            const student = await Student.findOne({ studentId: r.studentId });
            return {
                ...r.toObject(),
                studentName: student ? student.name : 'Unknown'
            };
        }));

        res.json(enriched);
    } catch (error) {
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
        const results = await Result.find({ examId });

        if (results.length === 0) {
            return res.json({ totalStudents: 0, averageScore: 0, highestScore: 0, lowestScore: 0 });
        }

        const scores = results.map(r => r.score);
        const totalPoints = results[0].totalPoints || 1;

        res.json({
            totalStudents: results.length,
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

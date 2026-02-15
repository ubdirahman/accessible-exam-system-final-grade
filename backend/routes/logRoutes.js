const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');
const Response = require('../models/Response');

const router = express.Router();

// GET /api/logs/:examId/:studentId — Get activity logs
router.get('/:examId/:studentId', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { examId, studentId } = req.params;
        const logs = await ActivityLog.find({ examId, studentId })
            .sort({ timestamp: 1 })
            .populate('questionId', 'questionText order');

        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching logs.' });
    }
});

// GET /api/logs/:examId — Get all logs for an exam
router.get('/:examId', verifyToken, requireAdmin, async (req, res) => {
    try {
        const logs = await ActivityLog.find({ examId: req.params.examId })
            .sort({ timestamp: -1 })
            .limit(500);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching logs.' });
    }
});

// POST /api/logs — Student can post activity logs
router.post('/', verifyToken, async (req, res) => {
    try {
        const { examId, action, questionId, details } = req.body;
        const log = await ActivityLog.create({
            studentId: req.user.studentId || req.user.id,
            examId,
            action,
            questionId: questionId || null,
            details: details || ''
        });
        res.status(201).json(log);
    } catch (error) {
        res.status(500).json({ message: 'Error creating log.' });
    }
});

module.exports = router;

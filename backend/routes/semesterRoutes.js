const express = require('express');
const Semester = require('../models/Semester');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function resolveFacultyId(req) {
    if (req.user.role === 'admin') return req.user.facultyId;
    return req.body.facultyId || req.query.facultyId || null;
}

// GET /api/semesters - list semesters for a faculty
router.get('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = resolveFacultyId(req);
        if (!facultyId) {
            return res.status(400).json({ message: 'facultyId is required.' });
        }
        const semesters = await Semester.find({ facultyId }).sort({ createdAt: -1 });
        res.json(semesters);
    } catch (error) {
        console.error('Fetch semesters error:', error);
        res.status(500).json({ message: 'Error fetching semesters.' });
    }
});

// POST /api/semesters - create a semester
router.post('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = resolveFacultyId(req);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });

        const { name, startDate, endDate } = req.body;
        if (!name) return res.status(400).json({ message: 'Semester name is required.' });

        const isPastDate = (dateStr) => {
            if (!dateStr) return false;
            const inputDate = new Date(dateStr);
            inputDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return inputDate < today;
        };

        if (isPastDate(startDate)) {
            return res.status(400).json({ message: 'Start date cannot be in the past.' });
        }
        if (isPastDate(endDate)) {
            return res.status(400).json({ message: 'End date cannot be in the past.' });
        }

        const semester = await Semester.create({
            name,
            startDate,
            endDate,
            facultyId,
            createdBy: req.user.id
        });
        res.status(201).json(semester);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Semester name already exists for this faculty.' });
        }
        console.error('Create semester error:', error);
        res.status(500).json({ message: 'Error creating semester.' });
    }
});

// PUT /api/semesters/:id - update semester
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = resolveFacultyId(req);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });

        const existing = await Semester.findOne({ _id: req.params.id, facultyId });
        if (!existing) return res.status(404).json({ message: 'Semester not found for this faculty.' });

        const { name, startDate, endDate, isActive } = req.body;

        const isPastDate = (dateStr) => {
            if (!dateStr) return false;
            const inputDate = new Date(dateStr);
            inputDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return inputDate < today;
        };

        // Only validate if date is being changed
        if (startDate && (!existing.startDate || new Date(startDate).getTime() !== new Date(existing.startDate).getTime()) && isPastDate(startDate)) {
            return res.status(400).json({ message: 'Start date cannot be in the past.' });
        }
        if (endDate && (!existing.endDate || new Date(endDate).getTime() !== new Date(existing.endDate).getTime()) && isPastDate(endDate)) {
            return res.status(400).json({ message: 'End date cannot be in the past.' });
        }

        const updates = (({ name, startDate, endDate, isActive }) => ({ name, startDate, endDate, isActive }))(req.body);
        const semester = await Semester.findOneAndUpdate(
            { _id: req.params.id, facultyId },
            updates,
            { new: true }
        );
        res.json(semester);
    } catch (error) {
        console.error('Update semester error:', error);
        res.status(500).json({ message: 'Error updating semester.' });
    }
});

// DELETE /api/semesters/:id - delete semester
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = resolveFacultyId(req);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });

        const Classroom = require('../models/Classroom');
        const classCount = await Classroom.countDocuments({ semesterId: req.params.id, facultyId });
        if (classCount > 0) {
            return res.status(400).json({ message: `Cannot delete semester. It is being used by ${classCount} class(es).` });
        }

        const semester = await Semester.findOneAndDelete({ _id: req.params.id, facultyId });
        if (!semester) return res.status(404).json({ message: 'Semester not found for this faculty.' });
        res.json({ message: 'Semester deleted.' });
    } catch (error) {
        console.error('Delete semester error:', error);
        res.status(500).json({ message: 'Error deleting semester.' });
    }
});

module.exports = router;
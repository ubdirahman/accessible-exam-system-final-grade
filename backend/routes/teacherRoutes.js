const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const Teacher = require('../models/Teacher');

const router = express.Router();

// GET /api/teachers — list all teachers (admin or super admin)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const isSuper = req.user.role === 'super_admin';
        const facultyId = req.user.facultyId || req.query.facultyId;
        const query = isSuper && facultyId ? { facultyId } : isSuper ? {} : { facultyId: req.user.facultyId };
        if (req.query.classId) query.classId = req.query.classId;
        
        const teachers = await Teacher.find(query).sort({ createdAt: -1 });
        res.json(teachers);
    } catch (error) {
        console.error('Fetch teachers error:', error);
        res.status(500).json({ message: 'Error fetching teachers.' });
    }
});

// POST /api/teachers — create a new teacher (admin or super admin)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { name, email, phone, address, password, classId, facultyId: bodyFacultyId } = req.body;
        const facultyId = req.user.role === 'admin' ? req.user.facultyId : (bodyFacultyId || req.user.facultyId);
        if (!facultyId) {
            return res.status(400).json({ message: 'facultyId is required.' });
        }

        if (classId) {
            const Classroom = require('../models/Classroom');
            const klass = await Classroom.findOne({ _id: classId, facultyId });
            if (!klass) return res.status(400).json({ message: 'Class not found for this faculty.' });
        }

        const teacher = await Teacher.create({ name, email, phone, address, password, facultyId, classId: classId || null });
        res.status(201).json(teacher);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Email already exists.' });
        }
        console.error('Create teacher error:', error);
        res.status(500).json({ message: 'Error creating teacher.' });
    }
});

// PUT /api/teachers/:id — update teacher details (admin only)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = req.user.role === 'admin' ? req.user.facultyId : (req.body.facultyId || req.user.facultyId);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });
        const { classId } = req.body;

        if (classId) {
            const Classroom = require('../models/Classroom');
            const klass = await Classroom.findOne({ _id: classId, facultyId });
            if (!klass) return res.status(400).json({ message: 'Class not found for this faculty.' });
        }

        const updates = (({ name, phone, address, active, classId }) => ({ name, phone, address, active, classId }))(req.body);
        const teacher = await Teacher.findOneAndUpdate({ _id: req.params.id, facultyId }, updates, { new: true });
        if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });
        res.json(teacher);
    } catch (error) {
        res.status(500).json({ message: 'Error updating teacher.' });
    }
});

// DELETE /api/teachers/:id — remove teacher (admin only)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = req.user.role === 'admin' ? req.user.facultyId : (req.query.facultyId || req.user.facultyId);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });
        const teacher = await Teacher.findOneAndDelete({ _id: req.params.id, facultyId });
        if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });
        res.json({ message: 'Teacher deleted.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting teacher.' });
    }
});

module.exports = router;

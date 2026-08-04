const express = require('express');
const Subject = require('../models/Subject');
const Classroom = require('../models/Classroom');
const Teacher = require('../models/Teacher');
const { verifyToken, requireAdmin, requireTeacher } = require('../middleware/auth');

const router = express.Router();

function resolveFacultyId(req) {
    if (req.user.role === 'admin') return req.user.facultyId;
    return req.body.facultyId || req.query.facultyId || null;
}

// GET /api/subjects - list subjects
router.get('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = resolveFacultyId(req);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });

        const filter = { facultyId };
        if (req.query.classId) filter.classId = req.query.classId;

        const subjects = await Subject.find(filter).sort({ createdAt: -1 }).populate('teacherId', 'name').populate('classId', 'name');
        res.json(subjects);
    } catch (error) {
        console.error('Fetch subjects error:', error);
        res.status(500).json({ message: 'Error fetching subjects.' });
    }
});

// GET /api/subjects/my — subjects assigned to the current teacher
router.get('/my', verifyToken, requireTeacher, async (req, res) => {
    try {
        const query = { teacherId: req.user.id };
        if (req.user.classId) query.classId = req.user.classId;
        
        const subjects = await Subject.find(query).populate('classId', 'name');
        res.json(subjects);
    } catch (error) {
        console.error('Fetch my subjects error:', error);
        res.status(500).json({ message: 'Error fetching subjects.' });
    }
});

// POST /api/subjects - create subject
router.post('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = resolveFacultyId(req);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });

        const { name, code, classId, teacherId } = req.body;
        if (!name || !/^[a-zA-Z\s\u0600-\u06FF]+$/.test(name.trim())) {
            return res.status(400).json({ message: 'Subject name must contain text only (letters and spaces).' });
        }
        if (code && !/^[a-zA-Z0-9]+$/.test(code.trim())) {
            return res.status(400).json({ message: 'Subject code must contain letters and numbers only.' });
        }

        // Optional: ensure class belongs to same faculty
        if (classId) {
            const klass = await Classroom.findOne({ _id: classId, facultyId });
            if (!klass) return res.status(400).json({ message: 'Class not found for this faculty.' });
        }
        if (teacherId) {
            const teacher = await Teacher.findOne({ _id: teacherId, facultyId });
            if (!teacher) return res.status(400).json({ message: 'Teacher not found for this faculty.' });
        }

        const subject = await Subject.create({
            name: name.trim(),
            code: code ? code.trim().toUpperCase() : '',
            classId: classId || null,
            teacherId: teacherId || null,
            facultyId,
            createdBy: req.user.id
        });

        res.status(201).json(subject);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Subject code already exists for this faculty.' });
        }
        console.error('Create subject error:', error);
        res.status(500).json({ message: 'Error creating subject.' });
    }
});

// PUT /api/subjects/:id - update subject
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = resolveFacultyId(req);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });

        const { name, code, classId, teacherId } = req.body;
        if (name && !/^[a-zA-Z\s\u0600-\u06FF]+$/.test(name.trim())) {
            return res.status(400).json({ message: 'Subject name must contain text only (letters and spaces).' });
        }
        if (code && !/^[a-zA-Z0-9]+$/.test(code.trim())) {
            return res.status(400).json({ message: 'Subject code must contain letters and numbers only.' });
        }

        if (classId) {
            const klass = await Classroom.findOne({ _id: classId, facultyId });
            if (!klass) return res.status(400).json({ message: 'Class not found for this faculty.' });
        }
        if (teacherId) {
            const teacher = await Teacher.findOne({ _id: teacherId, facultyId });
            if (!teacher) return res.status(400).json({ message: 'Teacher not found for this faculty.' });
        }

        const updates = {
            ...(name && { name: name.trim() }),
            ...(code !== undefined && { code: code ? code.trim().toUpperCase() : '' }),
            classId: classId || null,
            teacherId: teacherId || null
        };
        const subject = await Subject.findOneAndUpdate(
            { _id: req.params.id, facultyId },
            updates,
            { new: true }
        );
        if (!subject) return res.status(404).json({ message: 'Subject not found for this faculty.' });
        res.json(subject);
    } catch (error) {
        console.error('Update subject error:', error);
        res.status(500).json({ message: 'Error updating subject.' });
    }
});

// DELETE /api/subjects/:id - delete subject
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = resolveFacultyId(req);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });

        const subject = await Subject.findOneAndDelete({ _id: req.params.id, facultyId });
        if (!subject) return res.status(404).json({ message: 'Subject not found for this faculty.' });
        res.json({ message: 'Subject deleted.' });
    } catch (error) {
        console.error('Delete subject error:', error);
        res.status(500).json({ message: 'Error deleting subject.' });
    }
});

module.exports = router;

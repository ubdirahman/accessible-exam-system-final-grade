const express = require('express');
const Classroom = require('../models/Classroom');
const { verifyToken, requireAdmin, requireTeacher } = require('../middleware/auth');

const router = express.Router();

// helper to resolve faculty scope
function resolveFacultyId(req) {
    if (req.user.role === 'admin') return req.user.facultyId;
    return req.body.facultyId || req.query.facultyId || null;
}

// GET /api/classes - list classes for a faculty
router.get('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = resolveFacultyId(req);
        if (!facultyId) {
            return res.status(400).json({ message: 'facultyId is required.' });
        }
        const classes = await Classroom.find({ facultyId }).populate('semesterId', 'name').sort({ createdAt: -1 });
        res.json(classes);
    } catch (error) {
        console.error('Fetch classes error:', error);
        res.status(500).json({ message: 'Error fetching classes.' });
    }
});

// GET /api/classes/my — classes available to the current teacher
router.get('/my', verifyToken, requireTeacher, async (req, res) => {
    try {
        const Subject = require('../models/Subject');
        const teacherId = req.user.id;

        // gather class IDs from subjects the teacher owns, plus their primary classId if set
        const subjects = await Subject.find({ teacherId }).select('classId');
        const subjectClassIds = subjects.map(s => s.classId).filter(Boolean).map(id => id.toString());
        const teacherClassId = req.user.classId ? [req.user.classId.toString()] : [];

        const classIds = [...new Set([...subjectClassIds, ...teacherClassId])];

        if (classIds.length === 0) {
            return res.json([]);
        }

        const classes = await Classroom.find({ _id: { $in: classIds } });
        res.json(classes);
    } catch (error) {
        console.error('Fetch my classes error:', error);
        res.status(500).json({ message: 'Error fetching classes.' });
    }
});

// POST /api/classes - create a class
router.post('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = resolveFacultyId(req);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });

        const { name, code, semesterId } = req.body;
        if (!name) return res.status(400).json({ message: 'Class name is required.' });
        if (!semesterId) return res.status(400).json({ message: 'Semester is required.' });

        const classroom = await Classroom.create({
            name,
            code,
            facultyId,
            semesterId,
            createdBy: req.user.id
        });
        res.status(201).json(classroom);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Class code already exists for this faculty.' });
        }
        console.error('Create class error:', error);
        res.status(500).json({ message: 'Error creating class.' });
    }
});

// PUT /api/classes/:id - update class
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = resolveFacultyId(req);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });

        const updates = (({ name, code, semesterId }) => ({ name, code, semesterId }))(req.body);
        const classroom = await Classroom.findOneAndUpdate(
            { _id: req.params.id, facultyId },
            updates,
            { new: true }
        );
        if (!classroom) return res.status(404).json({ message: 'Class not found for this faculty.' });
        res.json(classroom);
    } catch (error) {
        console.error('Update class error:', error);
        res.status(500).json({ message: 'Error updating class.' });
    }
});

// DELETE /api/classes/:id - delete class
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const facultyId = resolveFacultyId(req);
        if (!facultyId) return res.status(400).json({ message: 'facultyId is required.' });

        const classroom = await Classroom.findOneAndDelete({ _id: req.params.id, facultyId });
        if (!classroom) return res.status(404).json({ message: 'Class not found for this faculty.' });
        res.json({ message: 'Class deleted.' });
    } catch (error) {
        console.error('Delete class error:', error);
        res.status(500).json({ message: 'Error deleting class.' });
    }
});

module.exports = router;

const express = require('express');
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Exam = require('../models/Exam');

const router = express.Router();

// POST /api/student-login — Student ID only (auto-finds active exam) or + Exam Code
router.post('/student-login', async (req, res) => {
    try {
        const { studentId, examCode } = req.body;

        if (!studentId) {
            return res.status(400).json({ message: 'Student ID is required.' });
        }

        // Find student
        const student = await Student.findOne({ studentId: new RegExp(`^${studentId}$`, 'i') });
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        let exam;
        let codeEntry;

        if (examCode) {
            // Find specific exam with valid code
            exam = await Exam.findOne({
                'examCodes.code': examCode,
                active: true
            });

            if (!exam) {
                return res.status(400).json({ message: 'Invalid exam code or exam is not active.' });
            }

            if (student.facultyId && exam.facultyId && exam.facultyId.toString() !== String(student.facultyId)) {
                return res.status(403).json({ message: 'This exam is not assigned to your faculty.' });
            }
            if (exam.classId && student.classId && exam.classId.toString() !== String(student.classId)) {
                return res.status(403).json({ message: 'This exam is not assigned to your class.' });
            }

            codeEntry = exam.examCodes.find(c => c.code === examCode);
            if (!codeEntry) {
                return res.status(400).json({ message: 'Exam code not found.' });
            }

            if (codeEntry.used && codeEntry.studentId !== studentId) {
                return res.status(400).json({ message: 'This exam code has already been used by another student.' });
            }

            if (new Date() > new Date(codeEntry.expiresAt)) {
                return res.status(400).json({ message: 'This exam code has expired.' });
            }

            // Mark code as used if not already (allowing resume)
            if (!codeEntry.used) {
                codeEntry.used = true;
                codeEntry.studentId = studentId;
                await exam.save();
            }
        } else {
            // Auto-find most recent active exam strictly for the student's class (and faculty if present)
            if (!student.classId) {
                return res.status(404).json({ message: 'No class assigned to your account. Contact admin.' });
            }

            const query = { active: true, classId: student.classId };
            if (student.facultyId) query.facultyId = student.facultyId;

            exam = await Exam.findOne(query).sort({ createdAt: -1 });

            if (!exam) {
                return res.status(404).json({ message: 'No active exams found for your class.' });
            }
        }

        // Add exam code to student record
        if (examCode && !student.examCodes.includes(examCode)) {
            student.examCodes.push(examCode);
            await student.save();
        }

        // Generate JWT
        const token = jwt.sign(
            {
                id: student._id,
                studentId: student.studentId,
                role: 'student',
                examId: exam._id,
                facultyId: student.facultyId || null
            },
            process.env.JWT_SECRET,
            { expiresIn: '4h' }
        );

        res.json({
            token,
            student: {
                id: student._id,
                name: student.name,
                studentId: student.studentId,
                accessibilitySettings: student.accessibilitySettings
            },
            exam: {
                id: exam._id,
                title: exam.title,
                description: exam.description,
                timeLimit: exam.timeLimit
            }
        });
    } catch (error) {
        console.error('Student login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// POST /api/admin-login — Email + Password
router.post('/admin-login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            {
                id: admin._id,
                email: admin.email,
                role: admin.role || 'admin',
                facultyId: admin.facultyId || null
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role || 'admin',
                facultyId: admin.facultyId || null
            }
        });
    } catch (error) {
        console.error('CRITICAL ADMIN LOGIN ERROR:', error.message);
        console.error(error.stack);
        res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
});

// POST /api/teacher-login — Email + Password
router.post('/teacher-login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const teacher = await Teacher.findOne({ email });
        if (!teacher) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const isMatch = await teacher.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            {
                id: teacher._id,
                email: teacher.email,
                role: 'teacher',
                facultyId: teacher.facultyId || null,
                classId: teacher.classId || null
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            teacher: {
                id: teacher._id,
                name: teacher.name,
                email: teacher.email,
                phone: teacher.phone,
                address: teacher.address,
                role: 'teacher',
                facultyId: teacher.facultyId || null,
                classId: teacher.classId || null
            }
        });
    } catch (error) {
        console.error('Teacher login error:', error.message);
        res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
});

module.exports = router;

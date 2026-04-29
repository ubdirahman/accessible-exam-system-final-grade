const express = require('express');
const fs = require('fs');
const path = require('path');
const { verifyToken, requireAdmin, requireStudent } = require('../middleware/auth');
const ExamRecording = require('../models/ExamRecording');
const Exam = require('../models/Exam');
const Student = require('../models/Student');
const {
    ensureRecordingsDir,
    buildRecordingAbsolutePath,
    deleteRecordingFile,
    getExtensionFromMimeType
} = require('../utils/examRecordingStorage');

const router = express.Router();

function resolveFacultyFilter(req) {
    if (req.user.role === 'admin') return req.user.facultyId || null;
    return req.query.facultyId || req.user.facultyId || null;
}

function canAccessRecording(req, recording) {
    if (!recording) return false;
    if (req.user.role === 'super_admin') return true;
    return recording.facultyId && String(recording.facultyId) === String(req.user.facultyId);
}

function parseRecordingMeta(req) {
    const rawMeta = req.headers['x-recording-meta'];
    if (!rawMeta) return {};

    try {
        return JSON.parse(rawMeta);
    } catch (error) {
        console.warn('Invalid recording metadata header:', error.message);
        return {};
    }
}

router.get('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const query = {};
        const facultyId = resolveFacultyFilter(req);

        if (facultyId) {
            query.facultyId = facultyId;
        }
        if (req.query.classId) {
            query.classId = req.query.classId;
        }
        if (req.query.examId) {
            query.examId = req.query.examId;
        }
        if (req.query.studentId) {
            query.studentId = req.query.studentId;
        }
        if (req.query.status) {
            query.status = req.query.status;
        }

        const recordings = await ExamRecording.find(query)
            .sort({ uploadedAt: -1, startedAt: -1 })
            .lean();

        res.json(recordings);
    } catch (error) {
        console.error('Fetch recordings error:', error);
        res.status(500).json({ message: 'Error fetching recordings.' });
    }
});

router.get('/:id/audio', verifyToken, requireAdmin, async (req, res) => {
    try {
        const recording = await ExamRecording.findById(req.params.id);
        if (!recording) {
            return res.status(404).json({ message: 'Recording not found.' });
        }

        if (!canAccessRecording(req, recording)) {
            return res.status(403).json({ message: 'Access denied for this recording.' });
        }

        const absolutePath = buildRecordingAbsolutePath(recording.filePath);
        if (!absolutePath || !fs.existsSync(absolutePath)) {
            return res.status(404).json({ message: 'Recording file not found.' });
        }

        res.setHeader('Content-Type', recording.mimeType || 'application/octet-stream');
        res.setHeader('Content-Length', recording.fileSize || fs.statSync(absolutePath).size);
        res.setHeader('Content-Disposition', `inline; filename="${recording.fileName}"`);
        res.sendFile(path.resolve(absolutePath));
    } catch (error) {
        console.error('Stream recording error:', error);
        res.status(500).json({ message: 'Error loading recording audio.' });
    }
});

router.post(
    '/exams/:examId/upload',
    verifyToken,
    requireStudent,
    express.raw({ type: () => true, limit: '100mb' }),
    async (req, res) => {
        try {
            const examId = req.params.examId;
            const studentId = req.user.studentId;
            const meta = parseRecordingMeta(req);
            const exam = await Exam.findById(examId).populate('subjectId', 'name');
            const student = await Student.findOne({ studentId });

            if (!exam) {
                return res.status(404).json({ message: 'Exam not found.' });
            }
            if (!student) {
                return res.status(404).json({ message: 'Student not found.' });
            }

            const audioBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
            if (!audioBuffer.length) {
                return res.status(400).json({ message: 'Recording audio is empty.' });
            }

            const mimeType = meta.mimeType || req.headers['content-type'] || 'audio/webm';
            const extension = getExtensionFromMimeType(mimeType);
            const safeStudentId = String(studentId).replace(/[^a-z0-9_-]/gi, '_');
            const fileName = `${examId}_${safeStudentId}_${Date.now()}.${extension}`;
            const recordingsDir = ensureRecordingsDir();
            const absolutePath = path.join(recordingsDir, fileName);
            const relativePath = path.join('uploads', 'recordings', fileName);

            const existing = await ExamRecording.findOne({ studentId, examId });
            if (existing?.filePath) {
                deleteRecordingFile(existing.filePath);
            }

            fs.writeFileSync(absolutePath, audioBuffer);

            const payload = {
                studentId,
                studentName: student.name || '',
                examId: exam._id,
                examTitle: exam.title || '',
                subjectName: exam.subjectId?.name || exam.title || '',
                facultyId: student.facultyId || exam.facultyId || null,
                classId: student.classId || exam.classId || null,
                mimeType,
                fileName,
                filePath: relativePath,
                fileSize: audioBuffer.length,
                durationSeconds: Number(meta.durationSeconds || 0),
                status: meta.status || 'completed',
                startedAt: meta.startedAt ? new Date(meta.startedAt) : new Date(),
                endedAt: meta.endedAt ? new Date(meta.endedAt) : new Date(),
                uploadedAt: new Date()
            };

            const recording = await ExamRecording.findOneAndUpdate(
                { studentId, examId },
                payload,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            res.status(201).json({
                message: 'Recording uploaded successfully.',
                recording: {
                    id: recording._id,
                    studentId: recording.studentId,
                    studentName: recording.studentName,
                    examId: recording.examId,
                    examTitle: recording.examTitle,
                    subjectName: recording.subjectName,
                    durationSeconds: recording.durationSeconds,
                    status: recording.status,
                    uploadedAt: recording.uploadedAt
                }
            });
        } catch (error) {
            console.error('Upload recording error:', error);
            res.status(500).json({ message: 'Error uploading recording.' });
        }
    }
);

module.exports = router;

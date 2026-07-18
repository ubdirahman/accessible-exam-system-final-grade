const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const Result = require('../models/Result');
const Exam = require('../models/Exam');
const Response = require('../models/Response');
const Question = require('../models/Question');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Classroom = require('../models/Classroom');
const Subject = require('../models/Subject');
const { generateResultPDF, generateClassMatrixPDF } = require('../utils/pdfExport');

const router = express.Router();

function resolveFacultyId(req) {
    if (req.user.role === 'admin') return req.user.facultyId;
    return req.query.facultyId || req.user.facultyId || null;
}

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

async function buildClassMatrixData(facultyId, classId) {
    if (!facultyId) {
        const error = new Error('facultyId is required.');
        error.status = 400;
        throw error;
    }

    if (!classId) {
        const error = new Error('classId is required.');
        error.status = 400;
        throw error;
    }

    const [faculty, classroom] = await Promise.all([
        Faculty.findById(facultyId).select('name code'),
        Classroom.findOne({ _id: classId, facultyId }).select('name code semesterId').populate('semesterId', 'name')
    ]);

    if (!classroom) {
        const error = new Error('Class not found for this faculty.');
        error.status = 404;
        throw error;
    }

    const students = await Student.find({ facultyId, classId })
        .populate('facultyId', 'name')
        .populate('classId', 'name')
        .sort({ name: 1, studentId: 1 });

    const [classSubjects, exams] = await Promise.all([
        Subject.find({ facultyId, classId }).select('name').sort({ name: 1 }),
        Exam.find({ facultyId, classId })
            .populate('subjectId', 'name')
            .sort({ createdAt: 1, title: 1 })
    ]);

    const examIds = exams.map((exam) => exam._id);
    const studentIds = students.map((student) => student.studentId);

    if (examIds.length > 0 && studentIds.length > 0) {
        const [responsePairs, existingResultPairs] = await Promise.all([
            Response.find({ examId: { $in: examIds }, studentId: { $in: studentIds } })
                .select('examId studentId')
                .lean(),
            Result.find({ examId: { $in: examIds }, studentId: { $in: studentIds } })
                .select('examId studentId')
                .lean()
        ]);

        const pairMap = new Map();

        [...responsePairs, ...existingResultPairs].forEach((entry) => {
            const examId = entry.examId?.toString();
            const studentId = entry.studentId;
            if (!examId || !studentId) return;
            pairMap.set(`${examId}:${studentId}`, { examId, studentId });
        });

        await Promise.all(
            Array.from(pairMap.values()).map(({ examId, studentId }) =>
                recomputeResult(examId, studentId)
            )
        );
    }

    const results = examIds.length > 0 && studentIds.length > 0
        ? await Result.find({ examId: { $in: examIds }, studentId: { $in: studentIds } }).sort({ submittedAt: -1 })
        : [];

    const subjectMap = new Map();
    const examMap = new Map();

    classSubjects.forEach((subject) => {
        subjectMap.set(subject._id.toString(), {
            key: subject._id.toString(),
            label: subject.name
        });
    });

    exams.forEach((exam) => {
        const subjectKey = exam.subjectId?._id?.toString() || `exam:${exam._id}`;
        const subjectName = exam.subjectId?.name || exam.title || 'Untitled Subject';

        if (!subjectMap.has(subjectKey)) {
            subjectMap.set(subjectKey, {
                key: subjectKey,
                label: subjectName
            });
        }

        examMap.set(exam._id.toString(), {
            subjectKey,
            subjectName,
            examTitle: exam.title
        });
    });

    const resultsByStudent = new Map();
    results.forEach((result) => {
        const current = resultsByStudent.get(result.studentId) || [];
        current.push(result);
        resultsByStudent.set(result.studentId, current);
    });

    const subjects = Array.from(subjectMap.values()).sort((a, b) => a.label.localeCompare(b.label));

    const rows = students.map((student) => {
        const latestBySubject = {};
        const studentResults = resultsByStudent.get(student.studentId) || [];

        studentResults.forEach((result) => {
            const examMeta = examMap.get(result.examId.toString());
            if (!examMeta || latestBySubject[examMeta.subjectKey]) return;

            latestBySubject[examMeta.subjectKey] = {
                subjectKey: examMeta.subjectKey,
                subjectName: examMeta.subjectName,
                examTitle: examMeta.examTitle,
                score: result.score || 0,
                totalPoints: result.totalPoints || 0,
                percentage: result.totalPoints > 0
                    ? Math.round((result.score / result.totalPoints) * 100)
                    : 0,
                submittedAt: result.submittedAt
            };
        });

        const subjectResults = Object.values(latestBySubject);

            return {
                id: student._id,
                name: student.name,
                studentId: student.studentId,
                facultyName: student.facultyId?.name || faculty?.name || '-',
                className: student.classId?.name || classroom.name,
                subjectCount: subjects.length,
                completedSubjectCount: subjectResults.length,
                totalScore: subjectResults.reduce((sum, entry) => sum + (entry.score || 0), 0),
                totalPoints: subjectResults.reduce((sum, entry) => sum + (entry.totalPoints || 0), 0),
                subjectScores: latestBySubject
            };
    });

    return {
        faculty: faculty ? { id: faculty._id, name: faculty.name, code: faculty.code } : null,
        class: {
            id: classroom._id,
            name: classroom.name,
            code: classroom.code,
            semesterName: classroom.semesterId?.name || ''
        },
        subjects,
        students: rows
    };
}

// GET /api/results/:studentId — Get all results for a student
router.get('/class-matrix/pdf', verifyToken, requireAdmin, async (req, res) => {
    try {
        const payload = await buildClassMatrixData(resolveFacultyId(req), req.query.classId);
        const pdfBuffer = await generateClassMatrixPDF({
            faculty: payload.faculty,
            classroom: payload.class,
            subjects: payload.subjects,
            students: payload.students
        });

        const safeClassName = (payload.class?.name || 'class-results').replace(/[^a-z0-9-_]+/gi, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=result_exam_${safeClassName}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Class matrix pdf error:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error generating class result PDF.' });
    }
});

router.get('/class-matrix', verifyToken, requireAdmin, async (req, res) => {
    try {
        const payload = await buildClassMatrixData(resolveFacultyId(req), req.query.classId);
        res.json(payload);
    } catch (error) {
        console.error('Class matrix error:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error fetching class result matrix.' });
    }
});

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
        const student = await Student.findOne({ studentId })
            .populate('facultyId')
            .populate({
                path: 'classId',
                populate: { path: 'semesterId' }
            });
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

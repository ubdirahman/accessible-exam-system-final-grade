const Exam = require('../models/Exam');
const Result = require('../models/Result');

function buildExamItem(exam, result, status) {
    const examId = exam._id?.toString() || exam.id?.toString();
    const subjectId = exam.subjectId?._id?.toString() || exam.subjectId?.toString() || null;
    const subjectName = exam.subjectId?.name || exam.title || 'Untitled Subject';
    const totalPoints = result?.totalPoints || 0;
    const score = result?.score || 0;

    return {
        id: examId,
        title: exam.title,
        description: exam.description || '',
        timeLimit: exam.timeLimit || 0,
        subjectId,
        subjectName,
        status,
        completed: status === 'completed',
        score,
        totalPoints,
        percentage: totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0,
        submittedAt: result?.submittedAt || null
    };
}

async function buildStudentExamQueue(student, preferredExamId = null) {
    if (!student?.classId) {
        return {
            totalCount: 0,
            completedCount: 0,
            remainingCount: 0,
            currentExam: null,
            exams: []
        };
    }

    const query = {
        active: true,
        classId: student.classId
    };

    if (student.facultyId) {
        query.facultyId = student.facultyId;
    }

    const exams = await Exam.find(query)
        .populate('subjectId', 'name')
        .sort({ createdAt: 1, title: 1 })
        .lean();

    if (!exams.length) {
        return {
            totalCount: 0,
            completedCount: 0,
            remainingCount: 0,
            currentExam: null,
            exams: []
        };
    }

    const examIds = exams.map((exam) => exam._id);
    const results = await Result.find({
        studentId: student.studentId,
        examId: { $in: examIds },
        locked: true
    }).lean();

    const resultMap = new Map(
        results.map((result) => [result.examId.toString(), result])
    );

    const preferredId = preferredExamId ? String(preferredExamId) : null;
    let currentExamId = null;

    if (preferredId) {
        const preferredExists = exams.some((exam) => exam._id.toString() === preferredId);
        const preferredResult = resultMap.get(preferredId);
        if (preferredExists && !preferredResult?.locked) {
            currentExamId = preferredId;
        }
    }

    if (!currentExamId) {
        const firstUnfinished = exams.find((exam) => !resultMap.get(exam._id.toString())?.locked);
        currentExamId = firstUnfinished ? firstUnfinished._id.toString() : null;
    }

    const queue = exams.map((exam) => {
        const examId = exam._id.toString();
        const result = resultMap.get(examId);
        let status = 'remaining';

        if (result?.locked) {
            status = 'completed';
        } else if (examId === currentExamId) {
            status = 'current';
        }

        return buildExamItem(exam, result, status);
    });

    const completedCount = queue.filter((exam) => exam.status === 'completed').length;
    const remainingCount = queue.filter((exam) => exam.status !== 'completed').length;

    return {
        totalCount: queue.length,
        completedCount,
        remainingCount,
        currentExam: queue.find((exam) => exam.status === 'current') || null,
        exams: queue
    };
}

module.exports = {
    buildStudentExamQueue
};

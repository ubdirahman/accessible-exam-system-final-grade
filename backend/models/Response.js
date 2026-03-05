const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    selectedAnswer: { type: String, default: '' },
    isCorrect: { type: Boolean, default: null },
    score: { type: Number, default: null },
    mlFeedback: { type: String, default: '' },
    teacherFeedback: { type: String, default: '' },
    manuallyGraded: { type: Boolean, default: false },
    autoGraded: { type: Boolean, default: false },
    answeredAt: { type: Date, default: Date.now },
    modifiedCount: { type: Number, default: 0 }
});

responseSchema.index({ studentId: 1, examId: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model('Response', responseSchema);

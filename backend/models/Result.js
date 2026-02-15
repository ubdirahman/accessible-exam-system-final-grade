const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    score: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    timeTaken: { type: Number, default: 0, comment: 'Time in seconds' },
    submittedAt: { type: Date, default: Date.now },
    locked: { type: Boolean, default: true }
});

resultSchema.index({ studentId: 1, examId: 1 }, { unique: true });

module.exports = mongoose.model('Result', resultSchema);

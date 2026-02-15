const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    action: {
        type: String,
        enum: [
            'exam_started', 'question_opened', 'answer_selected',
            'answer_modified', 'question_skipped', 'exam_finished',
            'voice_command', 'tab_switch_attempt'
        ],
        required: true
    },
    details: { type: String, default: '' },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', default: null },
    timestamp: { type: Date, default: Date.now }
});

activityLogSchema.index({ studentId: 1, examId: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);

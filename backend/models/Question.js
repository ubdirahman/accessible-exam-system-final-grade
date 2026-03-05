const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    type: { type: String, enum: ['mcq', 'true-false', 'open-ended'], required: true },
    questionText: { type: String, required: true },
    options: [{ label: String, text: String }],
    correctAnswer: { type: String, required: function() { return this.type !== 'open-ended'; } },
    points: { type: Number, default: 1 },
    order: { type: Number, default: 0 }
});

module.exports = mongoose.model('Question', questionSchema);

const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    timeLimit: { type: Number, required: true, comment: 'Time limit in minutes' },
    sections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Section' }],
    active: { type: Boolean, default: false },
    examCodes: [{
        code: { type: String, required: true },
        studentId: { type: String, default: null },
        used: { type: Boolean, default: false },
        expiresAt: { type: Date, required: true }
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Exam', examSchema);

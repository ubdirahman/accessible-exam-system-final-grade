const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true }
});

module.exports = mongoose.model('Section', sectionSchema);

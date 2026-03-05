const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', default: null },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    createdAt: { type: Date, default: Date.now }
});

// Unique subject code within faculty if provided
subjectSchema.index({ facultyId: 1, code: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Subject', subjectSchema);

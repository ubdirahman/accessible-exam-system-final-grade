const mongoose = require('mongoose');

const semesterSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: false },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Semester', semesterSchema);


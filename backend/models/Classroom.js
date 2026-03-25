const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', default: null },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    createdAt: { type: Date, default: Date.now }
});

// Ensure class codes are unique within a faculty if provided
classroomSchema.index({ facultyId: 1, code: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Classroom', classroomSchema);

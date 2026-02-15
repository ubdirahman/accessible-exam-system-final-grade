const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    studentId: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true },
    examCodes: [{ type: String }],
    accessibilitySettings: {
        highContrast: { type: Boolean, default: true },
        fontSize: { type: String, enum: ['normal', 'large', 'x-large'], default: 'large' },
        speechRate: { type: Number, default: 1.0, min: 0.5, max: 2.0 },
        preferredVoice: { type: String, default: '' }
    },
    role: { type: String, default: 'student', immutable: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Student', studentSchema);

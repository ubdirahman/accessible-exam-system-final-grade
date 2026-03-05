const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Faculty', facultySchema);

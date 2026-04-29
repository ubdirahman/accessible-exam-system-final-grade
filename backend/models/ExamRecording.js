const mongoose = require('mongoose');

const examRecordingSchema = new mongoose.Schema({
    studentId: { type: String, required: true, trim: true },
    studentName: { type: String, default: '', trim: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    examTitle: { type: String, default: '', trim: true },
    subjectName: { type: String, default: '', trim: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', default: null },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', default: null },
    mimeType: { type: String, default: 'audio/webm' },
    fileName: { type: String, required: true, trim: true },
    filePath: { type: String, required: true, trim: true },
    fileSize: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['recording', 'completed', 'aborted', 'stopped'],
        default: 'completed'
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: Date.now },
    uploadedAt: { type: Date, default: Date.now }
});

examRecordingSchema.index({ studentId: 1, examId: 1 }, { unique: true });
examRecordingSchema.index({ facultyId: 1, uploadedAt: -1 });
examRecordingSchema.index({ classId: 1, uploadedAt: -1 });

module.exports = mongoose.model('ExamRecording', examRecordingSchema);

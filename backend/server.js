const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Simple logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Routes
app.use('/api', require('./routes/authRoutes'));
app.use('/api/exams', require('./routes/examRoutes'));
app.use('/api/logs', require('./routes/logRoutes'));
app.use('/api/results', require('./routes/resultRoutes'));

const Exam = require('./models/Exam');
const Student = require('./models/Student');

// Health check with data counts
app.get('/api/health', async (req, res) => {
    try {
        const examCount = await Exam.countDocuments();
        const studentCount = await Student.countDocuments();
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            db: { exams: examCount, students: studentCount }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;

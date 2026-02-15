import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { useTTS } from '../hooks/useTTS';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import api from '../api/axios';

export default function StudentDashboard() {
    const { user, logout } = useAuth();
    const { startExam } = useExam();
    const { speak } = useTTS();
    const navigate = useNavigate();
    const [examResult, setExamResult] = useState(null);
    const [examData, setExamData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Voice Commands
    const commandMap = {
        'start exam': () => {
            console.log('Voice: Start exam command');
            handleStartExam();
        },
        'begin exam': () => handleStartExam(),
        'start': () => handleStartExam()
    };

    const { isListening, startListening, stopListening } = useVoiceCommands(commandMap, true);

    useEffect(() => {
        loadExam();
        loadResults();
        // speak(`Welcome, ${user?.name || 'student'}. Your exam is ready. Say Start Exam or click the button to begin.`); // Disabled TTS
        startListening(); // Start voice listening
    }, []);

    const loadExam = async () => {
        try {
            const res = await api.get(`/exams/${user.examId}`);
            setExamData(res.data);
        } catch (err) {
            console.error('Load exam error:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadResults = async () => {
        try {
            const res = await api.get(`/results/${user.studentId}`);
            // Find result for current exam
            const currentResult = res.data.find(r => r.examId._id === user.examId || r.examId === user.examId);
            if (currentResult) {
                setExamResult(currentResult);
            }
        } catch (err) {
            console.error('Load results error:', err);
        }
    };

    const handleStartExam = async () => {
        if (examResult) {
            // speak('You have already completed this exam. Redirecting to results.'); // Disabled TTS
            navigate('/student/result');
            return;
        }

        try {
            const res = await api.post(`/exams/${user.examId}/start`);
            startExam(res.data.exam, res.data.sections, res.data.questions);
            // speak('Exam started. Good luck!'); // Disabled TTS
            navigate('/student/exam');
        } catch (err) {
            const msg = err.response?.data?.message || 'Could not start exam.';
            // speak(msg); // Disabled TTS

            // If error is "already completed", try to load results
            if (err.response?.status === 400 && msg.includes('already completed')) {
                loadResults();
            }
        }
    };

    if (loading) {
        return (
            <div className="loading-page">
                <div className="spinner"></div>
                <p>Loading exam details...</p>
            </div>
        );
    }

    const exam = examData?.exam;

    return (
        <div className="page">
            <div className="app-container">
                {/* Header */}
                <div className="navbar" style={{ position: 'relative', borderRadius: 'var(--radius)', marginBottom: 32 }}>
                    <div className="navbar-brand">
                        <span className="icon">♿</span>
                        Student Dashboard
                    </div>
                    <div className="navbar-actions">
                        <span className="badge badge-info">🎓 {user?.name}</span>
                        <button className="btn btn-secondary btn-sm" onClick={() => { logout(); navigate('/'); }}>
                            Logout
                        </button>
                    </div>
                </div>

                {exam ? (
                    <>
                        {/* Exam Info Card */}
                        <div className="card" style={{ marginBottom: 24 }}>
                            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, marginBottom: 12 }}>
                                📝 {exam.title}
                            </h2>
                            <p className="text-muted" style={{ marginBottom: 20 }}>{exam.description}</p>

                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-value">{exam.timeLimit}</div>
                                    <div className="stat-label">Minutes</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{examData.questions?.length || 0}</div>
                                    <div className="stat-label">Questions</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{exam.timeLimit > 0 ? '⏱️' : '♾️'}</div>
                                    <div className="stat-label">Timed</div>
                                </div>
                            </div>
                        </div>

                        {/* Instructions */}
                        {!examResult && (
                            <div className="card" style={{ marginBottom: 24 }}>
                                <h3 style={{ marginBottom: 16, fontWeight: 700 }}>🎤 Voice Commands</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                                    {[
                                        '"Next Question" — Go to next',
                                        '"Previous Question" — Go back',
                                        '"Option A/B/C/D" — Select answer',
                                        '"Repeat Question" — Hear again',
                                        '"Skip Question" — Skip current',
                                        '"How many remaining" — Check progress',
                                        '"Return to Unanswered" — Go to skipped',
                                        '"Finish Exam" — Submit exam'
                                    ].map((cmd, i) => (
                                        <div key={i} style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)' }}>
                                            {cmd}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Start Button */}
                        <div className="text-center">
                            {examResult ? (
                                <div>
                                    <div className="badge badge-success mb-md" style={{ display: 'inline-flex', padding: '12px 24px', fontSize: '1.1rem' }}>
                                        ✅ Exam Completed
                                    </div>
                                    <br />
                                    <button
                                        className="btn btn-secondary btn-lg"
                                        onClick={() => navigate('/student/result')}
                                        style={{ padding: '20px 60px', fontSize: 'var(--font-size-xl)', marginTop: 16 }}
                                    >
                                        📊 View Results
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        className="btn btn-primary btn-lg"
                                        onClick={handleStartExam}
                                        aria-label="Start Exam"
                                        style={{ padding: '20px 60px', fontSize: 'var(--font-size-xl)' }}
                                    >
                                        🚀 Start Exam
                                    </button>
                                    <p className="text-muted mt-md">Or say &quot;Start Exam&quot;</p>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="card text-center">
                        <h2>No exam available</h2>
                        <p className="text-muted mt-md">Your exam may not be active yet. Contact your administrator.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

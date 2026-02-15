import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTTS } from '../hooks/useTTS';
import api from '../api/axios';

export default function ReportsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { speak } = useTTS();
    const [exams, setExams] = useState([]);
    const [selectedExam, setSelectedExam] = useState(null);
    const [results, setResults] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [logs, setLogs] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [loading, setLoading] = useState(true);

    const readAnalytics = () => {
        if (!analytics) return;
        const examName = exams.find(e => e._id === selectedExam)?.title || 'Selected exam';
        let text = `Analytics for ${examName}. Total students: ${analytics.totalStudents}. `;
        text += `Average score is ${analytics.averagePercentage} percent. `;
        text += `The highest score reached was ${analytics.highestScore}. `;
        text += `The pass rate is ${analytics.passRate} percent.`;
        speak(text);
    };

    const readLogs = () => {
        if (!logs.length) {
            speak("No logs available for this student.");
            return;
        }
        let text = `Activity logs for student ${selectedStudent}. `;
        const recentLogs = logs.slice(0, 5);
        recentLogs.forEach((log, i) => {
            text += `At ${new Date(log.timestamp).toLocaleTimeString()}, action ${log.action.replace(/_/g, ' ')}. `;
        });
        speak(text);
    };

    useEffect(() => {
        loadExams();
    }, []);

    const loadExams = async () => {
        try {
            const res = await api.get('/exams');
            setExams(res.data);
        } catch (err) {
            console.error('Load exams error:', err);
        } finally {
            setLoading(false);
        }
    };

    const selectExam = async (examId) => {
        setSelectedExam(examId);
        setSelectedStudent(null);
        setLogs([]);
        try {
            const [resultsRes, analyticsRes] = await Promise.all([
                api.get(`/results/exam/${examId}`),
                api.get(`/results/analytics/${examId}`)
            ]);
            setResults(resultsRes.data);
            setAnalytics(analyticsRes.data);
        } catch (err) {
            console.error('Load results error:', err);
        }
    };

    const viewLogs = async (studentId) => {
        setSelectedStudent(studentId);
        try {
            const res = await api.get(`/logs/${selectedExam}/${studentId}`);
            setLogs(res.data);
        } catch (err) {
            console.error('Load logs error:', err);
        }
    };

    const downloadPDF = (studentId) => {
        window.open(`/api/results/${studentId}/${selectedExam}/pdf`, '_blank');
    };

    if (loading) {
        return (
            <div className="loading-page">
                <div className="spinner"></div>
                <p>Loading reports...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="app-container">
                {/* Header */}
                <div className="flex items-center justify-between mb-md">
                    <h1 style={{ fontWeight: 800, fontSize: 'var(--font-size-xl)' }}>
                        📊 Reports & Analytics
                    </h1>
                    <button className="btn btn-secondary" onClick={() => navigate('/admin/dashboard')}>
                        ← Back to Dashboard
                    </button>
                </div>

                {/* Exam Selection */}
                <div className="card mb-md">
                    <div className="flex items-center justify-between mb-sm">
                        <h3 style={{ fontWeight: 700 }}>Select Exam</h3>
                        {selectedExam && (
                            <button className="btn btn-secondary btn-sm" onClick={readAnalytics}>
                                🔊 Read Analytics
                            </button>
                        )}
                    </div>
                    <div className="section-tabs">
                        {exams.map((exam) => (
                            <button
                                key={exam._id}
                                className={`section-tab ${selectedExam === exam._id ? 'active' : ''}`}
                                onClick={() => selectExam(exam._id)}
                            >
                                {exam.title}
                            </button>
                        ))}
                    </div>
                </div>

                {selectedExam && analytics && (
                    <>
                        {/* Analytics */}
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-value">{analytics.totalStudents}</div>
                                <div className="stat-label">Students</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{analytics.averagePercentage}%</div>
                                <div className="stat-label">Average Score</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{analytics.highestScore}</div>
                                <div className="stat-label">Highest Score</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{analytics.passRate}%</div>
                                <div className="stat-label">Pass Rate</div>
                            </div>
                        </div>

                        {/* Results Table */}
                        <h3 style={{ fontWeight: 700, marginTop: 32, marginBottom: 16 }}>📋 Student Results</h3>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Student</th>
                                        <th>ID</th>
                                        <th>Score</th>
                                        <th>%</th>
                                        <th>Correct</th>
                                        <th>Wrong</th>
                                        <th>Skipped</th>
                                        <th>Time</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((r) => {
                                        const pct = r.totalPoints > 0 ? Math.round((r.score / r.totalPoints) * 100) : 0;
                                        return (
                                            <tr key={r._id}>
                                                <td style={{ fontWeight: 600 }}>{r.studentName}</td>
                                                <td>{r.studentId}</td>
                                                <td>{r.score}/{r.totalPoints}</td>
                                                <td>
                                                    <span className={`badge ${pct >= 50 ? 'badge-success' : 'badge-danger'}`}>
                                                        {pct}%
                                                    </span>
                                                </td>
                                                <td style={{ color: 'var(--success)' }}>{r.correctCount}</td>
                                                <td style={{ color: 'var(--danger)' }}>{r.wrongCount}</td>
                                                <td style={{ color: 'var(--warning)' }}>{r.skippedCount}</td>
                                                <td>{Math.floor(r.timeTaken / 60)}:{String(r.timeTaken % 60).padStart(2, '0')}</td>
                                                <td>
                                                    <div className="flex gap-sm">
                                                        <button className="btn btn-sm btn-secondary" onClick={() => viewLogs(r.studentId)}>
                                                            📝 Logs
                                                        </button>
                                                        <button className="btn btn-sm btn-primary" onClick={() => downloadPDF(r.studentId)}>
                                                            📄 PDF
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {results.length === 0 && (
                                        <tr><td colSpan="9" className="text-center text-muted" style={{ padding: 40 }}>No results yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Activity Logs */}
                        {selectedStudent && logs.length > 0 && (
                            <div className="card mt-lg">
                                <div className="flex items-center justify-between mb-md">
                                    <h3 style={{ fontWeight: 700 }}>
                                        📝 Activity Logs — Student: {selectedStudent}
                                    </h3>
                                    <button className="btn btn-secondary btn-sm" onClick={readLogs}>
                                        🔊 Read Logs
                                    </button>
                                </div>
                                <div className="table-wrapper">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Time</th>
                                                <th>Action</th>
                                                <th>Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {logs.map((log, i) => (
                                                <tr key={i}>
                                                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                        {new Date(log.timestamp).toLocaleTimeString()}
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${log.action === 'exam_finished' ? 'badge-success' :
                                                            log.action === 'tab_switch_attempt' ? 'badge-danger' :
                                                                'badge-info'
                                                            }`}>
                                                            {log.action.replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="text-muted">{log.details || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

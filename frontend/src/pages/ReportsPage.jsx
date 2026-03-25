import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTTS } from '../hooks/useTTS';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import api from '../api/axios';

export default function ReportsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { speak } = useTTS();

    const [exams, setExams] = useState([]);
    const [faculties, setFaculties] = useState([]);
    const [classes, setClasses] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState(user?.role === 'super_admin' ? '' : user?.facultyId || '');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedExam, setSelectedExam] = useState(null);

    const [results, setResults] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [logs, setLogs] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedDetails, setSelectedDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    const readAnalytics = () => {
        if (!analytics) return;
        const examName = exams.find(e => e._id === selectedExam)?.title || 'Selected exam';
        let text = `Analytics for ${examName}. Total students: ${analytics.totalStudents}. `;
        text += `Average score is ${analytics.averagePercentage} percent. `;
        text += `The highest score reached was ${analytics.highestScore}. `;
        text += `The pass rate is ${analytics.passRate} percent.`;
        speak(text);
    };

    const readResultsSummary = () => {
        if (!results || results.length === 0) return;
        speak(`There are ${results.length} students who took the exam.`);
    };

    const readStudentDetails = () => {
        if (!selectedDetails) return;
        const phrases = selectedDetails.map((d, idx) => {
            const status = d.isCorrect ? 'correct' : d.isCorrect === false ? 'incorrect' : 'ungraded';
            return `Question ${idx + 1} ${status}. ${d.teacherFeedback || ''}`;
        });
        speak(phrases.join(' '));
    };

    const readLogs = () => {
        if (!logs.length) {
            speak('No logs available for this student.');
            return;
        }
        let text = `Activity logs for student ${selectedStudent}. `;
        logs.slice(0, 5).forEach((log) => {
            text += `At ${new Date(log.timestamp).toLocaleTimeString()}, action ${log.action.replace(/_/g, ' ')}. `;
        });
        speak(text);
    };

    const commandMap = {
        'read results': readResultsSummary,
        'read analytics': readAnalytics,
        'read student': readStudentDetails,
        'read logs': readLogs
    };
    const { startListening } = useVoiceCommands(commandMap, true);

    useEffect(() => {
        initLoad();
        startListening();
    }, []);

    const initLoad = async () => {
        try {
            let facultyId = selectedFaculty;
            if (user?.role === 'super_admin') {
                facultyId = await loadFaculties();
            }
            await loadClasses(facultyId);
            await loadExams();
        } finally {
            setLoading(false);
        }
    };

    const loadFaculties = async () => {
        const res = await api.get('/faculties');
        setFaculties(res.data);
        if (!selectedFaculty && res.data.length) {
            setSelectedFaculty(res.data[0]._id);
            return res.data[0]._id;
        }
        return selectedFaculty;
    };

    const loadClasses = async (facultyIdOverride) => {
        const params = {};
        const facultyParam = user?.role === 'super_admin'
            ? (facultyIdOverride || selectedFaculty)
            : undefined;
        if (user?.role === 'super_admin' && facultyParam) params.facultyId = facultyParam;
        const res = await api.get('/classes', { params });
        setClasses(res.data);
    };

    const loadExams = async () => {
        const res = await api.get('/exams');
        setExams(res.data);
    };

    const selectExam = async (examId) => {
        setSelectedExam(examId);
        setSelectedStudent(null);
        setSelectedDetails(null);
        setLogs([]);
        try {
            const [resultsRes, analyticsRes] = await Promise.all([
                api.get(`/results/exam/${examId}`),
                api.get(`/results/analytics/${examId}`)
            ]);
            setResults(resultsRes.data);
            setAnalytics(analyticsRes.data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Load results error:', err);
        }
    };

    const viewLogs = async (studentId) => {
        setSelectedStudent(studentId);
        setSelectedDetails(null);
        try {
            const res = await api.get(`/logs/${selectedExam}/${studentId}`);
            setLogs(res.data);
        } catch (err) {
            console.error('Load logs error:', err);
        }
    };

    const viewDetails = (details) => {
        setSelectedDetails(details);
        setSelectedStudent(null);
    };

    const downloadPDF = async (studentId) => {
        if (!selectedExam) return;
        try {
            const res = await api.get(`/results/${studentId}/${selectedExam}/pdf`, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `result_${studentId}_${selectedExam}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('PDF download failed', err);
        }
    };

    const filteredExams = exams.filter(ex => {
        if (user?.role === 'super_admin' && selectedFaculty && ex.facultyId && ex.facultyId !== selectedFaculty) return false;
        if (selectedClass && ex.classId && ex.classId !== selectedClass) return false;
        if (selectedClass && !ex.classId) return false;
        return true;
    });

    useEffect(() => {
        if (user?.role === 'super_admin') {
            loadClasses();
        }
    }, [selectedFaculty]);

    useEffect(() => {
        setSelectedExam(null);
        setResults([]);
        setAnalytics(null);
    }, [selectedClass, selectedFaculty]);

    if (loading) {
        return (
            <div className="loading-page">
                <div className="spinner"></div>
                <p>Loading reports...</p>
            </div>
        );
    }

    return (
        <div className="fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-md">
                <h1 style={{ fontWeight: 800, fontSize: 'var(--font-size-xl)' }}>
                    <i className="fa-solid fa-chart-column" aria-hidden="true"></i> Reports & Analytics
                </h1>
                <button className="btn btn-secondary" onClick={() => navigate('/admin/dashboard')}>
                    <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Back to Dashboard
                </button>
            </div>

            {/* Filters */}
            <div className="card mb-md">
                <div className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                    {user?.role === 'super_admin' && (
                        <div className="input-group">
                            <label>Faculty</label>
                            <select className="input" value={selectedFaculty} onChange={e => setSelectedFaculty(e.target.value)}>
                                {faculties.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="input-group">
                        <label>Class</label>
                        <select className="input" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                            <option value="">All classes</option>
                            {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Exam Selection */}
            <div className="card mb-md">
                <div className="flex items-center justify-between mb-sm">
                    <h3 style={{ fontWeight: 700 }}>Select Exam</h3>
                    {selectedExam && (
                        <button className="btn btn-secondary btn-sm" onClick={readAnalytics}>
                            <i className="fa-solid fa-volume-high" aria-hidden="true"></i> Read Analytics
                        </button>
                    )}
                </div>
                <div className="section-tabs">
                    {filteredExams.map((exam) => (
                        <button
                            key={exam._id}
                            className={`section-tab ${selectedExam === exam._id ? 'active' : ''}`}
                            onClick={() => selectExam(exam._id)}
                        >
                            {exam.title}
                        </button>
                    ))}
                    {filteredExams.length === 0 && (
                        <div className="text-muted" style={{ padding: '8px 0' }}>No exams for selected filters.</div>
                    )}
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
                    <h3 style={{ fontWeight: 700, marginTop: 32, marginBottom: 16 }}><i className="fa-solid fa-rectangle-list" aria-hidden="true"></i> Student Results</h3>
                    <div className="flex items-center justify-between mb-sm">
                        <div className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
                        </div>
                        <button className="btn btn-sm btn-secondary" onClick={() => selectExam(selectedExam)}>
                            <i className="fa-solid fa-rotate-right" aria-hidden="true"></i> Refresh Results
                        </button>
                    </div>

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
                                    <th>Details</th>
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
                                                        <i className="fa-solid fa-clipboard-list" aria-hidden="true"></i> Logs
                                                    </button>
                                                    <button className="btn btn-sm btn-primary" onClick={() => downloadPDF(r.studentId)}>
                                                        <i className="fa-solid fa-file-pdf" aria-hidden="true"></i> PDF
                                                    </button>
                                                </div>
                                            </td>
                                            <td>
                                                <button className="btn btn-sm btn-info" onClick={() => viewDetails(r.details)} disabled={!r.details}>
                                                    <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Details
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {results.length === 0 && (
                                    <tr><td colSpan="10" className="text-center text-muted" style={{ padding: 40 }}>No results yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Answer Details */}
                    {selectedDetails && (
                        <div className="card mt-lg">
                            <div className="flex items-center justify-between mb-md">
                                <h3 style={{ fontWeight: 700 }}>
                                    <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Answer Details
                                </h3>
                                <button className="btn btn-secondary btn-sm" onClick={readStudentDetails}>
                                    <i className="fa-solid fa-volume-high" aria-hidden="true"></i> Read Details
                                </button>
                            </div>
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Status</th>
                                            <th>Feedback</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedDetails.map((d, idx) => (
                                            <tr key={idx}>
                                                <td>{idx + 1}</td>
                                                <td>{d.isCorrect ? <><i className="fa-solid fa-circle-check" aria-hidden="true"></i> Correct</> : d.isCorrect === false ? <><i className="fa-solid fa-circle-xmark" aria-hidden="true"></i> Incorrect</> : '–'}</td>
                                                <td>{d.teacherFeedback || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Activity Logs */}
                    {selectedStudent && logs.length > 0 && (
                        <div className="card mt-lg">
                            <div className="flex items-center justify-between mb-md">
                                <h3 style={{ fontWeight: 700 }}>
                                    <i className="fa-solid fa-clipboard-list" aria-hidden="true"></i> Activity Logs — Student: {selectedStudent}
                                </h3>
                                <button className="btn btn-secondary btn-sm" onClick={readLogs}>
                                    <i className="fa-solid fa-volume-high" aria-hidden="true"></i> Read Logs
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
    );
}

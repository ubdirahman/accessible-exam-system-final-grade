import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTTS } from '../hooks/useTTS';
import api from '../api/axios';

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { speak } = useTTS();
    const [exams, setExams] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showStudentForm, setShowStudentForm] = useState(false);
    const [newStudent, setNewStudent] = useState({ name: '', studentId: '', email: '' });

    useEffect(() => {
        loadData();
    }, []);

    const readSummary = () => {
        const activeExams = exams.filter(e => e.active);
        const takenExamsCount = exams.reduce((sum, e) => sum + (e.examCodes?.filter(c => c.used).length || 0), 0);

        let text = `System Overview. You have ${exams.length} exams in the database. `;

        if (activeExams.length > 0) {
            text += `${activeExams.length} exams are currently active and ready for students. `;
            text += `The active exams are: ` + activeExams.map(e => e.title).join(", ") + ". ";
        } else {
            text += `There are no active exams at the moment. `;
        }

        text += `A total of ${students.length} students are registered in the system. `;
        text += `So far, ${takenExamsCount} exam attempts have been recorded. `;

        speak(text);
    };

    const readStudentList = () => {
        if (students.length === 0) {
            speak("There are no students registered in the database.");
            return;
        }

        let text = `Listing all ${students.length} registered students. `;
        students.forEach((s, i) => {
            text += `Student ${i + 1}: ${s.name}, ID ${s.studentId}. `;
            if (s.examCodes && s.examCodes.length > 0) {
                text += `Has taken ${s.examCodes.length} exams. `;
            }
        });

        speak(text);
    };

    const [error, setError] = useState(null);

    const loadData = async () => {
        try {
            setError(null);
            console.log('Fetching admin dashboard data...');
            const [examsRes, studentsRes] = await Promise.all([
                api.get('/exams'),
                api.get('/exams/students')
            ]);
            console.log('Exams received:', examsRes.data);
            console.log('Students received:', studentsRes.data);
            setExams(examsRes.data);
            setStudents(studentsRes.data);
        } catch (err) {
            console.error('Load data error:', err);
            setError(err.message || 'Failed to connect to backend server');
        } finally {
            setLoading(false);
        }
    };

    const toggleExamActive = async (examId, active) => {
        try {
            await api.put(`/exams/${examId}`, { active: !active });
            loadData();
        } catch (err) {
            console.error('Toggle error:', err);
        }
    };

    const deleteExam = async (examId) => {
        if (!confirm('Delete this exam and all related data?')) return;
        try {
            await api.delete(`/exams/${examId}`);
            loadData();
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const generateCodes = async (examId) => {
        try {
            const res = await api.post(`/exams/${examId}/generate-codes`, { count: 5, expiryHours: 48 });
            alert(`Generated codes:\n${res.data.codes.map(c => c.code).join('\n')}`);
            loadData();
        } catch (err) {
            console.error('Generate codes error:', err);
        }
    };

    const addStudent = async (e) => {
        e.preventDefault();
        try {
            await api.post('/exams/students', newStudent);
            setNewStudent({ name: '', studentId: '', email: '' });
            setShowStudentForm(false);
            loadData();
        } catch (err) {
            alert(err.response?.data?.message || 'Error adding student');
        }
    };

    const deleteStudent = async (studentId) => {
        if (!confirm('Delete this student?')) return;
        try {
            await api.delete(`/exams/students/${studentId}`);
            loadData();
        } catch (err) {
            console.error('Delete student error:', err);
        }
    };

    if (loading) {
        return (
            <div className="loading-page">
                <div className="spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="app-container">
                {/* Navbar */}
                <div className="navbar" style={{ position: 'relative', borderRadius: 'var(--radius)', marginBottom: 32 }}>
                    <div className="navbar-brand">
                        <span className="icon">🛡️</span>
                        Admin Dashboard
                    </div>
                    <div className="navbar-actions">
                        <span className="badge badge-info">👤 {user?.name} ({user?.role})</span>
                        {error && <span className="badge badge-danger">⚠️ {error}</span>}
                        <button className="btn btn-secondary btn-sm" onClick={readSummary}>
                            🔊 Read Summary
                        </button>
                        <Link to="/admin/create-exam" className="btn btn-primary btn-sm">
                            ➕ Create Exam
                        </Link>
                        <Link to="/admin/reports" className="btn btn-secondary btn-sm">
                            📊 Reports
                        </Link>
                        <button className="btn btn-secondary btn-sm" onClick={() => { logout(); navigate('/'); }}>
                            Logout
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-value">{exams.length}</div>
                        <div className="stat-label">Total Exams</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{exams.filter(e => e.active).length}</div>
                        <div className="stat-label">Active Exams</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{students.length}</div>
                        <div className="stat-label">Registered Students</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">
                            {exams.reduce((sum, e) => sum + (e.examCodes?.filter(c => c.used).length || 0), 0)}
                        </div>
                        <div className="stat-label">Exams Taken</div>
                    </div>
                </div>

                {/* Exams */}
                <h2 style={{ fontWeight: 700, marginBottom: 16, marginTop: 32 }}>📝 Exams</h2>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Time (min)</th>
                                <th>Status</th>
                                <th>Codes</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exams.map((exam) => (
                                <tr key={exam._id}>
                                    <td style={{ fontWeight: 600 }}>{exam.title}</td>
                                    <td>{exam.timeLimit}</td>
                                    <td>
                                        <span className={`badge ${exam.active ? 'badge-success' : 'badge-danger'}`}>
                                            {exam.active ? '🟢 Active' : '🔴 Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        {exam.examCodes?.filter(c => !c.used).length || 0} available / {exam.examCodes?.length || 0} total
                                    </td>
                                    <td>
                                        <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                            <button className="btn btn-sm btn-secondary" onClick={() => toggleExamActive(exam._id, exam.active)}>
                                                {exam.active ? '⏸️ Deactivate' : '▶️ Activate'}
                                            </button>
                                            <button className="btn btn-sm btn-primary" onClick={() => generateCodes(exam._id)}>
                                                🔑 Gen Codes
                                            </button>
                                            <button className="btn btn-sm btn-danger" onClick={() => deleteExam(exam._id)}>
                                                🗑️ Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {exams.length === 0 && (
                                <tr><td colSpan="5" className="text-center text-muted" style={{ padding: 40 }}>No exams yet. Create one!</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Students */}
                <div className="flex items-center justify-between" style={{ marginTop: 40, marginBottom: 16 }}>
                    <h2 style={{ fontWeight: 700 }}>🎓 Students</h2>
                    <div className="flex gap-sm">
                        <button className="btn btn-secondary btn-sm" onClick={readStudentList}>
                            🔊 Read Student List
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowStudentForm(!showStudentForm)}>
                            {showStudentForm ? '✖️ Cancel' : '➕ Add Student'}
                        </button>
                    </div>
                </div>

                {showStudentForm && (
                    <div className="card" style={{ marginBottom: 16 }}>
                        <form onSubmit={addStudent} className="flex gap-md" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div className="input-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
                                <label>Name</label>
                                <input className="input" value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} required />
                            </div>
                            <div className="input-group" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
                                <label>Student ID</label>
                                <input className="input" value={newStudent.studentId} onChange={e => setNewStudent({ ...newStudent, studentId: e.target.value })} required />
                            </div>
                            <div className="input-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
                                <label>Email</label>
                                <input className="input" type="email" value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} />
                            </div>
                            <button type="submit" className="btn btn-success">Save</button>
                        </form>
                    </div>
                )}

                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Student ID</th>
                                <th>Email</th>
                                <th>Exams Taken</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((s) => (
                                <tr key={s._id}>
                                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                                    <td>{s.studentId}</td>
                                    <td>{s.email || '—'}</td>
                                    <td>{s.examCodes?.length || 0}</td>
                                    <td>
                                        <button className="btn btn-sm btn-danger" onClick={() => deleteStudent(s.studentId)}>
                                            🗑️ Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {students.length === 0 && (
                                <tr><td colSpan="5" className="text-center text-muted" style={{ padding: 40 }}>No students registered.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTTS } from '../hooks/useTTS';
import api from '../api/axios';

export default function AdminExams() {
    const { speak } = useTTS();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadExams();
    }, []);

    const loadExams = async () => {
        try {
            setLoading(true);
            const res = await api.get('/exams');
            setExams(res.data);
        } catch (err) {
            setError('Failed to load exams.');
        } finally {
            setLoading(false);
        }
    };

    const toggleExamActive = async (examId, active) => {
        try {
            await api.put(`/exams/${examId}`, { active: !active });
            loadExams();
        } catch (err) {
            console.error('Toggle error:', err);
        }
    };

    const deleteExam = async (examId) => {
        if (!confirm('Delete this exam and all related data?')) return;
        try {
            await api.delete(`/exams/${examId}`);
            loadExams();
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const generateCodes = async (examId) => {
        try {
            const res = await api.post(`/exams/${examId}/generate-codes`, { count: 5, expiryHours: 48 });
            alert(`Generated codes:\n${res.data.codes.map(c => c.code).join('\n')}`);
            loadExams();
        } catch (err) {
            console.error('Generate codes error:', err);
        }
    };

    if (loading) return <div className="spinner"></div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-md">
                <h2 style={{ fontWeight: 700 }}>📝 List of Exams</h2>
                <Link to="/admin/create-exam" className="btn btn-primary btn-sm">
                    ➕ Add Exam
                </Link>
            </div>

            {error && <div className="badge badge-danger mb-md">{error}</div>}

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
                                            {exam.active ? '⏸️' : '▶️'}
                                        </button>
                                        <button className="btn btn-sm btn-primary" onClick={() => generateCodes(exam._id)}>
                                            🔑 Codes
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={() => deleteExam(exam._id)}>
                                            🗑️
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {exams.length === 0 && (
                            <tr><td colSpan="5" className="text-center text-muted" style={{ padding: 40 }}>No exams yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

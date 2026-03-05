import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

export default function TeacherExams() {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadExams();
    }, []);

    const loadExams = async () => {
        try {
            setLoading(true);
            const res = await api.get('/exams/my');
            setExams(res.data);
        } catch (err) {
            setError('Failed to load exams.');
        } finally {
            setLoading(false);
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

    if (loading) return <div className="spinner"></div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-md">
                <h2 style={{ fontWeight: 700 }}><i className="fa-solid fa-clipboard-list" aria-hidden="true"></i> Your Exams</h2>
                <Link to="/teacher/create-exam" className="btn btn-primary btn-sm">
                    <i className="fa-solid fa-plus" aria-hidden="true"></i> Add Exam
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
                                        <i className={`fa-solid ${exam.active ? 'fa-circle-check' : 'fa-circle-xmark'}`} aria-hidden="true"></i> {exam.active ? 'Active' : 'Inactive (admin only)'}
                                    </span>
                                </td>
                                <td>
                                    {exam.examCodes?.filter(c => !c.used).length || 0} available / {exam.examCodes?.length || 0} total
                                </td>
                                <td>
                                    <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                        <Link to={`/teacher/exams/${exam._id}/responses`} className="btn btn-sm btn-info">
                                            <i className="fa-solid fa-clipboard-question" aria-hidden="true"></i> Responses
                                        </Link>
                                        <button className="btn btn-sm btn-danger" onClick={() => deleteExam(exam._id)}>
                                            <i className="fa-solid fa-trash" aria-hidden="true"></i>
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

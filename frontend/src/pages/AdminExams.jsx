import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTTS } from '../hooks/useTTS';
import api from '../api/axios';

export default function AdminExams() {
    const { speak } = useTTS();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [analytics, setAnalytics] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ title: '', timeLimit: 60, description: '', active: false });

    useEffect(() => {
        loadExams();
    }, []);

    const loadExams = async () => {
        try {
            setLoading(true);
            const res = await api.get('/exams');
            setExams(res.data);
            fetchAnalytics(res.data);
        } catch (err) {
            setError('Failed to load exams.');
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalytics = async (examList) => {
        const entries = await Promise.all(examList.map(async (exam) => {
            try {
                const res = await api.get(`/results/analytics/${exam._id}`);
                return [exam._id, res.data];
            } catch (e) {
                console.error('Analytics error', exam._id, e.message);
                return null;
            }
        }));
        const map = {};
        entries.filter(Boolean).forEach(([id, data]) => { map[id] = data; });
        setAnalytics(map);
    };

    const toggleExamActive = async (examId, active) => {
        try {
            await api.patch(`/exams/${examId}/active`, { active: !active });
            loadExams();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to change active status.');
        }
    };

    const startEdit = (exam) => {
        setEditingId(exam._id);
        setEditForm({
            title: exam.title,
            timeLimit: exam.timeLimit,
            description: exam.description || '',
            active: exam.active
        });
    };

    const saveEdit = async () => {
        try {
            await api.put(`/exams/${editingId}`, {
                title: editForm.title,
                description: editForm.description,
                timeLimit: Number(editForm.timeLimit),
                active: editForm.active
            });
            setEditingId(null);
            loadExams();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save exam.');
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
                <h2 style={{ fontWeight: 700 }}><i className="fa-solid fa-clipboard-list" aria-hidden="true"></i> List of Exams</h2>
                <Link to="/admin/create-exam" className="btn btn-primary btn-sm">
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
                            <th>Description</th>
                            <th>Students</th>
                            <th>Status</th>
                            <th>Codes</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {exams.map((exam) => (
                            <tr key={exam._id}>
                                <td style={{ fontWeight: 600 }}>
                                    {editingId === exam._id
                                        ? <input className="input" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                                        : exam.title}
                                </td>
                                <td>
                                    {editingId === exam._id
                                        ? <input className="input" type="number" min={1} value={editForm.timeLimit} onChange={e => setEditForm({ ...editForm, timeLimit: e.target.value })} />
                                        : exam.timeLimit}
                                </td>
                                <td style={{ maxWidth: 220 }}>
                                    {editingId === exam._id
                                        ? <input className="input" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                                        : (exam.description || '—')}
                                </td>
                                <td>
                                    <span className="badge badge-info">
                                        {analytics[exam._id]?.participants ?? 0} started / {analytics[exam._id]?.finishedCount ?? 0} finished
                                    </span>
                                </td>
                                <td>
                                    <span className={`badge ${exam.active ? 'badge-success' : 'badge-danger'}`}>
                                        <i className={`fa-solid ${exam.active ? 'fa-circle-check' : 'fa-circle-xmark'}`} aria-hidden="true"></i> {exam.active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td>
                                    {exam.examCodes?.filter(c => !c.used).length || 0} available / {exam.examCodes?.length || 0} total
                                </td>
                                <td>
                                    <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                        {editingId === exam._id ? (
                                            <>
                                                <button className="btn btn-sm btn-success" onClick={saveEdit}><i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save</button>
                                                <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}><i className="fa-solid fa-circle-xmark" aria-hidden="true"></i> Cancel</button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="btn btn-sm btn-secondary" onClick={() => toggleExamActive(exam._id, exam.active)}>
                                                    <i className={`fa-solid ${exam.active ? 'fa-pause' : 'fa-play'}`} aria-hidden="true"></i>
                                                </button>
                                                <button className="btn btn-sm btn-primary" onClick={() => generateCodes(exam._id)}>
                                                    <i className="fa-solid fa-key" aria-hidden="true"></i> Codes
                                                </button>
                                                <button className="btn btn-sm btn-info" onClick={() => startEdit(exam)}><i className="fa-solid fa-pen" aria-hidden="true"></i> Edit</button>
                                                <Link to={`/admin/exams/${exam._id}/responses`} className="btn btn-sm btn-info">
                                                    <i className="fa-solid fa-clipboard-question" aria-hidden="true"></i> Responses
                                                </Link>
                                                <button className="btn btn-sm btn-danger" onClick={() => deleteExam(exam._id)}>
                                                    <i className="fa-solid fa-trash" aria-hidden="true"></i>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {exams.length === 0 && (
                            <tr><td colSpan="7" className="text-center text-muted" style={{ padding: 40 }}>No exams yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

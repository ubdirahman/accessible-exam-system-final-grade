import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTTS } from '../hooks/useTTS';
import api from '../api/axios';
import SearchInput from '../components/SearchInput';
import { matchesSearchQuery } from '../utils/search';
import useConfirmDialog from '../hooks/useConfirmDialog';

export default function AdminExams() {
    const { speak } = useTTS();
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [analytics, setAnalytics] = useState({});
    
    // UI States
    const [selectedExam, setSelectedExam] = useState(null); // For Detail Modal
    const [searchTerm, setSearchTerm] = useState('');

    const { confirmDialog, askConfirm } = useConfirmDialog();

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

    const deleteExam = async (examId, title) => {
        const confirmed = await askConfirm({
            title: 'Delete Exam?',
            message: `"${title}" and all related responses, results, and recordings will be permanently deleted.`,
            confirmText: 'Yes, Delete',
            type: 'danger'
        });
        if (!confirmed) return;

        // Optimistic update
        const prev = [...exams];
        setExams(e => e.filter(x => x._id !== examId));
        try {
            await api.delete(`/exams/${examId}`);
        } catch (err) {
            console.error('Delete error:', err);
            setExams(prev); // Restore on error
            setError('Failed to delete exam.');
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

    const filteredExams = exams.filter((exam) => matchesSearchQuery(
        searchTerm,
        exam.title,
        exam.subjectId?.name,
        exam.subjectId?.teacherId?.name,
        exam.createdBy?.name,
        exam._id,
        exam.timeLimit,
        exam.active ? 'active' : 'inactive'
    ));

    if (loading) return <div className="spinner"></div>;

    return (
        <div className="fade-in">
            {confirmDialog}
            <div className="flex items-center justify-between mb-lg">
                <div>
                    <h1 style={{ fontWeight: 800 }}>Examinations</h1>
                    <p className="text-muted">Manage academic exams and sessions.</p>
                </div>
                <Link to="/admin/create-exam" className="btn btn-primary">
                    <i className="fa-solid fa-plus"></i> Add New Exam
                </Link>
            </div>

            {error && <div className="badge badge-danger mb-md">{error}</div>}

            {/* Detail Modal */}
            {selectedExam && (
                <div className="modal-overlay" onClick={() => setSelectedExam(null)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div className="modal-header">
                            <h2 style={{ fontWeight: 800 }}>{selectedExam.title}</h2>
                            <button className="btn btn-ghost" onClick={() => setSelectedExam(null)}><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        <div className="modal-body">
                            <div className="grid-2 mb-md">
                                <div className="info-item">
                                    <label>Subject</label>
                                    <div className="value">{selectedExam.subjectId?.name || 'Manual Entry'}</div>
                                </div>
                                <div className="info-item">
                                    <label>Instructor</label>
                                    <div className="value">{selectedExam.subjectId?.teacherId?.name || selectedExam.createdBy?.name || 'Administrator'}</div>
                                </div>
                                <div className="info-item">
                                    <label>Duration</label>
                                    <div className="value">{selectedExam.timeLimit} Minutes</div>
                                </div>
                                <div className="info-item">
                                    <label>Status</label>
                                    <div className={`value ${selectedExam.active ? 'text-success' : 'text-danger'}`}>
                                        {selectedExam.active ? 'Accepting Responses' : 'Hidden / Closed'}
                                    </div>
                                </div>
                            </div>
                            <div className="mb-md">
                                <label>Description</label>
                                <p className="text-muted" style={{ lineHeight: 1.6 }}>{selectedExam.description || 'No description provided.'}</p>
                            </div>
                            <div className="card bg-secondary mb-md">
                                <h4 className="mb-xs">Quick Stats</h4>
                                <div className="flex justify-between">
                                    <span>Started: <strong>{analytics[selectedExam._id]?.participants ?? 0}</strong></span>
                                    <span>Finished: <strong>{analytics[selectedExam._id]?.finishedCount ?? 0}</strong></span>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer flex gap-sm">
                            <button className="btn btn-primary flex-1" onClick={() => navigate(`/admin/exams/edit/${selectedExam._id}`)}>
                                <i className="fa-solid fa-pen-to-square"></i> Full Edit
                            </button>
                            <Link to={`/admin/exams/${selectedExam._id}/responses`} className="btn btn-info flex-1">
                                <i className="fa-solid fa-clipboard-question"></i> Responses
                            </Link>
                            <button className="btn btn-secondary" onClick={() => setSelectedExam(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="table-wrapper card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)' }}>
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Search exams by title, subject, teacher, status, or ID"
                    />
                </div>
                <table>
                    <thead style={{ background: 'var(--bg-secondary)' }}>
                        <tr>
                            <th style={{ paddingLeft: 24 }}>Subject & Teacher</th>
                            <th>Exam Title</th>
                            <th>Time</th>
                            <th>Status</th>
                            <th style={{ paddingRight: 24 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredExams.map((exam) => (
                            <tr key={exam._id}>
                                <td style={{ paddingLeft: 24 }}>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{exam.subjectId?.name || '—'}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{exam.subjectId?.teacherId?.name || exam.createdBy?.name || 'Admin'}</div>
                                </td>
                                <td>
                                    <div style={{ fontWeight: 600 }}>{exam.title}</div>
                                </td>
                                <td>
                                    <span>{exam.timeLimit}m</span>
                                </td>
                                <td>
                                    <span className={`badge ${exam.active ? 'badge-success' : 'badge-danger'}`}>
                                        {exam.active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td style={{ paddingRight: 24 }}>
                                    <div className="flex gap-sm">
                                        <button className="btn btn-sm btn-info" onClick={() => setSelectedExam(exam)}>
                                            <i className="fa-solid fa-eye"></i> View
                                        </button>
                                        <button className="btn btn-sm btn-info" onClick={() => navigate(`/admin/exams/${exam._id}/responses`)}>
                                            <i className="fa-solid fa-list"></i> Responses
                                        </button>
                                        <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/admin/exams/edit/${exam._id}`)}>
                                            <i className="fa-solid fa-pen"></i> Edit
                                        </button>
                                        <button className="btn btn-sm btn-secondary" onClick={() => toggleExamActive(exam._id, exam.active)}>
                                            <i className={`fa-solid ${exam.active ? 'fa-pause' : 'fa-play'}`}></i>
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={() => deleteExam(exam._id, exam.title)}>
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredExams.length === 0 && (
                            <tr><td colSpan="6" className="text-center text-muted" style={{ padding: 60 }}>No examinations found. Create one to get started.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import SearchInput from '../components/SearchInput';
import { matchesSearchQuery } from '../utils/search';
import useConfirmDialog from '../hooks/useConfirmDialog';

export default function TeacherExams() {
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
            const res = await api.get('/exams/my');
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
            setExams(prev);
            setError('Failed to delete exam.');
        }
    };

    const filteredExams = exams.filter((exam) => matchesSearchQuery(
        searchTerm,
        exam.title,
        exam.subjectId?.name,
        exam.subjectId?.teacherId?.name,
        exam._id,
        exam.timeLimit,
        exam.active ? 'active' : 'hidden'
    ));

    if (loading) return <div className="spinner"></div>;

    return (
        <div className="fade-in">
            {confirmDialog}
            <div className="flex items-center justify-between mb-lg">
                <div>
                    <h1 style={{ fontWeight: 800 }}>My Examinations</h1>
                    <p className="text-muted">Manage your own exams, monitor students, and view results.</p>
                </div>
                <Link to="/teacher/create-exam" className="btn btn-primary">
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
                                    <div className="value">{selectedExam.subjectId?.teacherId?.name || 'Me'}</div>
                                </div>
                                <div className="info-item">
                                    <label>Duration</label>
                                    <div className="value">{selectedExam.timeLimit} Minutes</div>
                                </div>
                                <div className="info-item">
                                    <label>Status</label>
                                    <div className={`value ${selectedExam.active ? 'text-success' : 'text-danger'}`}>
                                        {selectedExam.active ? 'Accepting Responses' : 'Inactive (admin only)'}
                                    </div>
                                </div>
                            </div>
                            <div className="mb-md">
                                <label>Description</label>
                                <p className="text-muted" style={{ lineHeight: 1.6 }}>{selectedExam.description || 'No description provided.'}</p>
                            </div>
                            <div className="card bg-secondary mb-md">
                                <h4 className="mb-xs">Performance Summary</h4>
                                <div className="flex justify-between">
                                    <span>Participants: <strong>{analytics[selectedExam._id]?.participants ?? 0}</strong></span>
                                    <span>Submissions: <strong>{analytics[selectedExam._id]?.finishedCount ?? 0}</strong></span>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer flex gap-sm">
                            <button className="btn btn-primary flex-1" onClick={() => navigate(`/teacher/exams/edit/${selectedExam._id}`)}>
                                <i className="fa-solid fa-pen-to-square"></i> Full Edit
                            </button>
                            <Link to={`/teacher/exams/${selectedExam._id}/responses`} className="btn btn-info flex-1">
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
                        placeholder="Search exams by title, subject, status, or ID"
                    />
                </div>
                <table>
                    <thead style={{ background: 'var(--bg-secondary)' }}>
                        <tr>
                            <th style={{ paddingLeft: 24 }}>Subject</th>
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
                                    <div style={{ fontWeight: 600 }}>{exam.subjectId?.name || 'Manual'}</div>
                                </td>
                                <td>
                                    <div style={{ fontWeight: 600 }}>{exam.title}</div>
                                </td>
                                <td>{exam.timeLimit}m</td>
                                <td>
                                    <span className={`badge ${exam.active ? 'badge-success' : 'badge-danger'}`}>
                                        {exam.active ? 'Active' : 'Hidden'}
                                    </span>
                                </td>
                                <td style={{ paddingRight: 24 }}>
                                    <div className="flex gap-sm">
                                        <button className="btn btn-sm btn-info" onClick={() => setSelectedExam(exam)}>
                                            <i className="fa-solid fa-eye"></i> View
                                        </button>
                                        <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/teacher/exams/edit/${exam._id}`)}>
                                            <i className="fa-solid fa-pen"></i> Edit
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={() => deleteExam(exam._id, exam.title)}>
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredExams.length === 0 && (
                            <tr><td colSpan="5" className="text-center text-muted" style={{ padding: 60 }}>You haven't created any exams yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

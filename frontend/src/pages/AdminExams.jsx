import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTTS } from '../hooks/useTTS';
import api from '../api/axios';
import SearchInput from '../components/SearchInput';
import { matchesSearchQuery } from '../utils/search';
import useConfirmDialog from '../hooks/useConfirmDialog';
import { useAuth } from '../context/AuthContext';

export default function AdminExams() {
    const { speak } = useTTS();
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [analytics, setAnalytics] = useState({});
    
    // UI States
    const [selectedExam, setSelectedExam] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const { confirmDialog, askConfirm } = useConfirmDialog();
    const { user } = useAuth();
    const isSuper = user?.role === 'super_admin';

    // Import modal states
    const [showImportModal, setShowImportModal] = useState(false);
    const [importTab, setImportTab] = useState('file'); // 'file' | 'json'

    // File import states
    const [importFile, setImportFile] = useState(null);
    const [importDragging, setImportDragging] = useState(false);
    const [importFileLoading, setImportFileLoading] = useState(false);
    const fileInputRef = useRef(null);

    // JSON import states
    const [importJson, setImportJson] = useState('');
    const [importError, setImportError] = useState(null);
    const [importSuccess, setImportSuccess] = useState(null);

    // Dropdowns for association
    const [faculties, setFaculties] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState(user?.facultyId || '');
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState('');

    const ACCEPTED_TYPES = '.xlsx,.xls,.docx,.doc,.pdf';

    const resetModal = () => {
        setImportFile(null);
        setImportJson('');
        setImportError(null);
        setImportSuccess(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileDrop = (e) => {
        e.preventDefault();
        setImportDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) { setImportFile(file); setImportError(null); setImportSuccess(null); }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) { setImportFile(file); setImportError(null); setImportSuccess(null); }
    };

    // File-based exam import (Excel/Word/PDF → JSON parsed server-side)
    const handleImportExamFile = async (e) => {
        e.preventDefault();
        if (!importFile) return setImportError('Please select a file first.');
        if (!selectedClass) return setImportError('Please select a class for the exam.');
        setImportFileLoading(true);
        setImportError(null);
        setImportSuccess(null);

        const formData = new FormData();
        formData.append('file', importFile);
        formData.append('classId', selectedClass);
        if (selectedSubject) formData.append('subjectId', selectedSubject);
        if (isSuper) formData.append('facultyId', selectedFaculty);

        try {
            const res = await api.post('/exams/import-file', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportSuccess(`Exam "${res.data.exam?.title || ''}" imported successfully!`);
            setImportFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            loadExams();
            setTimeout(() => { setShowImportModal(false); resetModal(); }, 2000);
        } catch (err) {
            setImportError(err.response?.data?.message || 'Error importing exam file.');
        } finally {
            setImportFileLoading(false);
        }
    };

    const handleImportExam = async (e) => {
        e.preventDefault();
        setImportError(null);
        setImportSuccess(null);
        
        if (!importJson.trim()) return setImportError('Please enter some JSON to import.');
        if (!selectedClass) return setImportError('Please select a class for the exam.');
        
        let parsed = null;
        try {
            parsed = JSON.parse(importJson.trim());
        } catch (err) {
            return setImportError('Invalid JSON format. Please verify syntax.');
        }
        
        if (!parsed.title) return setImportError('Exam JSON must have a "title" field.');
        if (parsed.timeLimit === undefined) return setImportError('Exam JSON must have a "timeLimit" field.');
        
        const payload = {
            ...parsed,
            classId: selectedClass,
            subjectId: selectedSubject || null,
            active: false
        };
        
        try {
            await api.post('/exams', payload);
            setImportSuccess('Exam successfully imported!');
            setImportJson('');
            loadExams();
            setTimeout(() => {
                setShowImportModal(false);
                setImportSuccess(null);
            }, 1500);
        } catch (err) {
            setImportError(err.response?.data?.message || 'Error importing exam to database.');
        }
    };


    const loadFaculties = async () => {
        if (!isSuper) return;
        try {
            const res = await api.get('/faculties');
            setFaculties(res.data);
            if (res.data.length > 0 && !selectedFaculty) setSelectedFaculty(res.data[0]._id);
        } catch (e) { console.error(e); }
    };
    
    const loadClassesAndSubjects = async (fid) => {
        if (!fid) return;
        try {
            const [clsRes, subjRes] = await Promise.all([
                api.get('/classes', { params: { facultyId: fid } }),
                api.get('/subjects', { params: { facultyId: fid } })
            ]);
            setClasses(clsRes.data);
            setSubjects(subjRes.data);
            if (clsRes.data.length > 0) setSelectedClass(clsRes.data[0]._id);
            if (subjRes.data.length > 0) setSelectedSubject(subjRes.data[0]._id);
        } catch (e) { console.error(e); }
    };
    
    useEffect(() => {
        if (showImportModal) {
            loadFaculties();
            const fid = isSuper ? selectedFaculty : user?.facultyId;
            loadClassesAndSubjects(fid);
        }
    }, [showImportModal, selectedFaculty]);

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
                <div className="flex gap-sm">
                    <button className="btn btn-secondary btn-sm" onClick={() => { setShowImportModal(true); setImportError(null); setImportSuccess(null); }}>
                        <i className="fa-solid fa-file-import"></i> Import Exam
                    </button>
                    <Link to="/admin/create-exam" className="btn btn-primary btn-sm">
                        <i className="fa-solid fa-plus"></i> Add New Exam
                    </Link>
                </div>
            </div>

            {error && <div className="badge badge-danger mb-md">{error}</div>}            
            
            {/* Import Exam Modal */}
            {showImportModal && (
                <div className="modal-overlay" onClick={() => { setShowImportModal(false); resetModal(); }}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 660 }}>
                        <div className="modal-header">
                            <h2 style={{ fontWeight: 800 }}>Import Exam</h2>
                            <button className="btn btn-ghost" onClick={() => { setShowImportModal(false); resetModal(); }}>
                                <i className="fa-solid fa-xmark" />
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* Tab switcher */}
                            <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
                                {[
                                    { key: 'file', icon: 'fa-file-arrow-up', label: 'Upload File' },
                                    { key: 'json', icon: 'fa-code', label: 'Paste JSON' }
                                ].map(t => (
                                    <button
                                        key={t.key}
                                        type="button"
                                        onClick={() => { setImportTab(t.key); setImportError(null); setImportSuccess(null); }}
                                        style={{
                                            flex: 1, padding: '10px 0', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
                                            background: importTab === t.key ? 'var(--primary)' : 'var(--bg-secondary)',
                                            color: importTab === t.key ? '#fff' : 'var(--text-muted)',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <i className={`fa-solid ${t.icon}`} style={{ marginRight: 7 }} />{t.label}
                                    </button>
                                ))}
                            </div>

                            {/* Shared dropdowns */}
                            <div className="grid-2 mb-md gap-sm">
                                {isSuper && (
                                    <div className="input-group">
                                        <label>Faculty</label>
                                        <select className="select" value={selectedFaculty} onChange={e => setSelectedFaculty(e.target.value)}>
                                            {faculties.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="input-group">
                                    <label>Classroom <span style={{ color: '#dc2626' }}>*</span></label>
                                    <select className="select" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} required>
                                        <option value="">-- Select Class --</option>
                                        {classes.map(c => <option key={c._id} value={c._id}>{c.name} ({c.code})</option>)}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label>Subject (Optional)</label>
                                    <select className="select" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                                        <option value="">-- Select Subject --</option>
                                        {subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* ---- FILE TAB ---- */}
                            {importTab === 'file' && (
                                <form onSubmit={handleImportExamFile}>
                                    <p className="text-muted mb-sm" style={{ fontSize: 13 }}>
                                        Upload an Excel, Word, or PDF file with your exam questions.
                                        The file must follow the supported format.
                                    </p>

                                    {/* Drag & Drop Zone */}
                                    <div
                                        onDragOver={(e) => { e.preventDefault(); setImportDragging(true); }}
                                        onDragLeave={() => setImportDragging(false)}
                                        onDrop={handleFileDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{
                                            border: `2px dashed ${importDragging ? 'var(--primary)' : 'var(--border-color)'}`,
                                            borderRadius: 12,
                                            padding: '30px 20px',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            background: importDragging ? 'rgba(99,102,241,0.06)' : 'var(--bg-secondary)',
                                            transition: 'all 0.2s',
                                            marginBottom: 14
                                        }}
                                    >
                                        <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} style={{ display: 'none' }} onChange={handleFileSelect} />
                                        {importFile ? (
                                            <div>
                                                <div style={{ fontSize: 36, marginBottom: 6 }}>
                                                    {importFile.name.endsWith('.pdf') ? '📄' : importFile.name.endsWith('.docx') || importFile.name.endsWith('.doc') ? '📝' : '📊'}
                                                </div>
                                                <div style={{ fontWeight: 700, fontSize: 14 }}>{importFile.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                                    {(importFile.size / 1024).toFixed(1)} KB — Click to change
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ fontSize: 36, opacity: 0.4, marginBottom: 8 }}>📂</div>
                                                <div style={{ fontWeight: 600, fontSize: 14 }}>Drag & drop your exam file here</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                                                    or <span style={{ color: 'var(--primary)', fontWeight: 600 }}>click to browse</span>
                                                </div>
                                                <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center' }}>
                                                    {['Excel .xlsx', 'Word .docx', 'PDF .pdf'].map(t => (
                                                        <span key={t} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 20, padding: '2px 10px', fontSize: 11, color: 'var(--text-muted)' }}>{t}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {importError && <div className="badge badge-danger mb-sm">{importError}</div>}
                                    {importSuccess && <div className="badge badge-success mb-sm"><i className="fa-solid fa-check-circle" style={{ marginRight: 6 }} />{importSuccess}</div>}

                                    <div className="modal-footer flex gap-sm" style={{ padding: 0, marginTop: 8 }}>
                                        <button type="submit" className="btn btn-primary flex-1" disabled={!importFile || importFileLoading}>
                                            {importFileLoading ? <><i className="fa-solid fa-spinner fa-spin" /> Importing...</> : <><i className="fa-solid fa-upload" /> Import Exam</>}
                                        </button>
                                        <button type="button" className="btn btn-secondary" onClick={() => { setShowImportModal(false); resetModal(); }}>Cancel</button>
                                    </div>
                                </form>
                            )}

                            {/* ---- JSON TAB ---- */}
                            {importTab === 'json' && (
                                <form onSubmit={handleImportExam}>
                                    <p className="text-muted mb-sm" style={{ fontSize: 13 }}>
                                        Paste the exam JSON structure. Must include <code>title</code> and <code>timeLimit</code>.
                                    </p>
                                    <div className="input-group mb-sm">
                                        <label>Exam JSON Structure</label>
                                        <textarea
                                            className="input"
                                            value={importJson}
                                            onChange={e => setImportJson(e.target.value)}
                                            placeholder={'{\n  "title": "Introduction to Computer Science",\n  "timeLimit": 45,\n  "sections": [...]\n}'}
                                            rows={8}
                                            style={{ fontFamily: 'monospace', fontSize: 12 }}
                                        />
                                    </div>

                                    {importError && <div className="badge badge-danger mb-sm">{importError}</div>}
                                    {importSuccess && <div className="badge badge-success mb-sm">{importSuccess}</div>}

                                    <div className="modal-footer flex gap-sm" style={{ padding: 0, marginTop: 8 }}>
                                        <button type="submit" className="btn btn-primary flex-1">
                                            <i className="fa-solid fa-upload" /> Import Exam
                                        </button>
                                        <button type="button" className="btn btn-secondary" onClick={() => { setShowImportModal(false); resetModal(); }}>Cancel</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}

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

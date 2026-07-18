import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { sanitizeStudentId } from '../utils/studentIdSpeech';
import SearchInput from '../components/SearchInput';
import { matchesSearchQuery } from '../utils/search';
import useConfirmDialog from '../hooks/useConfirmDialog';

// Only allow letters (Latin + Arabic/Somali) and spaces in name fields
const nameOnly = (val) => val.replace(/[^a-zA-Z\s\u0600-\u06FF\-']/g, '');

export default function AdminStudents() {
    const { user } = useAuth();
    const isSuper = user?.role === 'super_admin';

    const [faculties, setFaculties] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState(user?.facultyId || '');
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showStudentForm, setShowStudentForm] = useState(false);
    const [newStudent, setNewStudent] = useState({ name: '', studentId: '', email: '', classId: '' });
    const [error, setError] = useState(null);
    const [touched, setTouched] = useState({});

    // File Import states
    const [showImportForm, setShowImportForm] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importDragging, setImportDragging] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [importError, setImportError] = useState(null);
    const [importLoading, setImportLoading] = useState(false);
    const fileInputRef = useRef(null);

    const [selectedClass, setSelectedClass] = useState(null);
    const [studentLoading, setStudentLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', classId: '' });
    const [classSearchTerm, setClassSearchTerm] = useState('');
    const [studentSearchTerm, setStudentSearchTerm] = useState('');

    const { confirmDialog, askConfirm } = useConfirmDialog();

    const ACCEPTED_TYPES = '.xlsx,.xls,.docx,.doc,.pdf';

    const handleFileDrop = (e) => {
        e.preventDefault();
        setImportDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) { setImportFile(file); setImportError(null); setImportResult(null); }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) { setImportFile(file); setImportError(null); setImportResult(null); }
    };

    const handleImportStudents = async (e) => {
        e.preventDefault();
        if (!importFile) return setImportError('Please select a file first.');
        setImportLoading(true);
        setImportError(null);
        setImportResult(null);

        const formData = new FormData();
        formData.append('file', importFile);
        formData.append('classId', selectedClass._id);
        if (isSuper) formData.append('facultyId', selectedFaculty);

        try {
            const res = await api.post('/exams/students/import-file', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportResult(res.data);
            setImportFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            loadStudents(selectedClass._id);
        } catch (err) {
            setImportError(err.response?.data?.message || 'Error importing file.');
        } finally {
            setImportLoading(false);
        }
    };



    const loadFaculties = async () => {
        if (!isSuper) return;
        try {
            const res = await api.get('/faculties');
            setFaculties(res.data);
            if (!selectedFaculty && res.data.length > 0) setSelectedFaculty(res.data[0]._id);
        } catch (err) {
            setError('Failed to load faculties.');
        }
    };

    const loadClasses = async (facultyId) => {
        if (!facultyId) return;
        try {
            setLoading(true);
            const res = await api.get('/classes', { params: { facultyId } });
            setClasses(res.data);
        } catch (err) {
            setError('Failed to load classes.');
        } finally {
            setLoading(false);
        }
    };

    const loadStudents = async (classId) => {
        if (!classId) return;
        try {
            setStudentLoading(true);
            const fid = isSuper ? selectedFaculty : user?.facultyId;
            const res = await api.get('/exams/students', { params: { facultyId: fid, classId } });
            setStudents(res.data);
        } catch (err) {
            setError('Failed to load students.');
        } finally {
            setStudentLoading(false);
        }
    };

    useEffect(() => { loadFaculties(); }, []);

    useEffect(() => {
        const fid = isSuper ? selectedFaculty : user?.facultyId;
        if (fid) {
            loadClasses(fid);
            setSelectedClass(null);
        }
    }, [selectedFaculty, isSuper, user?.facultyId]);

    useEffect(() => {
        if (selectedClass) loadStudents(selectedClass._id);
    }, [selectedClass]);

    // Form validation
    const formErrors = {
        name: !newStudent.name?.trim(),
        studentId: !newStudent.studentId?.trim()
    };
    const showFormError = (field) => touched[field] && formErrors[field];

    const addStudent = async (e) => {
        e.preventDefault();
        setTouched({ name: true, studentId: true });
        if (Object.values(formErrors).some(Boolean)) return;
        try {
            const facultyId = isSuper ? selectedFaculty : user?.facultyId;
            const cleanStudentId = sanitizeStudentId(newStudent.studentId);
            if (!cleanStudentId) {
                setTouched(p => ({ ...p, studentId: true }));
                return;
            }
            const payload = { ...newStudent, studentId: cleanStudentId, classId: selectedClass._id, facultyId };
            await api.post('/exams/students', payload);
            setNewStudent({ name: '', studentId: '', email: '', classId: '' });
            setShowStudentForm(false);
            setTouched({});
            loadStudents(selectedClass._id);
        } catch (err) {
            setError(err.response?.data?.message || 'Error adding student');
        }
    };

    const deleteStudent = async (studentId, studentName) => {
        const confirmed = await askConfirm({
            title: 'Delete Student?',
            message: `"${studentName}" (ID: ${studentId}) will be permanently removed from this class.`,
            confirmText: 'Yes, Delete',
            type: 'danger'
        });
        if (!confirmed) return;

        // Optimistic update
        setStudents(prev => prev.filter(s => s.studentId !== studentId));
        try {
            const fid = isSuper ? selectedFaculty : user?.facultyId;
            await api.delete(`/exams/students/${studentId}`, { params: { facultyId: fid } });
        } catch (err) {
            console.error('Delete student error:', err);
            setError('Failed to delete student.');
            loadStudents(selectedClass._id);
        }
    };

    const startEdit = (s) => {
        setEditingId(s._id);
        setEditForm({ name: s.name, email: s.email || '', classId: s.classId || '' });
    };

    const saveEdit = async () => {
        if (!editForm.name?.trim()) return;
        try {
            const fid = isSuper ? selectedFaculty : user?.facultyId;
            const student = students.find(s => s._id === editingId);
            await api.put(`/exams/students/${student.studentId}`, {
                name: editForm.name,
                email: editForm.email,
                classId: editForm.classId,
                facultyId: fid
            }, { params: { facultyId: fid } });
            setEditingId(null);
            loadStudents(selectedClass._id);
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving student');
        }
    };

    const filteredClasses = classes.filter((classroom) => matchesSearchQuery(classSearchTerm, classroom.name, classroom.code, classroom.semesterId?.name));
    const filteredStudents = students.filter((student) => matchesSearchQuery(studentSearchTerm, student.name, student.studentId, student.email, student.classId?.name, student.examsTaken));

    if (loading) return <div className="spinner" />;

    if (selectedClass) {
        return (
            <div className="fade-in">
                {confirmDialog}
                <div className="back-link" onClick={() => setSelectedClass(null)}>
                    <i className="fa-solid fa-arrow-left" /> Back to Classes
                </div>

                <div className="detail-header">
                    <div className="detail-title-row">
                        <div>
                            <h1 style={{ fontWeight: 800, marginBottom: 4 }}>Students in {selectedClass.name}</h1>
                            <div className="class-code">{selectedClass.code || 'No Code'} • {selectedClass.semesterId?.name || 'Manual Enrollment'}</div>
                        </div>
                        <div className="flex gap-sm">
                            <button className="btn btn-secondary btn-sm" onClick={() => { setShowImportForm(!showImportForm); setShowStudentForm(false); setImportResult(null); setImportError(null); }}>
                                {showImportForm ? <><i className="fa-solid fa-xmark" /> Cancel Import</> : <><i className="fa-solid fa-file-import" /> Import Students</>}
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => { setShowStudentForm(!showStudentForm); setShowImportForm(false); setTouched({}); }}>
                                {showStudentForm ? <><i className="fa-solid fa-xmark" /> Cancel</> : <><i className="fa-solid fa-user-plus" /> Add Student</>}
                            </button>
                        </div>
                    </div>
                </div>

                {showImportForm && (
                    <div className="card mb-lg slide-down">
                        <div style={{ marginBottom: 12 }}>
                            <h3 style={{ fontWeight: 800, marginBottom: 4 }}>
                                <i className="fa-solid fa-file-arrow-up" style={{ color: 'var(--primary)', marginRight: 8 }} />
                                Import Students to {selectedClass.name}
                            </h3>
                            <p className="text-muted" style={{ fontSize: 13 }}>
                                Upload an <strong>Excel</strong> (.xlsx / .xls), <strong>Word</strong> (.docx), or <strong>PDF</strong> file.
                                Columns must be: <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>Name, StudentID, Email</code>
                            </p>
                        </div>
                        <form onSubmit={handleImportStudents}>
                            {/* Drag & Drop Zone */}
                            <div
                                onDragOver={(e) => { e.preventDefault(); setImportDragging(true); }}
                                onDragLeave={() => setImportDragging(false)}
                                onDrop={handleFileDrop}
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: `2px dashed ${importDragging ? 'var(--primary)' : 'var(--border-color)'}`,
                                    borderRadius: 12,
                                    padding: '32px 20px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: importDragging ? 'var(--primary-faint, rgba(99,102,241,0.06))' : 'var(--bg-secondary)',
                                    transition: 'all 0.2s',
                                    marginBottom: 16
                                }}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={ACCEPTED_TYPES}
                                    style={{ display: 'none' }}
                                    onChange={handleFileSelect}
                                />
                                {importFile ? (
                                    <div>
                                        <div style={{ fontSize: 40, marginBottom: 8 }}>
                                            {importFile.name.endsWith('.pdf') ? '📄' :
                                             importFile.name.endsWith('.docx') || importFile.name.endsWith('.doc') ? '📝' : '📊'}
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{importFile.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                            {(importFile.size / 1024).toFixed(1)} KB — Click to change file
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.5 }}>📂</div>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>
                                            Drag & drop your file here
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                                            or <span style={{ color: 'var(--primary)', fontWeight: 600 }}>click to browse</span>
                                        </div>
                                        <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                                            {['Excel .xlsx', 'Word .docx', 'PDF .pdf'].map(t => (
                                                <span key={t} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 20, padding: '3px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {importError && <div className="badge badge-danger mb-sm">{importError}</div>}
                            {importResult && (
                                <div className={`badge ${importResult.failedCount > 0 ? 'badge-warning' : 'badge-success'} mb-sm`}
                                    style={{ textAlign: 'left', display: 'block', lineHeight: 1.6, padding: '10px 15px' }}>
                                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                                        <i className={`fa-solid ${importResult.failedCount === 0 ? 'fa-check-circle' : 'fa-triangle-exclamation'}`} style={{ marginRight: 6 }} />
                                        {importResult.message}
                                    </div>
                                    {importResult.failedCount > 0 && (
                                        <div style={{ fontSize: 12, maxHeight: 120, overflowY: 'auto' }}>
                                            <strong>Failures:</strong>
                                            {importResult.errors.map((err, idx) => (
                                                <div key={idx} style={{ marginTop: 2 }}>— {err.item?.name || 'Unknown'} (ID: {err.item?.studentId || 'N/A'}): {err.reason}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-sm">
                                <button type="submit" className="btn btn-primary btn-sm" disabled={!importFile || importLoading}>
                                    {importLoading
                                        ? <><i className="fa-solid fa-spinner fa-spin" /> Importing...</>
                                        : <><i className="fa-solid fa-upload" /> Import Now</>}
                                </button>
                                <button type="button" className="btn btn-secondary btn-sm"
                                    onClick={() => { setShowImportForm(false); setImportFile(null); setImportResult(null); setImportError(null); }}>
                                    Close
                                </button>
                            </div>
                        </form>
                    </div>
                )}


                {showStudentForm && (
                    <div className="card mb-lg slide-down">
                        <h3 className="mb-sm">Register New Student to {selectedClass.name}</h3>
                        <form onSubmit={addStudent} className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                            <div className="input-group">
                                <label>Full Name</label>
                                <input
                                    className={`input${showFormError('name') ? ' input-error' : ''}`}
                                    value={newStudent.name}
                                    onChange={e => setNewStudent({ ...newStudent, name: nameOnly(e.target.value) })}
                                    onBlur={() => setTouched(p => ({ ...p, name: true }))}
                                    placeholder="e.g. Ahmed Ali"
                                />
                                {showFormError('name') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> Required</span>}
                            </div>
                            <div className="input-group">
                                <label>Student ID</label>
                                <input
                                    className={`input${showFormError('studentId') ? ' input-error' : ''}`}
                                    value={newStudent.studentId}
                                    onChange={e => setNewStudent({ ...newStudent, studentId: sanitizeStudentId(e.target.value) })}
                                    onBlur={() => setTouched(p => ({ ...p, studentId: true }))}
                                    maxLength={40}
                                    placeholder="e.g. CA220199"
                                />
                                {showFormError('studentId') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> Required</span>}
                            </div>
                            <div className="input-group">
                                <label>Email Address</label>
                                <input className="input" type="email" value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} placeholder="email@example.com" />
                            </div>
                            <button type="submit" className="btn btn-success" style={{ alignSelf: 'flex-end', height: 'fit-content', padding: '12px' }}>
                                Register Student
                            </button>
                        </form>
                    </div>
                )}

                {error && <div className="badge badge-danger mb-md">{error}</div>}

                <div className="card">
                    <div className="mb-sm">
                        <SearchInput value={studentSearchTerm} onChange={setStudentSearchTerm} placeholder="Search by student name, ID, email, or exam count" />
                    </div>
                    {studentLoading ? (
                        <div className="spinner" />
                    ) : filteredStudents.length === 0 ? (
                        <div className="text-center py-lg text-muted">
                            {students.length === 0 ? 'No students registered in this class.' : 'No students match your search.'}
                        </div>
                    ) : (
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
                                    {filteredStudents.map((s) => (
                                        <tr key={s._id}>
                                            <td style={{ fontWeight: 600 }}>
                                                {editingId === s._id
                                                    ? <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: nameOnly(e.target.value) })} />
                                                    : s.name}
                                            </td>
                                            <td>{s.studentId}</td>
                                            <td>
                                                {editingId === s._id
                                                    ? <input className="input" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                                                    : (s.email || '—')}
                                            </td>
                                            <td>{s.examsTaken || 0}</td>
                                            <td>
                                                {editingId === s._id ? (
                                                    <div className="flex gap-sm">
                                                        <button className="btn btn-sm btn-success" onClick={saveEdit}>Save</button>
                                                        <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-sm">
                                                        <button className="btn btn-sm btn-info" onClick={() => startEdit(s)}><i className="fa-solid fa-pen" /></button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => deleteStudent(s.studentId, s.name)}>
                                                            <i className="fa-solid fa-trash" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fade-in">
            {confirmDialog}
            <div className="flex items-center justify-between mb-md">
                <div>
                    <h1 style={{ fontWeight: 800 }}>Student Management</h1>
                    <p className="text-muted">Select a class to manage its students.</p>
                </div>
            </div>

            {isSuper && (
                <div className="card mb-md">
                    <label style={{ fontWeight: 600, marginBottom: 8 }}>Select Faculty</label>
                    <select className="input" value={selectedFaculty} onChange={e => setSelectedFaculty(e.target.value)}>
                        <option value="">Choose faculty</option>
                        {faculties.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                    </select>
                </div>
            )}

            {classes.length === 0 ? (
                <div className="card text-center py-lg">
                    <div className="text-muted">No classes found. Create classes first to add students.</div>
                </div>
            ) : (
                <>
                    <div className="card mb-md">
                        <SearchInput value={classSearchTerm} onChange={setClassSearchTerm} placeholder="Search classes by name, code, or semester" />
                    </div>
                    <div className="class-grid">
                    {filteredClasses.map(c => (
                        <div key={c._id} className="class-card" onClick={() => setSelectedClass(c)}>
                            <div className="class-badge">Active</div>
                            <div>
                                <div className="class-name">{c.name}</div>
                                <div className="class-code">{c.code || 'No Code'}</div>
                            </div>
                            <div className="class-info">
                                <i className="fa-solid fa-user-graduate" /> Manage Registered Students
                            </div>
                            <div className="class-actions-overlay" onClick={e => e.stopPropagation()}>
                                <div className="text-muted" style={{ fontSize: 12 }}>Semester: {c.semesterId?.name || '—'}</div>
                            </div>
                        </div>
                    ))}
                    </div>
                    {filteredClasses.length === 0 && (
                        <div className="card text-center py-lg">
                            <div className="text-muted">No classes match your search.</div>
                        </div>
                    )}
                </>
            )}
            {error && <div className="badge badge-danger mt-md">{error}</div>}
        </div>
    );
}

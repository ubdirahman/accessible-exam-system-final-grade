import { useState, useEffect } from 'react';
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

    const [selectedClass, setSelectedClass] = useState(null);
    const [studentLoading, setStudentLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', classId: '' });
    const [classSearchTerm, setClassSearchTerm] = useState('');
    const [studentSearchTerm, setStudentSearchTerm] = useState('');

    const { confirmDialog, askConfirm } = useConfirmDialog();

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
                        <button className="btn btn-primary btn-sm" onClick={() => { setShowStudentForm(!showStudentForm); setTouched({}); }}>
                            {showStudentForm ? <><i className="fa-solid fa-xmark" /> Cancel</> : <><i className="fa-solid fa-user-plus" /> Add Student</>}
                        </button>
                    </div>
                </div>

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

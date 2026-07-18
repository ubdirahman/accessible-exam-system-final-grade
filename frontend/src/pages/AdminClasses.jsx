import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import SearchInput from '../components/SearchInput';
import { matchesSearchQuery } from '../utils/search';
import useConfirmDialog from '../hooks/useConfirmDialog';

// Only allow letters (Latin + Arabic/Somali), numbers, and spaces in name fields
const nameOnly = (val) => val.replace(/[^a-zA-Z0-9\s\u0600-\u06FF\-']/g, '');

export default function AdminClasses() {
    const { user } = useAuth();
    const isSuper = user?.role === 'super_admin';
    const [faculties, setFaculties] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState(user?.facultyId || '');
    const [semesters, setSemesters] = useState([]);
    const [classes, setClasses] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', code: '', semesterId: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', code: '', semesterId: '' });
    const [touched, setTouched] = useState({});

    // Class detail
    const [selectedClass, setSelectedClass] = useState(null);
    const [classSubjects, setClassSubjects] = useState([]);
    const [subjectLoading, setSubjectLoading] = useState(false);
    const [showSubjectForm, setShowSubjectForm] = useState(false);
    const [subjectForm, setSubjectForm] = useState({ name: '', code: '', teacherId: '' });
    const [teachers, setTeachers] = useState([]);
    const [editingSubjectId, setEditingSubjectId] = useState(null);
    const [editSubjectForm, setEditSubjectForm] = useState({ name: '', code: '', teacherId: '' });
    const [classSearchTerm, setClassSearchTerm] = useState('');
    const [subjectSearchTerm, setSubjectSearchTerm] = useState('');
    const [subjectTouched, setSubjectTouched] = useState({});

    const { confirmDialog, askConfirm } = useConfirmDialog();

    const loadFaculties = async () => {
        if (!isSuper) return;
        try {
            const res = await api.get('/faculties');
            setFaculties(res.data);
            if (!selectedFaculty && res.data.length > 0) setSelectedFaculty(res.data[0]._id);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load faculties');
        }
    };

    const loadSemesters = async (facultyId) => {
        if (!facultyId) { setSemesters([]); return; }
        try {
            const res = await api.get('/semesters', { params: { facultyId } });
            setSemesters(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load semesters');
        }
    };

    const loadClasses = async (facultyId) => {
        if (!facultyId) { setClasses([]); return; }
        try {
            setLoading(true);
            const res = await api.get('/classes', { params: { facultyId } });
            setClasses(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load classes');
        } finally {
            setLoading(false);
        }
    };

    const loadTeachers = async (facultyId) => {
        if (!facultyId) return;
        try {
            const res = await api.get('/teachers', { params: { facultyId } });
            setTeachers(res.data);
        } catch (err) {
            console.error('Failed to load teachers:', err);
        }
    };

    const loadClassSubjects = async (classId) => {
        try {
            setSubjectLoading(true);
            const facultyId = isSuper ? selectedFaculty : user?.facultyId;
            const res = await api.get('/subjects', { params: { facultyId, classId } });
            setClassSubjects(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load subjects');
        } finally {
            setSubjectLoading(false);
        }
    };

    useEffect(() => { loadFaculties(); }, []);

    useEffect(() => {
        const fid = isSuper ? selectedFaculty : user?.facultyId;
        if (fid) {
            loadSemesters(fid);
            loadClasses(fid);
            loadTeachers(fid);
        }
    }, [selectedFaculty, user?.facultyId, isSuper]);

    useEffect(() => {
        if (selectedClass) loadClassSubjects(selectedClass._id);
    }, [selectedClass]);

    // Form validation helpers
    const classFormErrors = {
        name: !form.name?.trim(),
        semesterId: !form.semesterId?.trim()
    };
    const showClassError = (field) => touched[field] && classFormErrors[field];

    const createClass = async (e) => {
        e.preventDefault();
        setTouched({ name: true, semesterId: true });
        if (Object.values(classFormErrors).some(Boolean)) return;
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        if (!facultyId) return setError('Select a faculty first.');
        try {
            await api.post('/classes', { ...form, facultyId });
            setForm({ name: '', code: '', semesterId: '' });
            setShowForm(false);
            setTouched({});
            loadClasses(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create class');
        }
    };

    const deleteClass = async (e, id, name) => {
        e.stopPropagation();
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        if (!facultyId) return;

        const confirmed = await askConfirm({
            title: 'Delete Class?',
            message: `"${name}" and all its subjects and enrolled data will be permanently removed.`,
            confirmText: 'Yes, Delete',
            type: 'danger'
        });
        if (!confirmed) return;

        // Optimistic update
        setClasses(prev => prev.filter(c => c._id !== id));
        if (selectedClass?._id === id) setSelectedClass(null);

        try {
            await api.delete(`/classes/${id}`, { params: { facultyId } });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete class');
            loadClasses(facultyId);
        }
    };

    const startEditSubject = (s) => {
        setEditingSubjectId(s._id);
        setEditSubjectForm({
            name: s.name,
            code: s.code || '',
            teacherId: s.teacherId?._id || s.teacherId || ''
        });
    };

    const saveEditSubject = async (id) => {
        if (!editSubjectForm.name?.trim()) return;
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        try {
            await api.put(`/subjects/${id}`, { ...editSubjectForm, classId: selectedClass._id, facultyId });
            setEditingSubjectId(null);
            loadClassSubjects(selectedClass._id);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update subject');
        }
    };

    const startEdit = (e, c) => {
        e.stopPropagation();
        setEditingId(c._id);
        setEditForm({ name: c.name, code: c.code || '', semesterId: c.semesterId?._id || c.semesterId || '' });
    };

    const saveEdit = async (e) => {
        e.stopPropagation();
        if (!editForm.name?.trim()) return;
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        try {
            await api.put(`/classes/${editingId}`, { ...editForm, facultyId });
            setEditingId(null);
            loadClasses(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save class');
        }
    };

    // Subject form validation
    const subjectErrors = {
        name: !subjectForm.name?.trim(),
        teacherId: !subjectForm.teacherId?.trim()
    };
    const showSubjectError = (field) => subjectTouched[field] && subjectErrors[field];

    const handleCreateSubject = async (e) => {
        e.preventDefault();
        setSubjectTouched({ name: true, teacherId: true });
        if (Object.values(subjectErrors).some(Boolean)) return;
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        try {
            await api.post('/subjects', { ...subjectForm, classId: selectedClass._id, facultyId });
            setSubjectForm({ name: '', code: '', teacherId: '' });
            setShowSubjectForm(false);
            setSubjectTouched({});
            loadClassSubjects(selectedClass._id);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create subject');
        }
    };

    const handleDeleteSubject = async (id, name) => {
        const confirmed = await askConfirm({
            title: 'Delete Subject?',
            message: `"${name}" will be permanently removed from this class.`,
            confirmText: 'Yes, Delete',
            type: 'danger'
        });
        if (!confirmed) return;

        // Optimistic update
        setClassSubjects(prev => prev.filter(s => s._id !== id));
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        try {
            await api.delete(`/subjects/${id}`, { params: { facultyId } });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete subject');
            loadClassSubjects(selectedClass._id);
        }
    };

    const filteredClasses = classes.filter((classroom) => matchesSearchQuery(
        classSearchTerm, classroom.name, classroom.code, classroom.semesterId?.name
    ));

    const filteredClassSubjects = classSubjects.filter((subject) => matchesSearchQuery(
        subjectSearchTerm, subject.name, subject.code, subject.teacherId?.name
    ));

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
                            <h1 style={{ fontWeight: 800, marginBottom: 4 }}>{selectedClass.name}</h1>
                            <div className="class-code">{selectedClass.code || 'No Code'} • {selectedClass.semesterId?.name || 'No Semester'}</div>
                        </div>
                        <button
                            className={`btn ${showSubjectForm ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={() => { setShowSubjectForm(!showSubjectForm); setSubjectTouched({}); }}
                        >
                            {showSubjectForm ? 'Cancel' : <><i className="fa-solid fa-plus" /> Add Subject</>}
                        </button>
                    </div>
                </div>

                {showSubjectForm && (
                    <div className="card mb-lg slide-down">
                        <h3 className="mb-sm">Add New Subject to {selectedClass.name}</h3>
                        <form className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }} onSubmit={handleCreateSubject}>
                            <div className="input-group">
                                <label>Subject Name</label>
                                <input
                                    className={`input${showSubjectError('name') ? ' input-error' : ''}`}
                                    value={subjectForm.name}
                                    onChange={e => setSubjectForm({ ...subjectForm, name: nameOnly(e.target.value) })}
                                    onBlur={() => setSubjectTouched(p => ({ ...p, name: true }))}
                                    placeholder="e.g. Mathematics"
                                />
                                {showSubjectError('name') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> Required</span>}
                            </div>
                            <div className="input-group">
                                <label>Subject Code</label>
                                <input className="input" value={subjectForm.code} onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })} placeholder="e.g. MATH101" />
                            </div>
                            <div className="input-group">
                                <label>Assign Teacher</label>
                                <select
                                    className={`input${showSubjectError('teacherId') ? ' input-error' : ''}`}
                                    value={subjectForm.teacherId}
                                    onChange={e => setSubjectForm({ ...subjectForm, teacherId: e.target.value })}
                                    onBlur={() => setSubjectTouched(p => ({ ...p, teacherId: true }))}
                                >
                                    <option value="">Select teacher</option>
                                    {teachers
                                        .filter(t => (t.classId?._id || t.classId) === (selectedClass?._id || selectedClass))
                                        .map(t => <option key={t._id} value={t._id}>{t.name}</option>)
                                    }
                                </select>
                                {showSubjectError('teacherId') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> Required</span>}
                            </div>
                            <button className="btn btn-primary" type="submit" style={{ alignSelf: 'end' }}>Create Subject</button>
                        </form>
                        {error && <div className="badge badge-danger mt-sm">{error}</div>}
                    </div>
                )}

                <div className="card">
                    <h3 className="mb-md">Subjects in this Class</h3>
                    <div className="mb-sm">
                        <SearchInput value={subjectSearchTerm} onChange={setSubjectSearchTerm} placeholder="Search subjects by name, code, or teacher" />
                    </div>
                    {subjectLoading ? (
                        <div className="spinner" />
                    ) : filteredClassSubjects.length === 0 ? (
                        <div className="text-muted">
                            {classSubjects.length === 0 ? 'No subjects found in this class yet.' : 'No subjects match your search.'}
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Subject Name</th>
                                        <th>Code</th>
                                        <th>Teacher</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredClassSubjects.map(s => (
                                        <tr key={s._id}>
                                            <td style={{ fontWeight: 600 }}>
                                                {editingSubjectId === s._id ? (
                                                    <input className="input" value={editSubjectForm.name} onChange={e => setEditSubjectForm({ ...editSubjectForm, name: nameOnly(e.target.value) })} style={{ padding: '4px 8px' }} />
                                                ) : s.name}
                                            </td>
                                            <td>
                                                {editingSubjectId === s._id ? (
                                                    <input className="input" value={editSubjectForm.code} onChange={e => setEditSubjectForm({ ...editSubjectForm, code: e.target.value })} style={{ padding: '4px 8px', maxWidth: 100 }} placeholder="Code" />
                                                ) : (s.code || '—')}
                                            </td>
                                            <td>
                                                {editingSubjectId === s._id ? (
                                                    <select className="input" value={editSubjectForm.teacherId} onChange={e => setEditSubjectForm({ ...editSubjectForm, teacherId: e.target.value })} style={{ padding: '4px 8px' }}>
                                                        <option value="">Select teacher</option>
                                                        {teachers.filter(t => (t.classId?._id || t.classId) === (selectedClass?._id || selectedClass)).map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                                    </select>
                                                ) : (s.teacherId?.name || 'Not Assigned')}
                                            </td>
                                            <td>
                                                <div className="flex gap-sm">
                                                    {editingSubjectId === s._id ? (
                                                        <>
                                                            <button className="btn btn-sm btn-success" onClick={() => saveEditSubject(s._id)}>Save</button>
                                                            <button className="btn btn-sm btn-ghost" onClick={() => setEditingSubjectId(null)}>Cancel</button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button className="btn btn-sm btn-secondary" onClick={() => startEditSubject(s)}>Edit</button>
                                                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteSubject(s._id, s.name)}>
                                                                <i className="fa-solid fa-trash" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
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
                    <h1 style={{ fontWeight: 800 }}>Manage Classes</h1>
                    <p className="text-muted">Create and manage classes for your faculty.</p>
                </div>
                <button className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'}`} onClick={() => { setShowForm(!showForm); setTouched({}); }}>
                    {showForm ? <><i className="fa-solid fa-xmark" /> Cancel</> : <><i className="fa-solid fa-plus" /> Add Class</>}
                </button>
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

            {showForm && (
                <div className="card mb-lg slide-down">
                    <h3 className="mb-sm">Register New Class</h3>
                    <form className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }} onSubmit={createClass}>
                        <div className="input-group">
                            <label>Class Name</label>
                            <input
                                className={`input${showClassError('name') ? ' input-error' : ''}`}
                                value={form.name}
                                onChange={e => setForm({ ...form, name: nameOnly(e.target.value) })}
                                onBlur={() => setTouched(p => ({ ...p, name: true }))}
                                placeholder="e.g. Computer Science 2024"
                            />
                            {showClassError('name') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> Required</span>}
                        </div>
                        <div className="input-group">
                            <label>Class Code</label>
                            <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. CS24" />
                        </div>
                        <div className="input-group">
                            <label>Semester</label>
                            <select
                                className={`input${showClassError('semesterId') ? ' input-error' : ''}`}
                                value={form.semesterId}
                                onChange={e => setForm({ ...form, semesterId: e.target.value })}
                                onBlur={() => setTouched(p => ({ ...p, semesterId: true }))}
                            >
                                <option value="">Select semester</option>
                                {semesters.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </select>
                            {showClassError('semesterId') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> Required</span>}
                        </div>
                        <button className="btn btn-primary" type="submit" style={{ alignSelf: 'end' }}>Save Class</button>
                    </form>
                    {error && <div className="badge badge-danger mt-sm">{error}</div>}
                </div>
            )}

            {loading ? (
                <div className="spinner" />
            ) : classes.length === 0 ? (
                <div className="card text-center py-lg">
                    <div className="text-muted">No classes found. Click "Add Class" to create one.</div>
                </div>
            ) : (
                <>
                    <div className="card mb-md">
                        <SearchInput value={classSearchTerm} onChange={setClassSearchTerm} placeholder="Search classes by name, code, or semester" />
                    </div>
                    <div className="class-grid">
                    {filteredClasses.map(c => (
                        <div key={c._id} className="class-card" onClick={() => setSelectedClass(c)}>
                            <div className="class-badge">{c.semesterId?.name || 'N/A'}</div>
                            <div>
                                <div className="class-name">
                                    {editingId === c._id ? (
                                        <input className="input" value={editForm.name} onClick={e => e.stopPropagation()} onChange={e => setEditForm({ ...editForm, name: nameOnly(e.target.value) })} />
                                    ) : c.name}
                                </div>
                                <div className="class-code">
                                    {editingId === c._id ? (
                                        <input className="input" value={editForm.code} onClick={e => e.stopPropagation()} onChange={e => setEditForm({ ...editForm, code: e.target.value })} />
                                    ) : (c.code || '—')}
                                </div>
                            </div>

                            <div className="class-info">
                                <i className="fa-solid fa-graduation-cap" /> View Subjects &amp; Content
                            </div>

                            <div className="class-actions-overlay">
                                {editingId === c._id ? (
                                    <>
                                        <button className="btn btn-sm btn-success" onClick={saveEdit}>Save</button>
                                        <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>Cancel</button>
                                    </>
                                ) : (
                                    <>
                                        <button className="btn btn-sm btn-secondary" onClick={(e) => startEdit(e, c)}>
                                            <i className="fa-solid fa-pen-to-square" />
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={(e) => deleteClass(e, c._id, c.name)}>
                                            <i className="fa-solid fa-trash" />
                                        </button>
                                    </>
                                )}
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

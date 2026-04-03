import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

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

    // New states for class detailing
    const [selectedClass, setSelectedClass] = useState(null);
    const [classSubjects, setClassSubjects] = useState([]);
    const [subjectLoading, setSubjectLoading] = useState(false);
    const [showSubjectForm, setShowSubjectForm] = useState(false);
    const [subjectForm, setSubjectForm] = useState({ name: '', code: '', teacherId: '' });
    const [teachers, setTeachers] = useState([]);
    
    // New states for editing subjects in class details
    const [editingSubjectId, setEditingSubjectId] = useState(null);
    const [editSubjectForm, setEditSubjectForm] = useState({ name: '', code: '', teacherId: '' });


    const loadFaculties = async () => {
        if (!isSuper) return;
        try {
            const res = await api.get('/faculties');
            setFaculties(res.data);
            if (!selectedFaculty && res.data.length > 0) {
                setSelectedFaculty(res.data[0]._id);
            }
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

    useEffect(() => {
        loadFaculties();
    }, []);

    useEffect(() => {
        const fid = isSuper ? selectedFaculty : user?.facultyId;
        if (fid) {
            loadSemesters(fid);
            loadClasses(fid);
            loadTeachers(fid);
        }
    }, [selectedFaculty, user?.facultyId, isSuper]);

    useEffect(() => {
        if (selectedClass) {
            loadClassSubjects(selectedClass._id);
        }
    }, [selectedClass]);

    const createClass = async (e) => {
        e.preventDefault();
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        if (!facultyId) return setError('Select a faculty first.');
        try {
            await api.post('/classes', { ...form, facultyId });
            setForm({ name: '', code: '', semesterId: '' });
            setShowForm(false);
            loadClasses(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create class');
        }
    };

    const deleteClass = async (e, id) => {
        e.stopPropagation();
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        if (!facultyId) return;
        if (!window.confirm('Delete this class?')) return;
        try {
            await api.delete(`/classes/${id}`, { params: { facultyId } });
            loadClasses(facultyId);
            if (selectedClass?._id === id) setSelectedClass(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete class');
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
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        try {
            await api.put(`/classes/${editingId}`, { ...editForm, facultyId });
            setEditingId(null);
            loadClasses(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save class');
        }
    };

    const handleCreateSubject = async (e) => {
        e.preventDefault();
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        try {
            await api.post('/subjects', { 
                ...subjectForm, 
                classId: selectedClass._id, 
                facultyId 
            });
            setSubjectForm({ name: '', code: '', teacherId: '' });
            setShowSubjectForm(false);
            loadClassSubjects(selectedClass._id);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create subject');
        }
    };

    const handleDeleteSubject = async (id) => {
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        if (!window.confirm('Delete this subject?')) return;
        try {
            await api.delete(`/subjects/${id}`, { params: { facultyId } });
            loadClassSubjects(selectedClass._id);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete subject');
        }
    };

    if (selectedClass) {
        return (
            <div className="fade-in">
                <div className="back-link" onClick={() => setSelectedClass(null)}>
                    <i className="fa-solid fa-arrow-left"></i> Back to Classes
                </div>

                <div className="detail-header">
                    <div className="detail-title-row">
                        <div>
                            <h1 style={{ fontWeight: 800, marginBottom: 4 }}>{selectedClass.name}</h1>
                            <div className="class-code">{selectedClass.code || 'No Code'} • {selectedClass.semesterId?.name || 'No Semester'}</div>
                        </div>
                        <button 
                            className={`btn ${showSubjectForm ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={() => setShowSubjectForm(!showSubjectForm)}
                        >
                            {showSubjectForm ? 'Cancel' : (
                                <><i className="fa-solid fa-plus"></i> Add Subject</>
                            )}
                        </button>
                    </div>
                </div>

                {showSubjectForm && (
                    <div className="card mb-lg slide-down">
                        <h3 className="mb-sm">Add New Subject to {selectedClass.name}</h3>
                        <form className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }} onSubmit={handleCreateSubject}>
                            <div className="input-group">
                                <label>Subject Name</label>
                                <input className="input" value={subjectForm.name} onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })} required />
                            </div>
                            <div className="input-group">
                                <label>Subject Code</label>
                                <input className="input" value={subjectForm.code} onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label>Assign Teacher</label>
                                <select className="input" value={subjectForm.teacherId} onChange={e => setSubjectForm({ ...subjectForm, teacherId: e.target.value })} required>
                                    <option value="">Select teacher</option>
                                    {teachers
                                        .filter(t => (t.classId?._id || t.classId) === (selectedClass?._id || selectedClass))
                                        .map(t => <option key={t._id} value={t._id}>{t.name}</option>)
                                    }
                                </select>
                            </div>
                            <button className="btn btn-primary" type="submit">Create Subject</button>
                        </form>
                        {error && <div className="badge badge-danger mt-sm">{error}</div>}
                    </div>
                )}

                <div className="card">
                    <h3 className="mb-md">Subjects in this Class</h3>
                    {subjectLoading ? (
                        <div className="spinner" />
                    ) : classSubjects.length === 0 ? (
                        <div className="text-muted">No subjects found in this class yet.</div>
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
                                    {classSubjects.map(s => (
                                        <tr key={s._id}>
                                            <td style={{ fontWeight: 600 }}>
                                                {editingSubjectId === s._id ? (
                                                    <input 
                                                        className="input" 
                                                        value={editSubjectForm.name} 
                                                        onChange={e => setEditSubjectForm({...editSubjectForm, name: e.target.value})} 
                                                        style={{ padding: '4px 8px' }}
                                                    />
                                                ) : s.name}
                                            </td>
                                            <td>
                                                {editingSubjectId === s._id ? (
                                                    <input 
                                                        className="input" 
                                                        value={editSubjectForm.code} 
                                                        onChange={e => setEditSubjectForm({...editSubjectForm, code: e.target.value})} 
                                                        style={{ padding: '4px 8px', maxWidth: '100px' }}
                                                        placeholder="Code"
                                                    />
                                                ) : (s.code || '—')}
                                            </td>
                                            <td>
                                                {editingSubjectId === s._id ? (
                                                    <select 
                                                        className="input" 
                                                        value={editSubjectForm.teacherId} 
                                                        onChange={e => setEditSubjectForm({...editSubjectForm, teacherId: e.target.value})}
                                                        style={{ padding: '4px 8px' }}
                                                    >
                                                        <option value="">Select teacher</option>
                                                        {teachers
                                                            .filter(t => (t.classId?._id || t.classId) === (selectedClass?._id || selectedClass))
                                                            .map(t => <option key={t._id} value={t._id}>{t.name}</option>)
                                                        }
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
                                                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteSubject(s._id)}>Delete</button>
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
            <div className="flex items-center justify-between mb-md">
                <div>
                    <h1 style={{ fontWeight: 800 }}>Manage Classes</h1>
                    <p className="text-muted">Create and manage classes for your faculty.</p>
                </div>
                <button 
                    className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'}`} 
                    onClick={() => setShowForm(!showForm)}
                >
                    {showForm ? (
                        <><i className="fa-solid fa-xmark"></i> Cancel</>
                    ) : (
                        <><i className="fa-solid fa-plus"></i> Add Class</>
                    )}
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
                            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Computer Science 2024" />
                        </div>
                        <div className="input-group">
                            <label>Class Code</label>
                            <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. CS24" />
                        </div>
                        <div className="input-group">
                            <label>Semester</label>
                            <select className="input" value={form.semesterId} onChange={e => setForm({ ...form, semesterId: e.target.value })} required>
                                <option value="">Select semester</option>
                                {semesters.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </select>
                        </div>
                        <button className="btn btn-primary" type="submit">Save Class</button>
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
                <div className="class-grid">
                    {classes.map(c => (
                        <div key={c._id} className="class-card" onClick={() => setSelectedClass(c)}>
                            <div className="class-badge">{c.semesterId?.name || 'N/A'}</div>
                            <div>
                                <div className="class-name">
                                    {editingId === c._id ? (
                                        <input 
                                            className="input" 
                                            value={editForm.name} 
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })} 
                                        />
                                    ) : c.name}
                                </div>
                                <div className="class-code">
                                    {editingId === c._id ? (
                                        <input 
                                            className="input" 
                                            value={editForm.code} 
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => setEditForm({ ...editForm, code: e.target.value })} 
                                        />
                                    ) : (c.code || '—')}
                                </div>
                            </div>

                            <div className="class-info">
                                <i className="fa-solid fa-graduation-cap"></i> 
                                View Subjects & Content
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
                                            <i className="fa-solid fa-pen-to-square"></i>
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={(e) => deleteClass(e, c._id)}>
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {error && <div className="badge badge-danger mt-md">{error}</div>}
        </div>
    );
}


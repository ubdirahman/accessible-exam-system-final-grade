import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function AdminSubjects() {
    const { user } = useAuth();
    const isSuper = user?.role === 'super_admin';
    const [faculties, setFaculties] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState(user?.facultyId || '');
    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [form, setForm] = useState({ name: '', code: '', classId: '', teacherId: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', code: '', classId: '', teacherId: '' });

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

    const loadClasses = async (facultyId) => {
        if (!facultyId) return;
        try {
            const res = await api.get('/classes', { params: { facultyId } });
            setClasses(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load classes');
        }
    };

    const loadTeachers = async (facultyId) => {
        if (!facultyId) return;
        try {
            const res = await api.get('/teachers', { params: { facultyId } });
            setTeachers(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load teachers');
        }
    };

    const loadSubjects = async (facultyId) => {
        if (!facultyId) { setSubjects([]); return; }
        try {
            setLoading(true);
            const res = await api.get('/subjects', { params: { facultyId } });
            setSubjects(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load subjects');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFaculties();
    }, []);

    useEffect(() => {
        const fid = isSuper ? selectedFaculty : user?.facultyId;
        if (fid) {
            loadClasses(fid);
            loadTeachers(fid);
            loadSubjects(fid);
        }
    }, [selectedFaculty, user?.facultyId, isSuper]);

    const createSubject = async (e) => {
        e.preventDefault();
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        if (!facultyId) return setError('Select a faculty first.');
        try {
            await api.post('/subjects', { ...form, facultyId });
            setForm({ name: '', code: '', classId: '', teacherId: '' });
            setShowAddForm(false);
            loadSubjects(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create subject');
        }
    };

    const deleteSubject = async (id) => {
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        if (!facultyId) return;
        if (!window.confirm('Delete this subject?')) return;
        try {
            await api.delete(`/subjects/${id}`, { params: { facultyId } });
            loadSubjects(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete subject');
        }
    };

    const startEdit = (s) => {
        setEditingId(s._id);
        setEditForm({
            name: s.name,
            code: s.code || '',
            classId: s.classId?._id || s.classId || '',
            teacherId: s.teacherId?._id || s.teacherId || ''
        });
    };

    const saveEdit = async () => {
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        try {
            await api.put(`/subjects/${editingId}`, {
                name: editForm.name,
                code: editForm.code,
                classId: editForm.classId,
                teacherId: editForm.teacherId,
                facultyId
            });
            setEditingId(null);
            loadSubjects(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save subject');
        }
    };

    return (
        <div className="fade-in">
            <div className="flex items-center justify-between mb-md">
                <h1 style={{ fontWeight: 800 }}>Subjects</h1>
                <button 
                    className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`} 
                    onClick={() => setShowAddForm(!showAddForm)}
                >
                    {showAddForm ? (
                        <><i className="fa-solid fa-xmark" aria-hidden="true"></i> Cancel</>
                    ) : (
                        <><i className="fa-solid fa-plus" aria-hidden="true"></i> Add Subject</>
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

            {showAddForm && (
                <div className="card mb-lg slide-down">
                    <h3 className="mb-sm">Add New Subject</h3>
                    <form className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }} onSubmit={createSubject}>
                        <div className="input-group">
                            <label>Subject Name</label>
                            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                        </div>
                        <div className="input-group">
                            <label>Code</label>
                            <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
                        </div>
                        <div className="input-group">
                            <label>Class</label>
                            <select className="input" value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })} required>
                                <option value="">Select class</option>
                                {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="input-group">
                            <label>Teacher</label>
                            <select className="input" value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })} required>
                                <option value="">Select teacher</option>
                                {teachers
                                    .filter(t => (t.classId?._id || t.classId) === form.classId)
                                    .map(t => <option key={t._id} value={t._id}>{t.name}</option>)
                                }
                            </select>
                        </div>
                        <button className="btn btn-primary" type="submit">Add New Subject</button>
                    </form>
                    {error && <div className="badge badge-danger mt-sm">{error}</div>}
                </div>
            )}

            <div className="card">
                <div className="flex items-center justify-between mb-sm">
                    <h3>Existing Subjects</h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => loadSubjects(isSuper ? selectedFaculty : user?.facultyId)}>Refresh</button>
                </div>
                {loading ? (
                    <div className="spinner" />
                ) : subjects.length === 0 ? (
                    <div className="text-muted">No subjects found.</div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Code</th>
                                    <th>Class</th>
                                    <th>Teacher</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subjects.map(s => {
                                    return (
                                        <tr key={s._id}>
                                            <td style={{ fontWeight: 600 }}>
                                                {editingId === s._id
                                                    ? <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                                    : s.name}
                                            </td>
                                            <td>
                                                {editingId === s._id
                                                    ? <input className="input" value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} />
                                                    : (s.code || '—')}
                                            </td>
                                            <td>
                                                {editingId === s._id
                                                    ? (
                                                        <select className="input" value={editForm.classId} onChange={e => setEditForm({ ...editForm, classId: e.target.value })}>
                                                            <option value="">Select class</option>
                                                            {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                                        </select>
                                                    ) : (s.classId?.name || '—')}
                                            </td>
                                            <td>
                                                {editingId === s._id
                                                    ? (
                                                        <select className="input" value={editForm.teacherId} onChange={e => setEditForm({ ...editForm, teacherId: e.target.value })}>
                                                            <option value="">Select teacher</option>
                                                    {teachers
                                                        .filter(t => (t.classId?._id || t.classId) === editForm.classId)
                                                        .map(t => <option key={t._id} value={t._id}>{t.name}</option>)
                                                    }
                                                </select>
                                                    ) : (s.teacherId?.name || '—')}
                                            </td>
                                            <td>
                                                {editingId === s._id ? (
                                                    <>
                                                        <button className="btn btn-sm btn-success" onClick={saveEdit}>Save</button>
                                                        <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button className="btn btn-sm btn-info" onClick={() => startEdit(s)}>Edit</button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => deleteSubject(s._id)}>Delete</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

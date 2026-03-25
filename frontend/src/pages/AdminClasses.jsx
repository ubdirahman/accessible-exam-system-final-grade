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

    useEffect(() => {
        loadFaculties();
    }, []);

    useEffect(() => {
        const fid = isSuper ? selectedFaculty : user?.facultyId;
        if (fid) {
            loadSemesters(fid);
            loadClasses(fid);
        }
    }, [selectedFaculty, user?.facultyId, isSuper]);

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

    const deleteClass = async (id) => {
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        if (!facultyId) return;
        if (!window.confirm('Delete this class?')) return;
        try {
            await api.delete(`/classes/${id}`, { params: { facultyId } });
            loadClasses(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete class');
        }
    };

    const startEdit = (c) => {
        setEditingId(c._id);
        setEditForm({ name: c.name, code: c.code || '', semesterId: c.semesterId?._id || c.semesterId || '' });
    };

    const saveEdit = async () => {
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        try {
            await api.put(`/classes/${editingId}`, { ...editForm, facultyId });
            setEditingId(null);
            loadClasses(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save class');
        }
    };

    return (
        <div className="fade-in">
            <div className="flex items-center justify-between mb-md">
                <h1 style={{ fontWeight: 800 }}>Classes</h1>
                <button 
                    className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'}`} 
                    onClick={() => setShowForm(!showForm)}
                >
                    {showForm ? (
                        <><i className="fa-solid fa-xmark" aria-hidden="true"></i> Cancel</>
                    ) : (
                        <><i className="fa-solid fa-plus" aria-hidden="true"></i> Add Class</>
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
                        <div className="input-group" style={{ flex: 1, minWidth: 200 }}>
                            <label>Name</label>
                            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                        </div>
                        <div className="input-group" style={{ flex: 1, minWidth: 160 }}>
                            <label>Code</label>
                            <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
                        </div>
                        <div className="input-group">
                            <label>Semester</label>
                            <select className="input" value={form.semesterId} onChange={e => setForm({ ...form, semesterId: e.target.value })} required>
                                <option value="">Select semester</option>
                                {semesters.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </select>
                        </div>
                        <button className="btn btn-primary" type="submit">Save</button>
                    </form>
                    {error && <div className="badge badge-danger mt-sm">{error}</div>}
                </div>
            )}

            <div className="card">
                <div className="flex items-center justify-between mb-sm">
                    <h3>Existing Classes</h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => loadClasses(isSuper ? selectedFaculty : user?.facultyId)}>Refresh</button>
                </div>
                {loading ? (
                    <div className="spinner" />
                ) : classes.length === 0 ? (
                    <div className="text-muted">No classes found.</div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Code</th>
                                    <th>Semester</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {classes.map(c => (
                                    <tr key={c._id}>
                                        <td style={{ fontWeight: 600 }}>
                                            {editingId === c._id
                                                ? <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                                : c.name}
                                        </td>
                                        <td>
                                            {editingId === c._id
                                                ? <input className="input" value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} />
                                                : (c.code || '—')}
                                        </td>
                                        <td>
                                            {editingId === c._id
                                                ? (
                                                    <select className="input" value={editForm.semesterId} onChange={e => setEditForm({ ...editForm, semesterId: e.target.value })}>
                                                        <option value="">Select semester</option>
                                                        {semesters.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                                    </select>
                                                )
                                                : (c.semesterId?.name || '—')}
                                        </td>
                                        <td>
                                            {editingId === c._id ? (
                                                <>
                                                    <button className="btn btn-sm btn-success" onClick={saveEdit}>Save</button>
                                                    <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button className="btn btn-sm btn-info" onClick={() => startEdit(c)}>Edit</button>
                                                    <button className="btn btn-sm btn-danger" onClick={() => deleteClass(c._id)}>Delete</button>
                                                </>
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

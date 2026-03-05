import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function AdminTeachers() {
    const { user } = useAuth();
    const isSuper = user?.role === 'super_admin';
    const [faculties, setFaculties] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState(user?.facultyId || '');
    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', password: '', classId: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', phone: '', address: '', classId: '', active: true });

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
            const res = await api.get('/classes', { params: { facultyId } });
            setClasses(res.data);
        } catch (err) {
            setError('Failed to load classes.');
        }
    };

    const loadTeachers = async () => {
        try {
            setLoading(true);
            const params = isSuper && selectedFaculty ? { facultyId: selectedFaculty } : {};
            const res = await api.get('/teachers', { params });
            setTeachers(res.data);
        } catch (err) {
            setError('Failed to load teachers.');
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
            loadTeachers();
        }
    }, [selectedFaculty, isSuper]);

    const addTeacher = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const payload = { ...form };
            if (isSuper) payload.facultyId = selectedFaculty;
            await api.post('/teachers', payload);
            setForm({ name: '', email: '', phone: '', address: '', password: '', classId: '' });
            setShowForm(false);
            loadTeachers();
        } catch (err) {
            setError(err.response?.data?.message || 'Error creating teacher.');
        }
    };

    const deleteTeacher = async (id) => {
        if (!window.confirm('Delete this teacher?')) return;
        try {
            const params = isSuper && selectedFaculty ? { facultyId: selectedFaculty } : {};
            await api.delete(`/teachers/${id}`, { params });
            loadTeachers();
        } catch (err) {
            setError('Error deleting teacher.');
        }
    };

    const startEdit = (t) => {
        setEditingId(t._id);
        setEditForm({ name: t.name, phone: t.phone, address: t.address || '', classId: t.classId || '', active: !!t.active });
    };

    const saveEdit = async () => {
        try {
            const params = isSuper && selectedFaculty ? { facultyId: selectedFaculty } : {};
            await api.put(`/teachers/${editingId}`, {
                name: editForm.name,
                phone: editForm.phone,
                address: editForm.address,
                active: editForm.active,
                classId: editForm.classId
            }, { params });
            setEditingId(null);
            loadTeachers();
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving teacher.');
        }
    };

    if (loading) return <div className="spinner"></div>;

    return (
        <div className="fade-in">
            <div className="flex items-center justify-between mb-md">
                <h2 style={{ fontWeight: 700 }}><i className="fa-solid fa-chalkboard-user" aria-hidden="true"></i> Teachers</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
                    {showForm ? <><i className="fa-solid fa-circle-xmark" aria-hidden="true"></i> Cancel</> : <><i className="fa-solid fa-plus" aria-hidden="true"></i> Add Teacher</>}
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
                <div className="card mb-md">
                    <form className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }} onSubmit={addTeacher}>
                        <div className="input-group">
                            <label>Name</label>
                            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                        </div>
                        <div className="input-group">
                            <label>Email</label>
                            <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                        </div>
                        <div className="input-group">
                            <label>Phone</label>
                            <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
                        </div>
                        <div className="input-group">
                            <label>Address</label>
                            <input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                        </div>
                        <div className="input-group">
                            <label>Password</label>
                            <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                        </div>
                        <div className="input-group">
                            <label>Class</label>
                            <select className="input" value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })} required>
                                <option value="">Select class</option>
                                {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <button className="btn btn-success" type="submit">Save</button>
                    </form>
                </div>
            )}

            {error && <div className="badge badge-danger mb-md">{error}</div>}

            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Class</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teachers.map(t => {
                            const cls = classes.find(c => c._id === t.classId);
                            return (
                                <tr key={t._id}>
                                    <td style={{ fontWeight: 600 }}>
                                        {editingId === t._id
                                            ? <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                            : t.name}
                                    </td>
                                    <td>{t.email}</td>
                                    <td>
                                        {editingId === t._id
                                            ? <input className="input" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                                            : t.phone}
                                    </td>
                                    <td>
                                        {editingId === t._id
                                            ? (
                                                <select className="input" value={editForm.classId} onChange={e => setEditForm({ ...editForm, classId: e.target.value })}>
                                                    <option value="">Select class</option>
                                                    {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                                </select>
                                            ) : (cls ? cls.name : '—')}
                                    </td>
                                    <td>
                                        {editingId === t._id
                                            ? <input type="checkbox" checked={editForm.active} onChange={e => setEditForm({ ...editForm, active: e.target.checked })} />
                                            : (t.active ? 'Active' : 'Inactive')}
                                    </td>
                                    <td>
                                        {editingId === t._id ? (
                                            <>
                                                <button className="btn btn-sm btn-success" onClick={saveEdit}>Save</button>
                                                <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="btn btn-sm btn-info" onClick={() => startEdit(t)}>Edit</button>
                                                <button className="btn btn-sm btn-danger" onClick={() => deleteTeacher(t._id)}>Delete</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {teachers.length === 0 && (
                            <tr><td colSpan="6" className="text-center text-muted" style={{ padding: 40 }}>No teachers found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

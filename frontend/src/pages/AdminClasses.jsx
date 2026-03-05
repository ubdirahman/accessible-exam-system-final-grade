import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function AdminClasses() {
    const { user } = useAuth();
    const isSuper = user?.role === 'super_admin';
    const [faculties, setFaculties] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState(user?.facultyId || '');
    const [classes, setClasses] = useState([]);
    const [form, setForm] = useState({ name: '', code: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', code: '' });

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
        if (fid) loadClasses(fid);
    }, [selectedFaculty, user?.facultyId, isSuper]);

    const createClass = async (e) => {
        e.preventDefault();
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        if (!facultyId) return setError('Select a faculty first.');
        try {
            await api.post('/classes', { ...form, facultyId });
            setForm({ name: '', code: '' });
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
        setEditForm({ name: c.name, code: c.code || '' });
    };

    const saveEdit = async () => {
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        try {
            await api.put(`/classes/${editingId}`, { name: editForm.name, code: editForm.code, facultyId });
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

            <div className="card mb-lg">
                <h3 className="mb-sm">Add Class</h3>
                <form className="flex gap-md" style={{ flexWrap: 'wrap' }} onSubmit={createClass}>
                    <div className="input-group" style={{ flex: 1, minWidth: 200 }}>
                        <label>Name</label>
                        <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="input-group" style={{ flex: 1, minWidth: 160 }}>
                        <label>Code</label>
                        <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
                    </div>
                    <button className="btn btn-primary" type="submit">Save</button>
                </form>
                {error && <div className="badge badge-danger mt-sm">{error}</div>}
            </div>

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

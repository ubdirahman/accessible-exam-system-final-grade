import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function AdminSemesters() {
    const { user } = useAuth();
    const isSuper = user?.role === 'super_admin';
    const [faculties, setFaculties] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState(user?.facultyId || '');
    const [semesters, setSemesters] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', startDate: '', endDate: '' });

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
            setLoading(true);
            const res = await api.get('/semesters', { params: { facultyId } });
            setSemesters(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load semesters');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFaculties();
    }, []);

    useEffect(() => {
        const fid = isSuper ? selectedFaculty : user?.facultyId;
        if (fid) loadSemesters(fid);
    }, [selectedFaculty, user?.facultyId, isSuper]);

    const createSemester = async (e) => {
        e.preventDefault();
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        if (!facultyId) return setError('Select a faculty first.');
        try {
            await api.post('/semesters', { ...form, facultyId });
            setForm({ name: '', startDate: '', endDate: '' });
            setShowAddForm(false);
            loadSemesters(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create semester');
        }
    };

    const deleteSemester = async (id) => {
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        if (!facultyId) return;
        if (!window.confirm('Delete this semester? This cannot be undone.')) return;
        try {
            await api.delete(`/semesters/${id}`, { params: { facultyId } });
            loadSemesters(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete semester');
        }
    };

    const startEdit = (s) => {
        setEditingId(s._id);
        setEditForm({
            name: s.name,
            startDate: s.startDate ? new Date(s.startDate).toISOString().split('T')[0] : '',
            endDate: s.endDate ? new Date(s.endDate).toISOString().split('T')[0] : ''
        });
    };

    const saveEdit = async () => {
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        try {
            await api.put(`/semesters/${editingId}`, { ...editForm, facultyId });
            setEditingId(null);
            loadSemesters(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save semester');
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString();
    }

    return (
        <div className="fade-in">
            <div className="flex items-center justify-between mb-md">
                <h1 style={{ fontWeight: 800 }}>Semesters</h1>
                <button 
                    className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`} 
                    onClick={() => setShowAddForm(!showAddForm)}
                >
                    {showAddForm ? (
                        <><i className="fa-solid fa-xmark" aria-hidden="true"></i> Cancel</>
                    ) : (
                        <><i className="fa-solid fa-plus" aria-hidden="true"></i> Add Semester</>
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
                    <h3 className="mb-sm">Add Semester</h3>
                    <form className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }} onSubmit={createSemester}>
                        <div className="input-group">
                            <label>Semester Name</label>
                            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g., Fall 2024" />
                        </div>
                        <div className="input-group">
                            <label>Start Date</label>
                            <input className="input" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                            <small className="text-muted">mm/dd/yyyy</small>
                        </div>
                        <div className="input-group">
                            <label>End Date</label>
                            <input className="input" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                            <small className="text-muted">mm/dd/yyyy</small>
                        </div>
                        <button className="btn btn-primary" type="submit">Save Semester</button>
                    </form>
                    {error && <div className="badge badge-danger mt-sm">{error}</div>}
                </div>
            )}

            <div className="card">
                <div className="flex items-center justify-between mb-sm">
                    <h3>Existing Semesters</h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => loadSemesters(isSuper ? selectedFaculty : user?.facultyId)}>Refresh</button>
                </div>
                {loading ? (
                    <div className="spinner" />
                ) : semesters.length === 0 ? (
                    <div className="text-muted">No semesters found.</div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Start Date</th>
                                    <th>End Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {semesters.map(s => (
                                    <tr key={s._id}>
                                        <td style={{ fontWeight: 600 }}>
                                            {editingId === s._id
                                                ? <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                                : s.name}
                                        </td>
                                        <td>
                                            {editingId === s._id
                                                ? <input className="input" type="date" value={editForm.startDate} onChange={e => setEditForm({ ...editForm, startDate: e.target.value })} />
                                                : formatDate(s.startDate)}
                                        </td>
                                        <td>
                                            {editingId === s._id
                                                ? <input className="input" type="date" value={editForm.endDate} onChange={e => setEditForm({ ...editForm, endDate: e.target.value })} />
                                                : formatDate(s.endDate)}
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
                                                    <button className="btn btn-sm btn-danger" onClick={() => deleteSemester(s._id)}>Delete</button>
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
import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function AdminFaculties() {
    const [faculties, setFaculties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        name: '',
        code: '',
        adminName: '',
        adminEmail: '',
        adminPassword: ''
    });

    const loadFaculties = async () => {
        try {
            setLoading(true);
            const res = await api.get('/faculties');
            setFaculties(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load faculties.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFaculties();
    }, []);

    const createFaculty = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await api.post('/faculties', form);
            setForm({ name: '', code: '', adminName: '', adminEmail: '', adminPassword: '' });
            setShowForm(false);
            loadFaculties();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create faculty.');
        }
    };

    const deleteFaculty = async (id) => {
        if (!window.confirm('Delete this faculty?')) return;
        try {
            await api.delete(`/faculties/${id}`);
            loadFaculties();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete faculty.');
        }
    };

    return (
        <div className="fade-in">
            <div className="flex items-center justify-between mb-md">
                <div>
                    <h1 style={{ fontWeight: 800 }}>Faculties</h1>
                    <p className="text-muted">Create and manage faculties and their administrators.</p>
                </div>
                <button
                    className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => setShowForm(!showForm)}
                >
                    {showForm ? (
                        <><i className="fa-solid fa-xmark"></i> Cancel</>
                    ) : (
                        <><i className="fa-solid fa-plus"></i> Add Faculty</>
                    )}
                </button>
            </div>

            {showForm && (
                <div className="card mb-lg slide-down">
                    <h3 className="mb-sm">Create Faculty &amp; Admin</h3>
                    <form className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }} onSubmit={createFaculty}>
                        <div className="input-group">
                            <label>Name</label>
                            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                        </div>
                        <div className="input-group">
                            <label>Code</label>
                            <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
                        </div>
                        <div className="input-group">
                            <label>Admin Name</label>
                            <input className="input" value={form.adminName} onChange={e => setForm({ ...form, adminName: e.target.value })} required />
                        </div>
                        <div className="input-group">
                            <label>Admin Email</label>
                            <input className="input" type="email" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} required />
                        </div>
                        <div className="input-group">
                            <label>Admin Password</label>
                            <input className="input" type="password" value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} required />
                        </div>
                        <button className="btn btn-primary" type="submit">Save</button>
                    </form>
                    {error && <div className="badge badge-danger mt-sm">{error}</div>}
                </div>
            )}

            <div className="card">
                <div className="flex items-center justify-between mb-sm">
                    <h3>Existing Faculties</h3>
                    <button className="btn btn-ghost btn-sm" onClick={loadFaculties}>Refresh</button>
                </div>
                {loading ? (
                    <div className="spinner" />
                ) : faculties.length === 0 ? (
                    <div className="text-muted">No faculties yet.</div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Code</th>
                                    <th>Admin</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {faculties.map(f => (
                                    <tr key={f._id}>
                                        <td style={{ fontWeight: 600 }}>{f.name}</td>
                                        <td>{f.code}</td>
                                        <td>{f.adminId ? 'Created' : '—'}</td>
                                        <td>
                                            <button className="btn btn-sm btn-danger" onClick={() => deleteFaculty(f._id)}>Delete</button>
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

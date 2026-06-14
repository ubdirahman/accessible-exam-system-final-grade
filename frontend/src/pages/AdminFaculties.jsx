import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import SearchInput from '../components/SearchInput';
import { matchesSearchQuery } from '../utils/search';
import useConfirmDialog from '../hooks/useConfirmDialog';

// Only allow letters (Latin + Arabic/Somali) and spaces in name fields
const nameOnly = (val) => val.replace(/[^a-zA-Z\s\u0600-\u06FF\-']/g, '');

const INITIAL_FORM = {
    name: '',
    code: '',
    adminName: '',
    adminEmail: '',
    adminPassword: ''
};

export default function AdminFaculties() {
    const [faculties, setFaculties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(INITIAL_FORM);
    const [searchTerm, setSearchTerm] = useState('');
    const [touched, setTouched] = useState({});

    const { confirmDialog, askConfirm } = useConfirmDialog();

    const loadFaculties = async () => {
        try {
            setLoading(true);
            setError('');
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

    const resetFormState = () => {
        setForm(INITIAL_FORM);
        setEditingId(null);
        setShowForm(false);
        setTouched({});
    };

    // Validate required fields
    const requiredFields = ['name', 'code', 'adminName', 'adminEmail'];
    const isFieldEmpty = (field) => !form[field]?.trim();
    const hasErrors = requiredFields.some(isFieldEmpty) || (!editingId && !form.adminPassword?.trim());

    const handleBlur = (field) => setTouched(prev => ({ ...prev, [field]: true }));
    const showError = (field) => touched[field] && isFieldEmpty(field);

    const createFaculty = async (e) => {
        e.preventDefault();
        setTouched({ name: true, code: true, adminName: true, adminEmail: true, adminPassword: true });
        if (hasErrors) return;
        setError('');
        try {
            await api.post('/faculties', form);
            resetFormState();
            await loadFaculties();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create faculty.');
        }
    };

    const startEdit = (faculty) => {
        setEditingId(faculty._id);
        setShowForm(true);
        setError('');
        setTouched({});
        setForm({
            name: faculty.name || '',
            code: faculty.code || '',
            adminName: faculty.admin?.name || '',
            adminEmail: faculty.admin?.email || '',
            adminPassword: ''
        });
    };

    const updateFaculty = async (e) => {
        e.preventDefault();
        setTouched({ name: true, code: true, adminName: true, adminEmail: true });
        if (requiredFields.some(isFieldEmpty)) return;
        setError('');
        try {
            await api.put(`/faculties/${editingId}`, form);
            resetFormState();
            await loadFaculties();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update faculty.');
        }
    };

    const deleteFaculty = async (id, name) => {
        const confirmed = await askConfirm({
            title: 'Delete Faculty?',
            message: `"${name}" faculty and all its data will be permanently removed. This cannot be undone.`,
            confirmText: 'Yes, Delete',
            type: 'danger'
        });
        if (!confirmed) return;

        // Optimistic update
        setFaculties(prev => prev.filter(f => f._id !== id));
        try {
            await api.delete(`/faculties/${id}`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete faculty.');
            await loadFaculties(); // Restore on error
        }
    };

    const isEditing = Boolean(editingId);
    const filteredFaculties = faculties.filter((faculty) => matchesSearchQuery(
        searchTerm,
        faculty.name,
        faculty.code,
        faculty.admin?.name,
        faculty.admin?.email
    ));

    return (
        <div className="fade-in">
            {confirmDialog}
            <div className="flex items-center justify-between mb-md">
                <div>
                    <h1 style={{ fontWeight: 800 }}>Faculties</h1>
                    <p className="text-muted">Create and manage faculties and their administrators.</p>
                </div>
                <button
                    className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => {
                        if (showForm) { resetFormState(); return; }
                        setError('');
                        setEditingId(null);
                        setForm(INITIAL_FORM);
                        setTouched({});
                        setShowForm(true);
                    }}
                >
                    {showForm ? (
                        <><i className="fa-solid fa-xmark" /> Cancel</>
                    ) : (
                        <><i className="fa-solid fa-plus" /> Add Faculty</>
                    )}
                </button>
            </div>

            {showForm && (
                <div className="card mb-lg slide-down">
                    <h3 className="mb-sm">{isEditing ? 'Edit Faculty & Admin' : 'Create Faculty & Admin'}</h3>
                    <form
                        className="grid"
                        style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
                        onSubmit={isEditing ? updateFaculty : createFaculty}
                    >
                        <div className="input-group">
                            <label>Faculty Name</label>
                            <input
                                className={`input${showError('name') ? ' input-error' : ''}`}
                                value={form.name}
                                onChange={e => setForm({ ...form, name: nameOnly(e.target.value) })}
                                onBlur={() => handleBlur('name')}
                                placeholder="e.g. Computer Science"
                            />
                            {showError('name') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> Required</span>}
                        </div>
                        <div className="input-group">
                            <label>Code</label>
                            <input
                                className={`input${showError('code') ? ' input-error' : ''}`}
                                value={form.code}
                                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                onBlur={() => handleBlur('code')}
                                placeholder="e.g. CS"
                            />
                            {showError('code') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> Required</span>}
                        </div>
                        <div className="input-group">
                            <label>Admin Name</label>
                            <input
                                className={`input${showError('adminName') ? ' input-error' : ''}`}
                                value={form.adminName}
                                onChange={e => setForm({ ...form, adminName: nameOnly(e.target.value) })}
                                onBlur={() => handleBlur('adminName')}
                                placeholder="e.g. Ahmed Ali"
                            />
                            {showError('adminName') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> Required</span>}
                        </div>
                        <div className="input-group">
                            <label>Admin Email</label>
                            <input
                                className={`input${showError('adminEmail') ? ' input-error' : ''}`}
                                type="email"
                                value={form.adminEmail}
                                onChange={e => setForm({ ...form, adminEmail: e.target.value })}
                                onBlur={() => handleBlur('adminEmail')}
                                placeholder="admin@faculty.edu"
                            />
                            {showError('adminEmail') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> Required</span>}
                        </div>
                        <div className="input-group">
                            <label>{isEditing ? 'New Admin Password' : 'Admin Password'}</label>
                            <input
                                className={`input${!isEditing && touched.adminPassword && !form.adminPassword?.trim() ? ' input-error' : ''}`}
                                type="password"
                                value={form.adminPassword}
                                onChange={e => setForm({ ...form, adminPassword: e.target.value })}
                                onBlur={() => handleBlur('adminPassword')}
                                required={!isEditing}
                                placeholder={isEditing ? 'Leave blank to keep current password' : 'Enter password'}
                            />
                            {!isEditing && touched.adminPassword && !form.adminPassword?.trim() && (
                                <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> Required</span>
                            )}
                        </div>
                        <button className="btn btn-primary" type="submit" style={{ alignSelf: 'end' }}>
                            {isEditing ? 'Update Faculty' : 'Save Faculty'}
                        </button>
                    </form>
                    {error && <div className="badge badge-danger mt-sm">{error}</div>}
                </div>
            )}

            <div className="card">
                <div className="flex items-center justify-between mb-sm">
                    <h3>Existing Faculties</h3>
                    <button className="btn btn-ghost btn-sm" onClick={loadFaculties}>Refresh</button>
                </div>
                <div className="mb-sm">
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Search by faculty name, code, admin name, or email"
                    />
                </div>
                {!showForm && error && <div className="badge badge-danger mb-sm">{error}</div>}
                {loading ? (
                    <div className="spinner" />
                ) : filteredFaculties.length === 0 ? (
                    <div className="text-muted">
                        {faculties.length === 0 ? 'No faculties yet.' : 'No faculties match your search.'}
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Code</th>
                                    <th>Admin</th>
                                    <th>Email</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFaculties.map((faculty) => (
                                    <tr key={faculty._id}>
                                        <td style={{ fontWeight: 600 }}>{faculty.name}</td>
                                        <td>{faculty.code}</td>
                                        <td>{faculty.admin?.name || 'No admin assigned'}</td>
                                        <td>{faculty.admin?.email || '-'}</td>
                                        <td>
                                            <div className="flex gap-sm">
                                                <button className="btn btn-sm btn-secondary" onClick={() => startEdit(faculty)}>Edit</button>
                                                <button className="btn btn-sm btn-danger" onClick={() => deleteFaculty(faculty._id, faculty.name)}>
                                                    <i className="fa-solid fa-trash" />
                                                </button>
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

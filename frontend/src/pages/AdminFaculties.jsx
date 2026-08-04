import { useEffect, useState } from 'react';
import api from '../api/axios';
import SearchInput from '../components/SearchInput';
import { matchesSearchQuery } from '../utils/search';
import useConfirmDialog from '../hooks/useConfirmDialog';

import { textOnly, isTextOnly, textAndNumberOnly, isTextAndNumberOnly, isValidCustomEmail } from '../utils/validators';

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

    const getFieldError = (field) => {
        if (field === 'name' && !form.name?.trim()) return 'Faculty Name is required';
        if (field === 'code') {
            if (!form.code?.trim()) return 'Faculty Code is required';
            if (!isTextAndNumberOnly(form.code)) return 'Faculty Code must contain letters and numbers only';
        }
        if (field === 'adminName') {
            if (!form.adminName?.trim()) return 'Admin Name is required';
            if (!isTextOnly(form.adminName)) return 'Admin Name must contain text only (letters and spaces)';
        }
        if (field === 'adminEmail') {
            if (!form.adminEmail?.trim()) return 'Admin Email is required';
            if (!isValidCustomEmail(form.adminEmail)) return 'Admin Email 3 xaraf ee ugu horeya waa in ay yihiin text, waxana lasoo raacin karaa kaliya text iyo number (e.g. abc123@domain.com)';
        }
        if (field === 'adminPassword' && !editingId && !form.adminPassword?.trim()) return 'Admin Password is required';
        return '';
    };

    const handleBlur = (field) => setTouched(prev => ({ ...prev, [field]: true }));
    const showError = (field) => touched[field] && getFieldError(field);
    const hasErrors = Boolean(
        getFieldError('name') ||
        getFieldError('code') ||
        getFieldError('adminName') ||
        getFieldError('adminEmail') ||
        (!editingId && getFieldError('adminPassword'))
    );

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
        if (hasErrors) return;
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

        setFaculties(prev => prev.filter(f => f._id !== id));
        try {
            await api.delete(`/faculties/${id}`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete faculty.');
            await loadFaculties();
        }
    };

    const isEditing = Boolean(editingId);
    const filteredFaculties = faculties.filter((faculty) => matchesSearchQuery(
        searchTerm,
        faculty.name,
        faculty.code,
        faculty.admin?.name,
        faculty.admin?.email,
        faculty.active === false ? 'inactive' : 'active'
    ));
    const activeFaculties = faculties.filter((faculty) => faculty.active !== false).length;
    const inactiveFaculties = faculties.length - activeFaculties;
    const facultyAdmins = faculties.filter((faculty) => faculty.admin).length;

    return (
        <div className="fade-in faculties-page">
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

            <div className="stats-grid faculty-stats">
                <div className="stat-card">
                    <div className="stat-value">{faculties.length}</div>
                    <div className="stat-label">Total Faculties</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{activeFaculties}</div>
                    <div className="stat-label">Active Faculties</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{facultyAdmins}</div>
                    <div className="stat-label">Faculty Admins</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{inactiveFaculties}</div>
                    <div className="stat-label">Inactive Faculties</div>
                </div>
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
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                onBlur={() => handleBlur('name')}
                                placeholder="e.g. Computer Science"
                            />
                            {showError('name') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> {getFieldError('name')}</span>}
                        </div>
                        <div className="input-group">
                            <label>Code (Text and numbers only)</label>
                            <input
                                className={`input${showError('code') ? ' input-error' : ''}`}
                                value={form.code}
                                onChange={e => setForm({ ...form, code: textAndNumberOnly(e.target.value) })}
                                onBlur={() => handleBlur('code')}
                                placeholder="e.g. CS"
                            />
                            {showError('code') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> {getFieldError('code')}</span>}
                        </div>
                        <div className="input-group">
                            <label>Admin Name (Text only)</label>
                            <input
                                className={`input${showError('adminName') ? ' input-error' : ''}`}
                                value={form.adminName}
                                onChange={e => setForm({ ...form, adminName: textOnly(e.target.value) })}
                                onBlur={() => handleBlur('adminName')}
                                placeholder="e.g. Ahmed Ali"
                            />
                            {showError('adminName') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> {getFieldError('adminName')}</span>}
                        </div>
                        <div className="input-group">
                            <label>Admin Email</label>
                            <input
                                className={`input${showError('adminEmail') ? ' input-error' : ''}`}
                                type="email"
                                value={form.adminEmail}
                                onChange={e => setForm({ ...form, adminEmail: e.target.value })}
                                onBlur={() => handleBlur('adminEmail')}
                                placeholder="e.g. abc123@faculty.edu"
                            />
                            {showError('adminEmail') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> {getFieldError('adminEmail')}</span>}
                        </div>
                        <div className="input-group">
                            <label>{isEditing ? 'New Admin Password' : 'Admin Password'}</label>
                            <input
                                className={`input${showError('adminPassword') ? ' input-error' : ''}`}
                                type="password"
                                value={form.adminPassword}
                                onChange={e => setForm({ ...form, adminPassword: e.target.value })}
                                onBlur={() => handleBlur('adminPassword')}
                                required={!isEditing}
                                placeholder={isEditing ? 'Leave blank to keep current password' : 'Enter password'}
                            />
                            {showError('adminPassword') && (
                                <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> {getFieldError('adminPassword')}</span>
                            )}
                        </div>
                        <button className="btn btn-primary" type="submit" style={{ alignSelf: 'end' }}>
                            {isEditing ? 'Update Faculty' : 'Save Faculty'}
                        </button>
                    </form>
                    {error && <div className="badge badge-danger mt-sm">{error}</div>}
                </div>
            )}

            <div className="card data-card faculties-table-card">
                <div className="flex items-center justify-between mb-md table-card-header">
                    <h3><i className="fa-solid fa-list" aria-hidden="true"></i> Existing Faculties</h3>
                    <div className="flex gap-sm">
                        <button className="btn btn-secondary btn-sm" onClick={loadFaculties}>
                            <i className="fa-solid fa-rotate-right" aria-hidden="true"></i> Refresh
                        </button>
                        <button className="btn btn-secondary btn-sm" type="button">
                            <i className="fa-solid fa-filter" aria-hidden="true"></i> Filters
                            <i className="fa-solid fa-chevron-down" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
                <div className="faculty-search-block mb-md">
                    <label>Search Faculties</label>
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
                                    <th>#</th>
                                    <th>Name</th>
                                    <th>Code</th>
                                    <th>Admin</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFaculties.map((faculty, index) => {
                                    const isActive = faculty.active !== false;
                                    return (
                                        <tr key={faculty._id}>
                                            <td><span className="row-index">{index + 1}</span></td>
                                            <td style={{ fontWeight: 700 }}>
                                                <span className="faculty-name-cell">
                                                    <span className="row-avatar" aria-hidden="true">
                                                        <i className="fa-solid fa-building-columns" />
                                                    </span>
                                                    {faculty.name}
                                                </span>
                                            </td>
                                            <td>{faculty.code}</td>
                                            <td>{faculty.admin?.name || 'No admin assigned'}</td>
                                            <td>{faculty.admin?.email || '-'}</td>
                                            <td>
                                                <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
                                                    {isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex gap-sm">
                                                    <button className="btn btn-sm btn-secondary" onClick={() => startEdit(faculty)}>
                                                        <i className="fa-solid fa-pen" aria-hidden="true"></i> Edit
                                                    </button>
                                                    <button className="btn btn-sm btn-danger" onClick={() => deleteFaculty(faculty._id, faculty.name)}>
                                                        <i className="fa-solid fa-trash" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {!loading && filteredFaculties.length > 0 && (
                    <div className="table-footer-line">
                        Showing 1 to {filteredFaculties.length} of {filteredFaculties.length} results
                    </div>
                )}
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import SearchInput from '../components/SearchInput';
import { matchesSearchQuery } from '../utils/search';
import useConfirmDialog from '../hooks/useConfirmDialog';

import { textOnly, isTextOnly, numberOnly, isNumberOnly, isValidCustomEmail } from '../utils/validators';

export default function AdminTeachers() {
    const { user } = useAuth();
    const isSuper = user?.role === 'super_admin';
    const [faculties, setFaculties] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState(user?.facultyId || '');
    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', password: '' });
    const [loading, setLoading] = useState(true);
    const [teacherLoading, setTeacherLoading] = useState(false);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', phone: '', address: '', active: true });
    const [classSearchTerm, setClassSearchTerm] = useState('');
    const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
    const [touched, setTouched] = useState({});

    const { confirmDialog, askConfirm } = useConfirmDialog();

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
            setLoading(true);
            const res = await api.get('/classes', { params: { facultyId } });
            setClasses(res.data);
        } catch (err) {
            setError('Failed to load classes.');
        } finally {
            setLoading(false);
        }
    };

    const loadTeachers = async (classId) => {
        if (!classId) return;
        try {
            setTeacherLoading(true);
            const fid = isSuper ? selectedFaculty : user?.facultyId;
            const res = await api.get('/teachers', { params: { facultyId: fid, classId } });
            setTeachers(res.data);
        } catch (err) {
            setError('Failed to load teachers.');
        } finally {
            setTeacherLoading(false);
        }
    };

    useEffect(() => { loadFaculties(); }, []);

    useEffect(() => {
        const fid = isSuper ? selectedFaculty : user?.facultyId;
        if (fid) loadClasses(fid);
    }, [selectedFaculty, isSuper, user?.facultyId]);

    useEffect(() => {
        if (selectedClass) loadTeachers(selectedClass._id);
    }, [selectedClass]);

    // Form validation
    const getFieldError = (field) => {
        if (field === 'name') {
            if (!form.name?.trim()) return 'Full Name is required';
            if (!isTextOnly(form.name)) return 'Full Name must contain text only (letters and spaces)';
        }
        if (field === 'phone') {
            if (!form.phone?.trim()) return 'Phone number is required';
            if (!isNumberOnly(form.phone)) return 'Phone number must contain numbers only';
        }
        if (field === 'email') {
            if (!form.email?.trim()) return 'Email address is required';
            if (!isValidCustomEmail(form.email)) return 'Email 3 xaraf ee ugu horeya waa in ay yihiin text, waxana lasoo raacin karaa kaliya text iyo number (e.g. abc123@domain.com)';
        }
        if (field === 'password') {
            if (!form.password?.trim()) return 'Password is required';
        }
        return '';
    };

    const showError = (field) => touched[field] && getFieldError(field);
    const hasErrors = Boolean(getFieldError('name') || getFieldError('phone') || getFieldError('email') || getFieldError('password'));

    const addTeacher = async (e) => {
        e.preventDefault();
        setTouched({ name: true, email: true, phone: true, password: true });
        if (hasErrors) return;
        setError('');
        try {
            const facultyId = isSuper ? selectedFaculty : user?.facultyId;
            const payload = { ...form, classId: selectedClass._id, facultyId };
            await api.post('/teachers', payload);
            setForm({ name: '', email: '', phone: '', address: '', password: '' });
            setShowForm(false);
            setTouched({});
            loadTeachers(selectedClass._id);
        } catch (err) {
            setError(err.response?.data?.message || 'Error creating teacher.');
        }
    };

    const deleteTeacher = async (id, name) => {
        const confirmed = await askConfirm({
            title: 'Delete Teacher?',
            message: `"${name}" will be permanently removed from this class.`,
            confirmText: 'Yes, Delete',
            type: 'danger'
        });
        if (!confirmed) return;

        // Optimistic update
        setTeachers(prev => prev.filter(t => t._id !== id));
        try {
            const facultyId = isSuper ? selectedFaculty : user?.facultyId;
            await api.delete(`/teachers/${id}`, { params: { facultyId } });
        } catch (err) {
            setError('Error deleting teacher.');
            loadTeachers(selectedClass._id); // Restore on error
        }
    };

    const startEdit = (t) => {
        setEditingId(t._id);
        setEditForm({ name: t.name, phone: t.phone, address: t.address || '', active: !!t.active });
    };

    const saveEdit = async () => {
        if (!editForm.name?.trim() || !isTextOnly(editForm.name)) {
            setError('Teacher name must contain text only.');
            return;
        }
        if (!editForm.phone?.trim() || !isNumberOnly(editForm.phone)) {
            setError('Teacher phone must contain numbers only.');
            return;
        }
        try {
            const facultyId = isSuper ? selectedFaculty : user?.facultyId;
            await api.put(`/teachers/${editingId}`, { ...editForm, facultyId });
            setEditingId(null);
            setError('');
            loadTeachers(selectedClass._id);
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving teacher.');
        }
    };

    const filteredClasses = classes.filter((classroom) => matchesSearchQuery(classSearchTerm, classroom.name, classroom.code));
    const filteredTeachers = teachers.filter((teacher) => matchesSearchQuery(teacherSearchTerm, teacher.name, teacher.email, teacher.phone, teacher.address, teacher._id));

    if (loading && !selectedClass) return <div className="spinner" />;

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
                            <h1 style={{ fontWeight: 800, marginBottom: 4 }}>Teachers: {selectedClass.name}</h1>
                            <div className="class-code">Class Code: {selectedClass.code || 'N/A'}</div>
                        </div>
                        <button className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'}`} onClick={() => { setShowForm(!showForm); setTouched({}); }}>
                            {showForm ? 'Cancel' : <><i className="fa-solid fa-plus" /> Add Teacher</>}
                        </button>
                    </div>
                </div>

                {showForm && (
                    <div className="card mb-lg slide-down">
                        <h3 className="mb-sm">Register New Teacher</h3>
                        <form className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }} onSubmit={addTeacher}>
                            <div className="input-group">
                                <label>Full Name (Text only)</label>
                                <input
                                    className={`input${showError('name') ? ' input-error' : ''}`}
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: textOnly(e.target.value) })}
                                    onBlur={() => setTouched(p => ({ ...p, name: true }))}
                                    placeholder="e.g. Ahmed Ali"
                                />
                                {showError('name') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> {getFieldError('name')}</span>}
                            </div>
                            <div className="input-group">
                                <label>Email Address</label>
                                <input
                                    className={`input${showError('email') ? ' input-error' : ''}`}
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    onBlur={() => setTouched(p => ({ ...p, email: true }))}
                                    placeholder="e.g. abc123@faculty.edu"
                                />
                                {showError('email') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> {getFieldError('email')}</span>}
                            </div>
                            <div className="input-group">
                                <label>Phone Number (Numbers only)</label>
                                <input
                                    className={`input${showError('phone') ? ' input-error' : ''}`}
                                    value={form.phone}
                                    onChange={e => setForm({ ...form, phone: numberOnly(e.target.value) })}
                                    onBlur={() => setTouched(p => ({ ...p, phone: true }))}
                                    placeholder="e.g. 612345678"
                                />
                                {showError('phone') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> {getFieldError('phone')}</span>}
                            </div>
                            <div className="input-group">
                                <label>Password</label>
                                <input
                                    className={`input${showError('password') ? ' input-error' : ''}`}
                                    type="password"
                                    value={form.password}
                                    onChange={e => setForm({ ...form, password: e.target.value })}
                                    onBlur={() => setTouched(p => ({ ...p, password: true }))}
                                    placeholder="Set login password"
                                />
                                {showError('password') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> {getFieldError('password')}</span>}
                            </div>
                            <div className="input-group">
                                <label>Residential Address</label>
                                <input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Optional" />
                            </div>
                            <button className="btn btn-success" type="submit" style={{ alignSelf: 'end' }}>Register Teacher</button>
                        </form>
                        {error && <div className="badge badge-danger mt-sm">{error}</div>}
                    </div>
                )}

                <div className="card">
                    <div className="mb-sm">
                        <SearchInput value={teacherSearchTerm} onChange={setTeacherSearchTerm} placeholder="Search by teacher name, email, phone, address, or ID" />
                    </div>
                    {teacherLoading ? (
                        <div className="spinner" />
                    ) : filteredTeachers.length === 0 ? (
                        <div className="text-center py-lg text-muted">
                            {teachers.length === 0 ? 'No teachers registered for this class.' : 'No teachers match your search.'}
                        </div>
                    ) : (
                        <div className="table-wrapper" style={{ padding: 0 }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Instructor Details</th>
                                        <th>Contact Info</th>
                                        <th>Account Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTeachers.map(t => (
                                        <tr key={t._id}>
                                            <td>
                                                {editingId === t._id ? (
                                                    <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: textOnly(e.target.value) })} />
                                                ) : (
                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                                                )}
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: {t._id.slice(-6).toUpperCase()}</div>
                                            </td>
                                            <td>
                                                <div>{t.email}</div>
                                                {editingId === t._id ? (
                                                    <input className="input" style={{ marginTop: 4 }} value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: numberOnly(e.target.value) })} />
                                                ) : (
                                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.phone}</div>
                                                )}
                                            </td>
                                            <td>
                                                {editingId === t._id ? (
                                                    <label className="flex items-center gap-xs cursor-pointer">
                                                        <input type="checkbox" checked={editForm.active} onChange={e => setEditForm({ ...editForm, active: e.target.checked })} />
                                                        <span>Active</span>
                                                    </label>
                                                ) : (
                                                    <span className={`badge ${t.active ? 'badge-success' : 'badge-danger'}`}>
                                                        {t.active ? 'Active' : 'Disabled'}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex gap-sm">
                                                    {editingId === t._id ? (
                                                        <>
                                                            <button className="btn btn-sm btn-success" onClick={saveEdit}>Save</button>
                                                            <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button className="btn btn-sm btn-secondary" onClick={() => startEdit(t)} title="Edit">
                                                                <i className="fa-solid fa-pen-to-square" />
                                                            </button>
                                                            <button className="btn btn-sm btn-danger" onClick={() => deleteTeacher(t._id, t.name)} title="Delete">
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
                {error && <div className="badge badge-danger mt-md">{error}</div>}
            </div>
        );
    }

    return (
        <div className="fade-in">
            {confirmDialog}
            <div className="flex items-center justify-between mb-lg">
                <div>
                    <h1 style={{ fontWeight: 800 }}>Teacher Management</h1>
                    <p className="text-muted">Select a class to manage its assigned teaching staff.</p>
                </div>
            </div>

            {isSuper && (
                <div className="card mb-md">
                    <label style={{ fontWeight: 600, marginBottom: 8 }}>Select Faculty Scope</label>
                    <select className="input" value={selectedFaculty} onChange={e => setSelectedFaculty(e.target.value)}>
                        <option value="">Choose academic faculty</option>
                        {faculties.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                    </select>
                </div>
            )}

            {loading ? (
                <div className="spinner" />
            ) : classes.length === 0 ? (
                <div className="card text-center py-xl">
                    <div className="text-muted">No classes found. Please create classes first to assign teachers.</div>
                </div>
            ) : (
                <>
                    <div className="card mb-md">
                        <SearchInput value={classSearchTerm} onChange={setClassSearchTerm} placeholder="Search classes by name or code" />
                    </div>
                    <div className="class-grid">
                    {filteredClasses.map(c => (
                        <div key={c._id} className="class-card teacher-class-card" onClick={() => setSelectedClass(c)}>
                            <div className="class-badge">Faculty Staff</div>
                            <div>
                                <div className="class-name">{c.name}</div>
                                <div className="class-code">{c.code || 'No Code'}</div>
                            </div>
                            <div className="class-info">
                                <i className="fa-solid fa-user-tie" /> Manage Class Teachers
                            </div>
                        </div>
                    ))}
                    </div>
                    {filteredClasses.length === 0 && (
                        <div className="card text-center py-xl">
                            <div className="text-muted">No classes match your search.</div>
                        </div>
                    )}
                </>
            )}
            {error && <div className="badge badge-danger mt-md">{error}</div>}
        </div>
    );
}

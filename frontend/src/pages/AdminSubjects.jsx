import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import SearchInput from '../components/SearchInput';
import { matchesSearchQuery } from '../utils/search';
import useConfirmDialog from '../hooks/useConfirmDialog';

import { textOnly, isTextOnly, textAndNumberOnly, isTextAndNumberOnly } from '../utils/validators';

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
    const [searchTerm, setSearchTerm] = useState('');
    const [touched, setTouched] = useState({});

    const { confirmDialog, askConfirm } = useConfirmDialog();

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

    useEffect(() => { loadFaculties(); }, []);

    useEffect(() => {
        const fid = isSuper ? selectedFaculty : user?.facultyId;
        if (fid) {
            loadClasses(fid);
            loadTeachers(fid);
            loadSubjects(fid);
        }
    }, [selectedFaculty, user?.facultyId, isSuper]);

    // Form validation
    const getFieldError = (field) => {
        if (field === 'name') {
            if (!form.name?.trim()) return 'Subject Name is required';
            if (!isTextOnly(form.name)) return 'Subject Name must contain text only (letters and spaces)';
        }
        if (field === 'code' && form.code?.trim()) {
            if (!isTextAndNumberOnly(form.code)) return 'Subject Code must contain letters and numbers only';
        }
        if (field === 'classId' && !form.classId?.trim()) return 'Class selection is required';
        if (field === 'teacherId' && !form.teacherId?.trim()) return 'Teacher selection is required';
        return '';
    };

    const showError = (field) => touched[field] && getFieldError(field);
    const hasErrors = Boolean(
        getFieldError('name') ||
        (form.code?.trim() && getFieldError('code')) ||
        getFieldError('classId') ||
        getFieldError('teacherId')
    );

    const createSubject = async (e) => {
        e.preventDefault();
        setTouched({ name: true, code: true, classId: true, teacherId: true });
        if (hasErrors) return;
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        if (!facultyId) return setError('Select a faculty first.');
        try {
            await api.post('/subjects', { ...form, facultyId });
            setForm({ name: '', code: '', classId: '', teacherId: '' });
            setShowAddForm(false);
            setTouched({});
            setError('');
            loadSubjects(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create subject');
        }
    };

    const deleteSubject = async (id, name) => {
        const confirmed = await askConfirm({
            title: 'Delete Subject?',
            message: `"${name}" will be permanently removed from the system.`,
            confirmText: 'Yes, Delete',
            type: 'danger'
        });
        if (!confirmed) return;

        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        // Optimistic update
        setSubjects(prev => prev.filter(s => s._id !== id));
        try {
            await api.delete(`/subjects/${id}`, { params: { facultyId } });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete subject');
            loadSubjects(facultyId);
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
        if (!editForm.name?.trim() || !isTextOnly(editForm.name)) {
            setError('Subject Name must contain text only.');
            return;
        }
        if (editForm.code?.trim() && !isTextAndNumberOnly(editForm.code)) {
            setError('Subject Code must contain letters and numbers only.');
            return;
        }
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        try {
            await api.put(`/subjects/${editingId}`, { ...editForm, facultyId });
            setEditingId(null);
            setError('');
            loadSubjects(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save subject');
        }
    };

    const filteredSubjects = subjects.filter((subject) => matchesSearchQuery(
        searchTerm, subject.name, subject.code, subject.classId?.name, subject.teacherId?.name
    ));

    return (
        <div className="fade-in">
            {confirmDialog}
            <div className="flex items-center justify-between mb-md">
                <h1 style={{ fontWeight: 800 }}>Subjects</h1>
                <button
                    className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => { setShowAddForm(!showAddForm); setTouched({}); setError(''); }}
                >
                    {showAddForm ? (
                        <><i className="fa-solid fa-xmark" aria-hidden="true" /> Cancel</>
                    ) : (
                        <><i className="fa-solid fa-plus" aria-hidden="true" /> Add Subject</>
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
                            <label>Subject Name (Text only)</label>
                            <input
                                className={`input${showError('name') ? ' input-error' : ''}`}
                                value={form.name}
                                onChange={e => setForm({ ...form, name: textOnly(e.target.value) })}
                                onBlur={() => setTouched(p => ({ ...p, name: true }))}
                                placeholder="e.g. Mathematics"
                            />
                            {showError('name') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> {getFieldError('name')}</span>}
                        </div>
                        <div className="input-group">
                            <label>Code (Text and numbers only)</label>
                            <input
                                className={`input${showError('code') ? ' input-error' : ''}`}
                                value={form.code}
                                onChange={e => setForm({ ...form, code: textAndNumberOnly(e.target.value) })}
                                onBlur={() => setTouched(p => ({ ...p, code: true }))}
                                placeholder="e.g. MATH101"
                            />
                            {showError('code') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> {getFieldError('code')}</span>}
                        </div>
                        <div className="input-group">
                            <label>Class</label>
                            <select
                                className={`input${showError('classId') ? ' input-error' : ''}`}
                                value={form.classId}
                                onChange={e => setForm({ ...form, classId: e.target.value, teacherId: '' })}
                                onBlur={() => setTouched(p => ({ ...p, classId: true }))}
                            >
                                <option value="">Select class</option>
                                {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                            {showError('classId') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> {getFieldError('classId')}</span>}
                        </div>
                        <div className="input-group">
                            <label>Teacher</label>
                            <select
                                className={`input${showError('teacherId') ? ' input-error' : ''}`}
                                value={form.teacherId}
                                onChange={e => setForm({ ...form, teacherId: e.target.value })}
                                onBlur={() => setTouched(p => ({ ...p, teacherId: true }))}
                            >
                                <option value="">Select teacher</option>
                                {teachers.filter(t => (t.classId?._id || t.classId) === form.classId).map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                            {showError('teacherId') && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> {getFieldError('teacherId')}</span>}
                        </div>
                        <button className="btn btn-primary" type="submit" style={{ alignSelf: 'end' }}>Add New Subject</button>
                    </form>
                    {error && <div className="badge badge-danger mt-sm">{error}</div>}
                </div>
            )}

            <div className="card">
                <div className="flex items-center justify-between mb-sm">
                    <h3>Existing Subjects</h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => loadSubjects(isSuper ? selectedFaculty : user?.facultyId)}>Refresh</button>
                </div>
                <div className="mb-sm">
                    <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search by subject name, code, class, or teacher" />
                </div>
                {loading ? (
                    <div className="spinner" />
                ) : filteredSubjects.length === 0 ? (
                    <div className="text-muted">
                        {subjects.length === 0 ? 'No subjects found.' : 'No subjects match your search.'}
                    </div>
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
                                {filteredSubjects.map(s => (
                                    <tr key={s._id}>
                                        <td style={{ fontWeight: 600 }}>
                                            {editingId === s._id
                                                ? <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: textOnly(e.target.value) })} />
                                                : s.name}
                                        </td>
                                        <td>
                                            {editingId === s._id
                                                ? <input className="input" value={editForm.code} onChange={e => setEditForm({ ...editForm, code: textAndNumberOnly(e.target.value) })} />
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
                                                        {teachers.filter(t => (t.classId?._id || t.classId) === editForm.classId).map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
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
                                                    <button className="btn btn-sm btn-danger" onClick={() => deleteSubject(s._id, s.name)}>
                                                        <i className="fa-solid fa-trash" />
                                                    </button>
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

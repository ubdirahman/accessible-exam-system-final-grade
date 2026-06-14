import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import SearchInput from '../components/SearchInput';
import { matchesSearchQuery } from '../utils/search';
import useConfirmDialog from '../hooks/useConfirmDialog';

// Only allow letters (Latin + Arabic/Somali) and spaces in name fields
const nameOnly = (val) => val.replace(/[^a-zA-Z\s\u0600-\u06FF\-']/g, '');

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
    const [semesterSearchTerm, setSemesterSearchTerm] = useState('');
    const [classSearchTerm, setClassSearchTerm] = useState('');
    const [touched, setTouched] = useState({});

    // Semester detailing
    const [selectedSemester, setSelectedSemester] = useState(null);
    const [semesterClasses, setSemesterClasses] = useState([]);
    const [classLoading, setClassLoading] = useState(false);

    const { confirmDialog, askConfirm } = useConfirmDialog();

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

    const loadSemesterClasses = async (semesterId) => {
        try {
            setClassLoading(true);
            const facultyId = isSuper ? selectedFaculty : user?.facultyId;
            const res = await api.get('/classes', { params: { facultyId, semesterId } });
            setSemesterClasses(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load classes');
        } finally {
            setClassLoading(false);
        }
    };

    useEffect(() => { loadFaculties(); }, []);

    useEffect(() => {
        const fid = isSuper ? selectedFaculty : user?.facultyId;
        if (fid) loadSemesters(fid);
    }, [selectedFaculty, user?.facultyId, isSuper]);

    useEffect(() => {
        if (selectedSemester) loadSemesterClasses(selectedSemester._id);
    }, [selectedSemester]);

    const isNameEmpty = () => !form.name?.trim();
    const showNameError = () => touched.name && isNameEmpty();

    const createSemester = async (e) => {
        e.preventDefault();
        setTouched({ name: true });
        if (isNameEmpty()) return;
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        if (!facultyId) return setError('Select a faculty first.');
        try {
            await api.post('/semesters', { ...form, facultyId });
            setForm({ name: '', startDate: '', endDate: '' });
            setShowAddForm(false);
            setTouched({});
            loadSemesters(facultyId);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create semester');
        }
    };

    const deleteSemester = async (e, id, name) => {
        e.stopPropagation();
        const facultyId = isSuper ? selectedFaculty : user?.facultyId;
        if (!facultyId) return;

        const confirmed = await askConfirm({
            title: 'Delete Semester?',
            message: `"${name}" and all its associated classes will be permanently deleted.`,
            confirmText: 'Yes, Delete',
            type: 'danger'
        });
        if (!confirmed) return;

        // Optimistic update
        setSemesters(prev => prev.filter(s => s._id !== id));
        if (selectedSemester?._id === id) setSelectedSemester(null);

        try {
            await api.delete(`/semesters/${id}`, { params: { facultyId } });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete semester');
            loadSemesters(facultyId); // Restore on error
        }
    };

    const startEdit = (e, s) => {
        e.stopPropagation();
        setEditingId(s._id);
        setEditForm({
            name: s.name,
            startDate: s.startDate ? new Date(s.startDate).toISOString().split('T')[0] : '',
            endDate: s.endDate ? new Date(s.endDate).toISOString().split('T')[0] : ''
        });
    };

    const saveEdit = async (e) => {
        e.stopPropagation();
        if (!editForm.name?.trim()) return;
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
    };

    const filteredSemesters = semesters.filter((semester) => matchesSearchQuery(
        semesterSearchTerm,
        semester.name,
        formatDate(semester.startDate),
        formatDate(semester.endDate)
    ));

    const filteredSemesterClasses = semesterClasses.filter((classroom) => matchesSearchQuery(
        classSearchTerm,
        classroom.name,
        classroom.code
    ));

    if (selectedSemester) {
        return (
            <div className="fade-in">
                {confirmDialog}
                <div className="back-link" onClick={() => setSelectedSemester(null)}>
                    <i className="fa-solid fa-arrow-left" /> Back to Semesters
                </div>

                <div className="detail-header">
                    <div className="detail-title-row">
                        <div>
                            <h1 style={{ fontWeight: 800, marginBottom: 4 }}>{selectedSemester.name}</h1>
                            <div className="class-code">
                                {formatDate(selectedSemester.startDate)} - {formatDate(selectedSemester.endDate)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <h3 className="mb-md">Classes in this Semester</h3>
                    <div className="mb-sm">
                        <SearchInput
                            value={classSearchTerm}
                            onChange={setClassSearchTerm}
                            placeholder="Search semester classes by name or code"
                        />
                    </div>
                    {classLoading ? (
                        <div className="spinner" />
                    ) : filteredSemesterClasses.length === 0 ? (
                        <div className="text-muted">
                            {semesterClasses.length === 0 ? 'No classes found for this semester.' : 'No classes match your search.'}
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Class Name</th>
                                        <th>Code</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSemesterClasses.map(c => (
                                        <tr key={c._id}>
                                            <td style={{ fontWeight: 600 }}>{c.name}</td>
                                            <td>{c.code || '—'}</td>
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
            <div className="flex items-center justify-between mb-md">
                <div>
                    <h1 style={{ fontWeight: 800 }}>Manage Semesters</h1>
                    <p className="text-muted">Create and manage semesters for your academic calendar.</p>
                </div>
                <button
                    className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => { setShowAddForm(!showAddForm); setTouched({}); }}
                >
                    {showAddForm ? (
                        <><i className="fa-solid fa-xmark" /> Cancel</>
                    ) : (
                        <><i className="fa-solid fa-plus" /> Add Semester</>
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
                    <h3 className="mb-sm">Add New Semester</h3>
                    <form className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }} onSubmit={createSemester}>
                        <div className="input-group">
                            <label>Semester Name</label>
                            <input
                                className={`input${showNameError() ? ' input-error' : ''}`}
                                value={form.name}
                                onChange={e => setForm({ ...form, name: nameOnly(e.target.value) })}
                                onBlur={() => setTouched(p => ({ ...p, name: true }))}
                                placeholder="e.g., Fall 2024"
                            />
                            {showNameError() && <span className="input-error-text"><i className="fa-solid fa-circle-exclamation" /> Required</span>}
                        </div>
                        <div className="input-group">
                            <label>Start Date</label>
                            <input className="input" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                        </div>
                        <div className="input-group">
                            <label>End Date</label>
                            <input className="input" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                        </div>
                        <button className="btn btn-primary" type="submit" style={{ alignSelf: 'end' }}>Save Semester</button>
                    </form>
                    {error && <div className="badge badge-danger mt-sm">{error}</div>}
                </div>
            )}

            {loading ? (
                <div className="spinner" />
            ) : semesters.length === 0 ? (
                <div className="card text-center py-lg">
                    <div className="text-muted">No semesters found. Click "Add Semester" to create one.</div>
                </div>
            ) : (
                <>
                    <div className="card mb-md">
                        <SearchInput
                            value={semesterSearchTerm}
                            onChange={setSemesterSearchTerm}
                            placeholder="Search semesters by name or dates"
                        />
                    </div>
                    <div className="class-grid">
                    {filteredSemesters.map(s => (
                        <div key={s._id} className="class-card" onClick={() => setSelectedSemester(s)}>
                            <div className="class-badge">Active</div>
                            <div>
                                <div className="class-name">
                                    {editingId === s._id ? (
                                        <input
                                            className="input"
                                            value={editForm.name}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => setEditForm({ ...editForm, name: nameOnly(e.target.value) })}
                                        />
                                    ) : s.name}
                                </div>
                                <div className="class-code">
                                    {formatDate(s.startDate)} - {formatDate(s.endDate)}
                                </div>
                            </div>

                            <div className="class-info">
                                <i className="fa-solid fa-calendar-days" />
                                View Classes &amp; Schedule
                            </div>

                            <div className="class-actions-overlay">
                                {editingId === s._id ? (
                                    <>
                                        <button className="btn btn-sm btn-success" onClick={saveEdit}>Save</button>
                                        <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>Cancel</button>
                                    </>
                                ) : (
                                    <>
                                        <button className="btn btn-sm btn-secondary" onClick={(e) => startEdit(e, s)}>
                                            <i className="fa-solid fa-pen-to-square" />
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={(e) => deleteSemester(e, s._id, s.name)}>
                                            <i className="fa-solid fa-trash" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    </div>
                    {filteredSemesters.length === 0 && (
                        <div className="card text-center py-lg">
                            <div className="text-muted">No semesters match your search.</div>
                        </div>
                    )}
                </>
            )}
            {error && <div className="badge badge-danger mt-md">{error}</div>}
        </div>
    );
}

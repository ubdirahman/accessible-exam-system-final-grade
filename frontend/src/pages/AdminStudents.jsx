import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTTS } from '../hooks/useTTS';
import api from '../api/axios';

export default function AdminStudents() {
    const { speak } = useTTS();
    const { user } = useAuth();
    const isSuper = user?.role === 'super_admin';

    const [faculties, setFaculties] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState(user?.facultyId || '');
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showStudentForm, setShowStudentForm] = useState(false);
    const [newStudent, setNewStudent] = useState({ name: '', studentId: '', email: '', classId: '' });
    const [error, setError] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', classId: '' });

    const loadFaculties = async () => {
        if (!isSuper) return;
        try {
            const res = await api.get('/faculties');
            setFaculties(res.data);
            if (!selectedFaculty && res.data.length > 0) {
                setSelectedFaculty(res.data[0]._id);
            }
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

    const loadStudents = async () => {
        try {
            setLoading(true);
            const params = isSuper && selectedFaculty ? { facultyId: selectedFaculty } : {};
            const res = await api.get('/exams/students', { params });
            setStudents(res.data);
        } catch (err) {
            setError('Failed to load students.');
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
            loadStudents();
        }
    }, [selectedFaculty, isSuper]);

    const addStudent = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...newStudent };
            if (isSuper) {
                payload.facultyId = selectedFaculty;
            }
            await api.post('/exams/students', payload);
            setNewStudent({ name: '', studentId: '', email: '', classId: '' });
            setShowStudentForm(false);
            loadStudents();
        } catch (err) {
            alert(err.response?.data?.message || 'Error adding student');
        }
    };

    const deleteStudent = async (studentId) => {
        if (!confirm('Delete this student?')) return;
        try {
            const params = isSuper && selectedFaculty ? { facultyId: selectedFaculty } : {};
            await api.delete(`/exams/students/${studentId}`, { params });
            loadStudents();
        } catch (err) {
            console.error('Delete student error:', err);
        }
    };

    const startEdit = (s) => {
        setEditingId(s._id);
        setEditForm({ name: s.name, email: s.email || '', classId: s.classId || '' });
    };

    const saveEdit = async () => {
        try {
            const params = isSuper && selectedFaculty ? { facultyId: selectedFaculty } : {};
            await api.put(`/exams/students/${students.find(s => s._id === editingId).studentId}`, {
                name: editForm.name,
                email: editForm.email,
                classId: editForm.classId,
                facultyId: selectedFaculty
            }, { params });
            setEditingId(null);
            loadStudents();
        } catch (err) {
            alert(err.response?.data?.message || 'Error saving student');
        }
    };

    if (loading) return <div className="spinner"></div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-md">
                <h2 style={{ fontWeight: 700 }}><i className="fa-solid fa-user-graduate" aria-hidden="true"></i> List of Students</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setShowStudentForm(!showStudentForm)}>
                    {showStudentForm ? <><i className="fa-solid fa-circle-xmark" aria-hidden="true"></i> Cancel</> : <><i className="fa-solid fa-plus" aria-hidden="true"></i> Add Student</>}
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

            {showStudentForm && (
                <div className="card mb-md slide-in">
                    <form onSubmit={addStudent} className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                        <div className="input-group">
                            <label>Name</label>
                            <input className="input" value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} required />
                        </div>
                        <div className="input-group">
                            <label>Student ID</label>
                            <input className="input" value={newStudent.studentId} onChange={e => setNewStudent({ ...newStudent, studentId: e.target.value })} required />
                        </div>
                        <div className="input-group">
                            <label>Email</label>
                            <input className="input" type="email" value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} />
                        </div>
                        <div className="input-group">
                            <label>Class</label>
                            <select className="input" value={newStudent.classId} onChange={e => setNewStudent({ ...newStudent, classId: e.target.value })} required>
                                <option value="">Select class</option>
                                {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="btn btn-success">Save</button>
                    </form>
                </div>
            )}

            {error && <div className="badge badge-danger mb-md">{error}</div>}

            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Student ID</th>
                            <th>Email</th>
                            <th>Class</th>
                            <th>Exams Taken</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((s) => {
                            const cls = classes.find(c => c._id === s.classId);
                            return (
                                <tr key={s._id}>
                                    <td style={{ fontWeight: 600 }}>
                                        {editingId === s._id
                                            ? <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                            : s.name}
                                    </td>
                                    <td>{s.studentId}</td>
                                    <td>
                                        {editingId === s._id
                                            ? <input className="input" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                                            : (s.email || '—')}
                                    </td>
                                    <td>
                                        {editingId === s._id
                                            ? (
                                                <select className="input" value={editForm.classId} onChange={e => setEditForm({ ...editForm, classId: e.target.value })}>
                                                    <option value="">Select class</option>
                                                    {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                                </select>
                                            ) : (cls ? cls.name : '—')}
                                    </td>
                                    <td>{s.examCodes?.length || 0}</td>
                                    <td>
                                        {editingId === s._id ? (
                                            <>
                                                <button className="btn btn-sm btn-success" onClick={saveEdit}><i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save</button>
                                                <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}><i className="fa-solid fa-circle-xmark" aria-hidden="true"></i></button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="btn btn-sm btn-info" onClick={() => startEdit(s)}><i className="fa-solid fa-pen" aria-hidden="true"></i> Edit</button>
                                                <button className="btn btn-sm btn-danger" onClick={() => deleteStudent(s.studentId)}>
                                                    <i className="fa-solid fa-trash" aria-hidden="true"></i> Delete
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {students.length === 0 && (
                            <tr><td colSpan="6" className="text-center text-muted" style={{ padding: 40 }}>No students registered.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

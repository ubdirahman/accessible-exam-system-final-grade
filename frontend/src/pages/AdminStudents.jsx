import { useState, useEffect } from 'react';
import { useTTS } from '../hooks/useTTS';
import api from '../api/axios';

export default function AdminStudents() {
    const { speak } = useTTS();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showStudentForm, setShowStudentForm] = useState(false);
    const [newStudent, setNewStudent] = useState({ name: '', studentId: '', email: '' });
    const [error, setError] = useState(null);

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        try {
            setLoading(true);
            const res = await api.get('/exams/students');
            setStudents(res.data);
        } catch (err) {
            setError('Failed to load students.');
        } finally {
            setLoading(false);
        }
    };

    const addStudent = async (e) => {
        e.preventDefault();
        try {
            await api.post('/exams/students', newStudent);
            setNewStudent({ name: '', studentId: '', email: '' });
            setShowStudentForm(false);
            loadStudents();
        } catch (err) {
            alert(err.response?.data?.message || 'Error adding student');
        }
    };

    const deleteStudent = async (studentId) => {
        if (!confirm('Delete this student?')) return;
        try {
            await api.delete(`/exams/students/${studentId}`);
            loadStudents();
        } catch (err) {
            console.error('Delete student error:', err);
        }
    };

    if (loading) return <div className="spinner"></div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-md">
                <h2 style={{ fontWeight: 700 }}>🎓 List of Students</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setShowStudentForm(!showStudentForm)}>
                    {showStudentForm ? '✖️ Cancel' : '➕ Add Student'}
                </button>
            </div>

            {showStudentForm && (
                <div className="card mb-md slide-in">
                    <form onSubmit={addStudent} className="flex gap-md" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="input-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
                            <label>Name</label>
                            <input className="input" value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} required />
                        </div>
                        <div className="input-group" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
                            <label>Student ID</label>
                            <input className="input" value={newStudent.studentId} onChange={e => setNewStudent({ ...newStudent, studentId: e.target.value })} required />
                        </div>
                        <div className="input-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
                            <label>Email</label>
                            <input className="input" type="email" value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} />
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
                            <th>Exams Taken</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((s) => (
                            <tr key={s._id}>
                                <td style={{ fontWeight: 600 }}>{s.name}</td>
                                <td>{s.studentId}</td>
                                <td>{s.email || '—'}</td>
                                <td>{s.examCodes?.length || 0}</td>
                                <td>
                                    <button className="btn btn-sm btn-danger" onClick={() => deleteStudent(s.studentId)}>
                                        🗑️ Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {students.length === 0 && (
                            <tr><td colSpan="5" className="text-center text-muted" style={{ padding: 40 }}>No students registered.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

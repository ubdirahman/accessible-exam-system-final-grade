import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { subscribeResultExamSync } from '../utils/resultExamSync';
import SearchInput from '../components/SearchInput';
import { matchesSearchQuery } from '../utils/search';

export default function AdminResultExam() {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'super_admin';

    const [faculties, setFaculties] = useState([]);
    const [classes, setClasses] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState(isSuperAdmin ? '' : user?.facultyId || '');
    const [selectedClass, setSelectedClass] = useState('');
    const [matrix, setMatrix] = useState({ faculty: null, class: null, subjects: [], students: [] });
    const [loading, setLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const loadFaculties = useCallback(async () => {
        if (!isSuperAdmin) return user?.facultyId || '';

        const res = await api.get('/faculties');
        setFaculties(res.data);

        if (!selectedFaculty && res.data.length > 0) {
            const firstFacultyId = res.data[0]._id;
            setSelectedFaculty(firstFacultyId);
            return firstFacultyId;
        }

        return selectedFaculty;
    }, [isSuperAdmin, selectedFaculty, user?.facultyId]);

    const loadClasses = useCallback(async (facultyIdOverride) => {
        const facultyId = isSuperAdmin ? (facultyIdOverride || selectedFaculty) : user?.facultyId;
        if (!facultyId) {
            setClasses([]);
            return;
        }

        const params = isSuperAdmin ? { facultyId } : undefined;
        const res = await api.get('/classes', { params });
        setClasses(res.data);
    }, [isSuperAdmin, selectedFaculty, user?.facultyId]);

    const loadMatrix = useCallback(async (classIdOverride) => {
        const classId = classIdOverride || selectedClass;
        const facultyId = isSuperAdmin ? selectedFaculty : user?.facultyId;

        if (!classId || !facultyId) {
            setMatrix({ faculty: null, class: null, subjects: [], students: [] });
            return;
        }

        try {
            setTableLoading(true);
            setError('');

            const params = {
                classId
            };

            if (isSuperAdmin) {
                params.facultyId = facultyId;
            }

            const res = await api.get('/results/class-matrix', { params });
            setMatrix(res.data);
        } catch (err) {
            console.error('Result matrix load failed:', err);
            setError(err.response?.data?.message || 'Failed to load class results.');
            setMatrix({ faculty: null, class: null, subjects: [], students: [] });
        } finally {
            setTableLoading(false);
        }
    }, [isSuperAdmin, selectedClass, selectedFaculty, user?.facultyId]);

    const downloadPdf = async () => {
        const classId = selectedClass;
        const facultyId = isSuperAdmin ? selectedFaculty : user?.facultyId;

        if (!classId || !facultyId) return;

        try {
            setError('');

            const params = { classId };
            if (isSuperAdmin) {
                params.facultyId = facultyId;
            }

            const res = await api.get('/results/class-matrix/pdf', {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const safeClassName = (matrix.class?.name || selectedClassInfo?.name || 'class-results').replace(/[^a-z0-9-_]+/gi, '_');

            link.href = url;
            link.download = `result_exam_${safeClassName}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('PDF download failed:', err);
            setError(err.response?.data?.message || 'Failed to download PDF.');
        }
    };

    useEffect(() => {
        const init = async () => {
            try {
                const facultyId = await loadFaculties();
                await loadClasses(facultyId);
            } catch (err) {
                console.error('Initial result page load failed:', err);
                setError('Failed to load filters.');
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [loadClasses, loadFaculties]);

    useEffect(() => {
        if (!loading) {
            setSelectedClass('');
            setMatrix({ faculty: null, class: null, subjects: [], students: [] });
            loadClasses(selectedFaculty).catch((err) => {
                console.error('Class load failed:', err);
                setError('Failed to load classes.');
            });
        }
    }, [loadClasses, loading, selectedFaculty]);

    useEffect(() => {
        loadMatrix().catch((err) => {
            console.error('Matrix load failed:', err);
            setError('Failed to load class results.');
        });
    }, [loadMatrix, selectedClass]);

    useEffect(() => {
        if (!selectedClass) return undefined;

        const syncMatrix = () => {
            loadMatrix(selectedClass).catch((err) => {
                console.error('Auto sync failed:', err);
            });
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                syncMatrix();
            }
        };

        const unsubscribe = subscribeResultExamSync(() => syncMatrix());
        const intervalId = window.setInterval(syncMatrix, 3000);

        window.addEventListener('focus', syncMatrix);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            unsubscribe();
            window.clearInterval(intervalId);
            window.removeEventListener('focus', syncMatrix);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [loadMatrix, selectedClass]);

    if (loading) return <div className="spinner"></div>;

    const selectedClassInfo = classes.find((item) => item._id === selectedClass);
    const filteredStudents = matrix.students.filter((student) => matchesSearchQuery(
        searchTerm,
        student.name,
        student.studentId,
        student.facultyName,
        student.className,
        student.totalScore,
        student.totalPoints
    ));

    return (
        <div className="fade-in">
            <div className="flex items-center justify-between mb-md">
                <div>
                    <h1 style={{ fontWeight: 800 }}>Result Exam</h1>
                    <p className="text-muted">Select faculty and class to view every student with all subject scores.</p>
                </div>
                <div className="flex gap-sm">
                    <button className="btn btn-secondary" onClick={() => loadMatrix()} disabled={!selectedClass}>
                        <i className="fa-solid fa-rotate-right"></i> Refresh
                    </button>
                    <button className="btn btn-primary" onClick={downloadPdf} disabled={!selectedClass || tableLoading}>
                        <i className="fa-solid fa-file-pdf"></i> Download PDF Report
                    </button>
                </div>
            </div>

            <div className="card mb-md">
                <div className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                    {isSuperAdmin && (
                        <div className="input-group">
                            <label>Select Faculty</label>
                            <select className="input" value={selectedFaculty} onChange={(e) => setSelectedFaculty(e.target.value)}>
                                <option value="">Choose faculty</option>
                                {faculties.map((faculty) => (
                                    <option key={faculty._id} value={faculty._id}>{faculty.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="input-group">
                        <label>Select Class</label>
                        <select className="input" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} disabled={!classes.length}>
                            <option value="">Choose class</option>
                            {classes.map((classroom) => (
                                <option key={classroom._id} value={classroom._id}>{classroom.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {error && <div className="badge badge-danger mb-md">{error}</div>}

            {selectedClass && (
                <>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-value">{matrix.students.length}</div>
                            <div className="stat-label">Students</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{matrix.subjects.length}</div>
                            <div className="stat-label">Subjects</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{matrix.faculty?.name || '-'}</div>
                            <div className="stat-label">Faculty</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{matrix.class?.name || selectedClassInfo?.name || '-'}</div>
                            <div className="stat-label">Class</div>
                        </div>
                    </div>

                    <div className="card mt-md">
                        <div className="flex items-center justify-between mb-sm">
                            <div>
                                <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Class Result Table</h3>
                            </div>
                            {tableLoading && <div className="text-muted">Loading results...</div>}
                        </div>
                        <div className="mb-sm">
                            <SearchInput
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder="Search by student name, ID, faculty, class, or score"
                            />
                        </div>

                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Student ID</th>
                                        <th>Faculty</th>
                                        <th>Class</th>
                                        <th>Subjects</th>
                                        <th>Total Score</th>
                                        {matrix.subjects.map((subject) => (
                                            <th key={subject.key}>{subject.label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map((student) => (
                                        <tr key={student.id}>
                                            <td style={{ fontWeight: 700 }}>{student.name}</td>
                                            <td>{student.studentId}</td>
                                            <td>{student.facultyName}</td>
                                            <td>{student.className}</td>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{student.subjectCount}</div>
                                                <div className="text-muted" style={{ fontSize: 12 }}>
                                                    with results: {student.completedSubjectCount || 0}
                                                </div>
                                            </td>
                                            <td>
                                                {student.totalPoints > 0 ? `${student.totalScore}/${student.totalPoints}` : '-'}
                                            </td>
                                            {matrix.subjects.map((subject) => {
                                                const entry = student.subjectScores?.[subject.key];
                                                return (
                                                    <td key={`${student.id}-${subject.key}`}>
                                                        {entry ? (
                                                            <div>
                                                                <div style={{ fontWeight: 700 }}>
                                                                    {entry.score}/{entry.totalPoints}
                                                                </div>
                                                                <div className="text-muted" style={{ fontSize: 12 }}>
                                                                    {entry.percentage}%
                                                                </div>
                                                            </div>
                                                        ) : '-'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}

                                    {!tableLoading && filteredStudents.length === 0 && (
                                        <tr>
                                            <td colSpan={6 + matrix.subjects.length} className="text-center text-muted" style={{ padding: 40 }}>
                                                {matrix.students.length === 0 ? 'No students or results found for this class yet.' : 'No students match your search.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {!selectedClass && (
                <div className="card text-center py-lg">
                    <div className="text-muted">Choose a class to see the result table.</div>
                </div>
            )}
        </div>
    );
}

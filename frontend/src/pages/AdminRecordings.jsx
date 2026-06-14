import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import SearchInput from '../components/SearchInput';
import { matchesSearchQuery } from '../utils/search';

function formatDuration(totalSeconds = 0) {
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function AdminRecordings() {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'super_admin';
    const [faculties, setFaculties] = useState([]);
    const [classes, setClasses] = useState([]);
    const [exams, setExams] = useState([]);
    const [recordings, setRecordings] = useState([]);
    const [audioUrls, setAudioUrls] = useState({});
    const [loading, setLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(false);
    const [loadingAudioId, setLoadingAudioId] = useState('');
    const [error, setError] = useState('');
    const [selectedFaculty, setSelectedFaculty] = useState(isSuperAdmin ? '' : user?.facultyId || '');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedExam, setSelectedExam] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const audioUrlsRef = useRef({});

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

    const loadExams = useCallback(async () => {
        const res = await api.get('/exams');
        setExams(res.data);
    }, []);

    const loadRecordings = useCallback(async () => {
        try {
            setTableLoading(true);
            setError('');

            const params = {};
            if (isSuperAdmin && selectedFaculty) {
                params.facultyId = selectedFaculty;
            }
            if (selectedClass) {
                params.classId = selectedClass;
            }
            if (selectedExam) {
                params.examId = selectedExam;
            }

            const res = await api.get('/recordings', { params });
            setRecordings(res.data);
        } catch (err) {
            console.error('Load recordings error:', err);
            setError(err.response?.data?.message || 'Failed to load student recordings.');
            setRecordings([]);
        } finally {
            setTableLoading(false);
        }
    }, [isSuperAdmin, selectedClass, selectedExam, selectedFaculty]);

    const loadAudio = useCallback(async (recordingId) => {
        try {
            setLoadingAudioId(recordingId);
            setError('');

            const res = await api.get(`/recordings/${recordingId}/audio`, {
                responseType: 'blob'
            });

            if (audioUrlsRef.current[recordingId]) {
                window.URL.revokeObjectURL(audioUrlsRef.current[recordingId]);
            }

            const blob = new Blob([res.data], {
                type: res.headers['content-type'] || 'audio/webm'
            });
            const url = window.URL.createObjectURL(blob);
            audioUrlsRef.current[recordingId] = url;
            setAudioUrls((prev) => ({ ...prev, [recordingId]: url }));
        } catch (err) {
            console.error('Load audio error:', err);
            setError(err.response?.data?.message || 'Failed to load the audio recording.');
        } finally {
            setLoadingAudioId('');
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const facultyId = await loadFaculties();
                await Promise.all([
                    loadClasses(facultyId),
                    loadExams()
                ]);
            } catch (err) {
                console.error('Initial recordings page load failed:', err);
                setError('Failed to load recordings filters.');
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [loadClasses, loadExams, loadFaculties]);

    useEffect(() => {
        if (loading) return;

        setSelectedClass('');
        setSelectedExam('');
        loadClasses(selectedFaculty).catch((err) => {
            console.error('Class load failed:', err);
            setError('Failed to load classes.');
        });
    }, [loadClasses, loading, selectedFaculty]);

    useEffect(() => {
        if (loading) return;

        loadRecordings().catch((err) => {
            console.error('Recording table load failed:', err);
        });
    }, [loadRecordings, loading]);

    useEffect(() => () => {
        Object.values(audioUrlsRef.current).forEach((url) => {
            window.URL.revokeObjectURL(url);
        });
    }, []);

    if (loading) {
        return <div className="spinner"></div>;
    }

    const filteredExams = exams.filter((exam) => {
        if (isSuperAdmin && selectedFaculty && exam.facultyId && String(exam.facultyId) !== String(selectedFaculty)) {
            return false;
        }
        if (selectedClass && exam.classId && String(exam.classId) !== String(selectedClass)) {
            return false;
        }
        if (selectedClass && !exam.classId) {
            return false;
        }
        return true;
    });

    const completedCount = recordings.filter((item) => item.status === 'completed').length;
    const totalDurationSeconds = recordings.reduce((sum, item) => sum + (Number(item.durationSeconds) || 0), 0);
    const filteredRecordings = recordings.filter((recording) => matchesSearchQuery(
        searchTerm,
        recording.studentName,
        recording.studentId,
        recording.subjectName,
        recording.examTitle,
        recording.status,
        recording.durationSeconds
    ));

    return (
        <div className="fade-in">
            <div className="flex items-center justify-between mb-md">
                <div>
                    <h1 style={{ fontWeight: 800 }}>
                        <i className="fa-solid fa-microphone-lines" aria-hidden="true"></i> Student Recordings
                    </h1>
                    <p className="text-muted">Listen to voice recordings captured from student login through exam completion.</p>
                </div>
                <button className="btn btn-secondary" onClick={() => loadRecordings()} disabled={tableLoading}>
                    <i className="fa-solid fa-rotate-right" aria-hidden="true"></i> Refresh
                </button>
            </div>

            <div className="card mb-md">
                <div className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                    {isSuperAdmin && (
                        <div className="input-group">
                            <label>Faculty</label>
                            <select className="input" value={selectedFaculty} onChange={(e) => setSelectedFaculty(e.target.value)}>
                                <option value="">Choose faculty</option>
                                {faculties.map((faculty) => (
                                    <option key={faculty._id} value={faculty._id}>{faculty.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="input-group">
                        <label>Class</label>
                        <select className="input" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} disabled={!classes.length}>
                            <option value="">All classes</option>
                            {classes.map((classroom) => (
                                <option key={classroom._id} value={classroom._id}>{classroom.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="input-group">
                        <label>Exam</label>
                        <select className="input" value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} disabled={!filteredExams.length}>
                            <option value="">All exams</option>
                            {filteredExams.map((exam) => (
                                <option key={exam._id} value={exam._id}>{exam.title}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {error && (
                <div className="badge badge-danger mb-md" style={{ width: '100%', justifyContent: 'center', padding: 14 }}>
                    <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> {error}
                </div>
            )}

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{recordings.length}</div>
                    <div className="stat-label">Total Recordings</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{completedCount}</div>
                    <div className="stat-label">Completed Uploads</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{formatDuration(totalDurationSeconds)}</div>
                    <div className="stat-label">Total Duration</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{selectedClass ? classes.find((item) => item._id === selectedClass)?.name || '-' : 'All'}</div>
                    <div className="stat-label">Class Filter</div>
                </div>
            </div>

            <div className="card mt-md">
                <div className="flex items-center justify-between mb-sm">
                    <h3 style={{ fontWeight: 700 }}>Recorded Exam Sessions</h3>
                    {tableLoading && <div className="text-muted">Loading recordings...</div>}
                </div>
                <div className="mb-sm">
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Search by student name, ID, exam, subject, or status"
                    />
                </div>

                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Student ID</th>
                                <th>Exam</th>
                                <th>Status</th>
                                <th>Duration</th>
                                <th>Uploaded</th>
                                <th>Audio</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecordings.map((recording) => (
                                <tr key={recording._id}>
                                    <td style={{ fontWeight: 700 }}>{recording.studentName || 'Unknown Student'}</td>
                                    <td>{recording.studentId}</td>
                                    <td>
                                        <div style={{ fontWeight: 700 }}>{recording.subjectName || recording.examTitle || 'Untitled Exam'}</div>
                                        {recording.examTitle && recording.subjectName && recording.examTitle !== recording.subjectName && (
                                            <div className="text-muted" style={{ fontSize: 12 }}>{recording.examTitle}</div>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`badge ${
                                            recording.status === 'completed'
                                                ? 'badge-success'
                                                : recording.status === 'aborted'
                                                    ? 'badge-danger'
                                                    : 'badge-warning'
                                        }`}>
                                            {recording.status}
                                        </span>
                                    </td>
                                    <td>{formatDuration(recording.durationSeconds)}</td>
                                    <td>{recording.uploadedAt ? new Date(recording.uploadedAt).toLocaleString() : '-'}</td>
                                    <td style={{ minWidth: 260 }}>
                                        {audioUrls[recording._id] ? (
                                            <audio controls preload="none" src={audioUrls[recording._id]} style={{ width: '100%' }}>
                                                Your browser does not support audio playback.
                                            </audio>
                                        ) : (
                                            <button
                                                className="btn btn-sm btn-primary"
                                                onClick={() => loadAudio(recording._id)}
                                                disabled={loadingAudioId === recording._id}
                                            >
                                                <i className="fa-solid fa-headphones" aria-hidden="true"></i> {loadingAudioId === recording._id ? 'Loading...' : 'Listen'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            {!tableLoading && filteredRecordings.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="text-center text-muted" style={{ padding: 40 }}>
                                        {recordings.length === 0 ? 'No recordings found for the selected filters.' : 'No recordings match your search.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

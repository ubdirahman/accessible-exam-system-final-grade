import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function ExamCreator() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isSuper = user?.role === 'super_admin';
    const isTeacher = user?.role === 'teacher';
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [timeLimit, setTimeLimit] = useState(60);
    const [active, setActive] = useState(false);
    const [faculties, setFaculties] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState(user?.facultyId || '');
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState(user?.classId || '');
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState('');
    const [sections, setSections] = useState([
        {
            name: 'Part 1',
            questionType: 'mcq',
            questions: [{
                type: 'mcq',
                questionText: '',
                options: [
                    { label: 'A', text: '' }, { label: 'B', text: '' },
                    { label: 'C', text: '' }, { label: 'D', text: '' }
                ],
                correctAnswer: '',
                points: 1
            }]
        }
    ]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
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
        loadFaculties();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // load classes for admin/super
    useEffect(() => {
        const loadClasses = async () => {
            try {
                if (isTeacher) {
                    const res = await api.get('/classes/my');
                    setClasses(res.data);
                    if (!selectedClass && res.data.length > 0) setSelectedClass(res.data[0]._id);
                } else {
                    const facultyId = isSuper ? selectedFaculty : user?.facultyId;
                    if (!facultyId) return;
                    const res = await api.get('/classes', { params: { facultyId } });
                    setClasses(res.data);
                    if (!selectedClass && res.data.length > 0) {
                        setSelectedClass(res.data[0]._id);
                    }
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load classes');
            }
        };
        loadClasses();
    }, [selectedFaculty, isSuper, isTeacher, user?.facultyId]);

    // load subjects
    useEffect(() => {
        const loadSubjects = async () => {
            try {
                if (isTeacher) {
                    const res = await api.get('/subjects/my');
                    setSubjects(res.data);
                } else {
                    const facultyId = isSuper ? selectedFaculty : user?.facultyId;
                    if (!facultyId) return;
                    const res = await api.get('/subjects', { params: { facultyId } });
                    setSubjects(res.data);
                    if (!selectedSubject && res.data.length > 0) setSelectedSubject(res.data[0]._id);
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load subjects');
            }
        };
        loadSubjects();
    }, [isTeacher, isSuper, selectedFaculty, user?.facultyId]);

    useEffect(() => {
        if (!isTeacher) return;
        const filtered = subjects.filter(s => (s.classId?._id || s.classId) === selectedClass);
        if (filtered.length > 0) {
            setSelectedSubject(filtered[0]._id);
        } else {
            setSelectedSubject('');
        }
    }, [selectedClass, subjects, isTeacher]);

    const addSection = () => {
        setSections([...sections, { name: `Part ${sections.length + 1}`, questionType: 'mcq', questions: [] }]);
    };

    const removeSection = (idx) => {
        setSections(sections.filter((_, i) => i !== idx));
    };

    const updateSection = (idx, field, value) => {
        const updated = [...sections];
        updated[idx][field] = value;
        setSections(updated);
    };

    const addQuestion = (secIdx, type) => {
        const updated = [...sections];
        const chosenType = type || updated[secIdx].questionType || 'mcq';
        const q = {
            type: chosenType,
            questionText: '',
            correctAnswer: '',
            points: chosenType === 'open-ended' ? 5 : chosenType === 'mcq' ? 2 : 1,
            options: chosenType === 'mcq'
                ? [{ label: 'A', text: '' }, { label: 'B', text: '' }, { label: 'C', text: '' }, { label: 'D', text: '' }]
                : chosenType === 'true-false'
                    ? [{ label: 'A', text: 'True' }, { label: 'B', text: 'False' }]
                    : []
        };
        updated[secIdx].questions.push(q);
        setSections(updated);
    };

    const removeQuestion = (secIdx, qIdx) => {
        const updated = [...sections];
        updated[secIdx].questions.splice(qIdx, 1);
        setSections(updated);
    };

    const updateQuestion = (secIdx, qIdx, field, value) => {
        const updated = [...sections];
        updated[secIdx].questions[qIdx][field] = value;
        setSections(updated);
    };

    const updateOption = (secIdx, qIdx, optIdx, value) => {
        const updated = [...sections];
        updated[secIdx].questions[qIdx].options[optIdx].text = value;
        setSections(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            const facultyId = isSuper ? selectedFaculty : user?.facultyId;
            if (isSuper && !facultyId) {
                setError('Select a faculty for this exam.');
                setSaving(false);
                return;
            }
            const activeFlag = isTeacher ? false : active;
            const classId = isTeacher ? (selectedClass || user?.classId || null) : selectedClass || null;
            const subjectId = selectedSubject || null;
            await api.post('/exams', { title, description, timeLimit, sections, active: activeFlag, facultyId, classId, subjectId });
            if (user?.role === 'teacher') {
                navigate('/teacher/dashboard');
            } else {
                navigate('/admin/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error creating exam.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page">
            <div className="app-container">
                <div className="flex items-center justify-between mb-md">
                    <h1 style={{ fontWeight: 800, fontSize: 'var(--font-size-xl)' }}>
                        <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i> Create Exam
                    </h1>
                    <button className="btn btn-secondary" onClick={() => navigate('/admin/dashboard')}>
                        <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Back to Dashboard
                    </button>
                </div>

                {error && (
                    <div className="badge badge-danger" style={{ width: '100%', justifyContent: 'center', padding: 14, marginBottom: 16 }}>
                        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="card mb-md">
                        <h3 style={{ marginBottom: 16, fontWeight: 700 }}><i className="fa-solid fa-clipboard-list" aria-hidden="true"></i> Exam Details</h3>
                        {isSuper && (
                            <div className="input-group">
                                <label>Faculty</label>
                                <select className="input" value={selectedFaculty} onChange={e => setSelectedFaculty(e.target.value)} required>
                                    <option value="">Select faculty</option>
                                    {faculties.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="input-group">
                            <label>Title</label>
                            <input className="input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g., Midterm Exam" />
                        </div>
                        <div className="input-group">
                            <label>Class</label>
                            <select
                                className="input"
                                value={selectedClass}
                                onChange={e => setSelectedClass(e.target.value)}
                                required
                            >
                                <option value="">Select class</option>
                                {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="input-group">
                            <label>Subject</label>
                            <select
                                className="input"
                                value={selectedSubject}
                                onChange={e => setSelectedSubject(e.target.value)}
                                required
                                disabled={!selectedClass}
                            >
                                <option value="">Select subject</option>
                                {subjects
                                    .filter(s => !selectedClass || (s.classId?._id || s.classId) === selectedClass)
                                    .map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="input-group">
                            <label>Description</label>
                            <textarea className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of the exam" rows={3} />
                        </div>
                        <div className="input-group">
                            <label>Time Limit (minutes)</label>
                            <input className="input" type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} min={1} max={300} required />
                        </div>
                        {!isTeacher && (
                            <div className="input-group">
                                <label>
                                    <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
                                    {' '}Make this exam active immediately
                                </label>
                            </div>
                        )}
                    </div>

                    {sections.map((section, secIdx) => (
                        <div key={secIdx} className="card mb-md" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
                            <div className="flex items-center justify-between mb-md">
                                <div className="input-group" style={{ flex: 1, marginBottom: 0, marginRight: 16 }}>
                                    <label>Section Name</label>
                                    <input
                                        className="input"
                                        value={section.name}
                                        onChange={e => updateSection(secIdx, 'name', e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="input-group" style={{ minWidth: 180, marginBottom: 0 }}>
                                    <label>Question Type</label>
                                    <select
                                        className="input"
                                        value={section.questionType || 'mcq'}
                                        onChange={e => updateSection(secIdx, 'questionType', e.target.value)}
                                    >
                                        <option value="mcq">MCQ</option>
                                        <option value="true-false">True / False</option>
                                        <option value="open-ended">Open-Ended</option>
                                    </select>
                                </div>
                                {sections.length > 1 && (
                                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeSection(secIdx)}>
                                        <i className="fa-solid fa-trash" aria-hidden="true"></i> Remove Section
                                    </button>
                                )}
                            </div>

                            {section.questions.map((q, qIdx) => (
                                <div key={qIdx} className="card" style={{ marginBottom: 16, background: 'var(--bg-secondary)' }}>
                                    <div className="flex items-center justify-between mb-md">
                                        <span className="badge badge-info">
                                            {q.type === 'mcq' ? 'MCQ' : q.type === 'true-false' ? 'True/False' : 'Open-Ended'}
                                        </span>
                                        <div className="flex gap-sm items-center">
                                            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Points:</label>
                                            <input
                                                className="input"
                                                type="number"
                                                value={q.points}
                                                onChange={e => updateQuestion(secIdx, qIdx, 'points', Number(e.target.value))}
                                                min={1}
                                                style={{ width: 70, padding: '8px 12px' }}
                                            />
                                            <button type="button" className="btn btn-sm btn-danger" onClick={() => removeQuestion(secIdx, qIdx)}><i className="fa-solid fa-circle-xmark" aria-hidden="true"></i></button>
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label>Question Text</label>
                                        <textarea
                                            className="input"
                                            value={q.questionText}
                                            onChange={e => updateQuestion(secIdx, qIdx, 'questionText', e.target.value)}
                                            required
                                            rows={2}
                                        />
                                    </div>

                                    {(q.type === 'mcq' || q.type === 'true-false') && (
                                        <div style={{ marginBottom: 12 }}>
                                            {q.options.map((opt, optIdx) => (
                                                <div key={opt.label} className="flex gap-sm items-center" style={{ marginBottom: 8 }}>
                                                    <span className="option-label" style={{ width: 36, height: 36, fontSize: 14 }}>{opt.label}</span>
                                                    <input
                                                        className="input"
                                                        value={opt.text}
                                                        onChange={e => updateOption(secIdx, qIdx, optIdx, e.target.value)}
                                                        placeholder={`Option ${opt.label}`}
                                                        required
                                                        disabled={q.type === 'true-false'}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {q.type !== 'open-ended' && (
                                        <div className="input-group" style={{ marginBottom: 0 }}>
                                            <label>Correct Answer {q.type === 'mcq' || q.type === 'true-false' ? '(A/B/C/D)' : ''}</label>
                                            <input
                                                className="input"
                                                value={q.correctAnswer}
                                                onChange={e => updateQuestion(secIdx, qIdx, 'correctAnswer', e.target.value.toUpperCase())}
                                                required
                                                placeholder={q.type === 'mcq' || q.type === 'true-false' ? 'e.g., A' : ''}
                                                maxLength={1}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}

                            <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => addQuestion(secIdx)}
                                >
                                    <i className="fa-solid fa-plus" aria-hidden="true"></i> Add {section.questionType === 'true-false'
                                        ? 'True/False'
                                        : section.questionType === 'open-ended'
                                            ? 'Open-Ended'
                                            : 'MCQ'}
                                </button>
                            </div>
                        </div>
                    ))}

                    <button type="button" className="btn btn-secondary mb-md" onClick={addSection}>
                        <i className="fa-solid fa-plus" aria-hidden="true"></i> Add Section
                    </button>

                    <div className="text-center mt-lg">
                        <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
                            {saving ? <><i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Creating...</> : <><i className="fa-solid fa-circle-check" aria-hidden="true"></i> Create Exam</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

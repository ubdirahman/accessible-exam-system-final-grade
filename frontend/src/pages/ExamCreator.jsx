import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function ExamCreator() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEdit = !!id;

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
    const [loading, setLoading] = useState(isEdit);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                if (isSuper) {
                    const res = await api.get('/faculties');
                    setFaculties(res.data);
                }

                if (isEdit) {
                    const res = await api.get(`/exams/${id}`);
                    const { exam, questions } = res.data;
                    
                    setTitle(exam.title);
                    setDescription(exam.description || '');
                    setTimeLimit(exam.timeLimit);
                    setActive(exam.active);
                    setSelectedFaculty(exam.facultyId || '');
                    setSelectedClass(exam.classId || '');
                    setSelectedSubject(exam.subjectId || '');

                    // Map questions back into sections
                    const mappedSections = exam.sections.map(sec => {
                        return {
                            ...sec,
                            questions: questions.filter(q => q.sectionId === sec._id)
                        };
                    });
                    
                    if (mappedSections.length > 0) {
                        setSections(mappedSections);
                    }
                }
            } catch (err) {
                setError('Failed to load exam data.');
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [id, isEdit, isSuper]);

    useEffect(() => {
        if (isTeacher && user?.classId && !selectedClass && !isEdit) {
            setSelectedClass(user.classId._id || user.classId);
        }
    }, [isTeacher, user, selectedClass, isEdit]);

    // load classes
    useEffect(() => {
        const loadClasses = async () => {
            try {
                if (isTeacher) {
                    const res = await api.get('/classes/my');
                    setClasses(res.data);
                } else {
                    const facultyId = isSuper ? selectedFaculty : user?.facultyId;
                    if (!facultyId) return;
                    const res = await api.get('/classes', { params: { facultyId } });
                    setClasses(res.data);
                }
            } catch (err) {
                console.error('Error loading classes:', err);
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
                }
            } catch (err) {
                console.error('Error loading subjects:', err);
            }
        };
        loadSubjects();
    }, [isTeacher, isSuper, selectedFaculty, user?.facultyId]);

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
            const payload = {
                title,
                description,
                timeLimit,
                sections,
                facultyId,
                classId: selectedClass || null,
                subjectId: selectedSubject || null,
                ...(isTeacher ? {} : { active })
            };

            if (isEdit) {
                await api.put(`/exams/${id}`, payload);
            } else {
                await api.post('/exams', payload);
            }

            navigate(user?.role === 'teacher' ? '/teacher/dashboard' : '/admin/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving exam.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="spinner"></div>;

    return (
        <div className="page">
            <div className="app-container">
                <div className="flex items-center justify-between mb-md">
                    <h1 style={{ fontWeight: 800, fontSize: 'var(--font-size-xl)' }}>
                        <i className={`fa-solid ${isEdit ? 'fa-pen-to-square' : 'fa-plus-circle'}`} aria-hidden="true"></i> {isEdit ? 'Edit Exam' : 'Create Exam'}
                    </h1>
                    <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                        <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Back
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
                        <div className="grid-2 gap-md">
                            <div className="input-group">
                                <label>Class</label>
                                <select 
                                    className="input" 
                                    value={selectedClass} 
                                    onChange={e => setSelectedClass(e.target.value)} 
                                    required 
                                    disabled={isTeacher}
                                >
                                    <option value="">Select class</option>
                                    {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                                {isTeacher && <small className="text-muted">Locked to your assigned class.</small>}
                            </div>
                            <div className="input-group">
                                <label>Subject</label>
                                <select className="input" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} required disabled={!selectedClass}>
                                    <option value="">Select subject</option>
                                    {subjects
                                        .filter(s => !selectedClass || (s.classId?._id || s.classId) === selectedClass)
                                        .map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="input-group">
                            <label>Description</label>
                            <textarea className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of the exam" rows={2} />
                        </div>
                        <div className="grid-2 gap-md" style={{ gridTemplateColumns: isTeacher ? '1fr' : undefined }}>
                            <div className="input-group">
                                <label>Time Limit (minutes)</label>
                                <input className="input" type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} min={1} max={600} required />
                            </div>
                            {!isTeacher && (
                                <div className="input-group flex items-end">
                                    <label className="flex items-center gap-sm cursor-pointer" style={{ marginBottom: 12 }}>
                                        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
                                        <span>Active Exam</span>
                                    </label>
                                </div>
                            )}
                        </div>
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
                                <div className="input-group" style={{ minWidth: 160, marginBottom: 0 }}>
                                    <label>Default Type</label>
                                    <select
                                        className="input"
                                        value={section.questionType || 'mcq'}
                                        onChange={e => updateSection(secIdx, 'questionType', e.target.value)}
                                    >
                                        <option value="mcq">MCQ</option>
                                        <option value="true-false">True/False</option>
                                        <option value="open-ended">Open-Ended</option>
                                    </select>
                                </div>
                                {sections.length > 1 && (
                                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeSection(secIdx)} style={{ marginTop: 22 }}>
                                        <i className="fa-solid fa-trash"></i>
                                    </button>
                                )}
                            </div>

                            <div className="questions-container">
                                {section.questions.map((q, qIdx) => (
                                    <div key={qIdx} className="card bg-secondary mb-sm border-none shadow-none">
                                        <div className="flex items-center justify-between mb-sm">
                                            <div className="flex gap-sm items-center">
                                                <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: 10 }}>{q.type}</span>
                                                <input 
                                                    className="input-inline" 
                                                    type="number" 
                                                    value={q.points} 
                                                    onChange={e => updateQuestion(secIdx, qIdx, 'points', Number(e.target.value))}
                                                    style={{ width: 40, border: 'none', background: 'transparent', fontWeight: 800, textAlign: 'center' }}
                                                /> pts
                                            </div>
                                            <button type="button" className="btn btn-icon text-danger" onClick={() => removeQuestion(secIdx, qIdx)}>
                                                <i className="fa-solid fa-trash-can"></i>
                                            </button>
                                        </div>
                                        <div className="input-group mb-sm">
                                            <textarea
                                                className="input"
                                                value={q.questionText}
                                                onChange={e => updateQuestion(secIdx, qIdx, 'questionText', e.target.value)}
                                                placeholder="Enter question text..."
                                                required
                                                rows={1}
                                            />
                                        </div>
                                        
                                        {(q.type === 'mcq' || q.type === 'true-false') && (
                                            <div className="grid-2 gap-sm mb-sm">
                                                {q.options.map((opt, optIdx) => (
                                                    <div key={opt.label} className="flex gap-sm items-center">
                                                        <span className={`option-label ${q.correctAnswer === opt.label ? 'bg-primary text-white' : ''}`} 
                                                              onClick={() => updateQuestion(secIdx, qIdx, 'correctAnswer', opt.label)}
                                                              style={{ width: 28, height: 28, fontSize: 12, cursor: 'pointer' }}>
                                                            {opt.label}
                                                        </span>
                                                        <input
                                                            className="input"
                                                            value={opt.text}
                                                            onChange={e => updateOption(secIdx, qIdx, optIdx, e.target.value)}
                                                            placeholder={`Option ${opt.label}`}
                                                            required
                                                            disabled={q.type === 'true-false'}
                                                            style={{ padding: '4px 10px', fontSize: 13 }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {q.type !== 'open-ended' && (
                                            <div className="flex items-center justify-end gap-sm">
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Correct:</span>
                                                <input
                                                    className="input"
                                                    value={q.correctAnswer}
                                                    onChange={e => {
                                                        let val = e.target.value.toUpperCase();
                                                        if (q.type === 'mcq' && !['A', 'B', 'C', 'D'].includes(val) && val !== '') return;
                                                        if (q.type === 'true-false' && !['A', 'B'].includes(val) && val !== '') return;
                                                        updateQuestion(secIdx, qIdx, 'correctAnswer', val);
                                                    }}
                                                    required
                                                    placeholder={q.type === 'true-false' ? "A/B" : "A-D"}
                                                    maxLength={1}
                                                    style={{ width: 40, textAlign: 'center', padding: '4px' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => addQuestion(secIdx)}
                            >
                                <i className="fa-solid fa-plus"></i> Add Question
                            </button>
                        </div>
                    ))}

                    <div className="flex justify-between items-center mt-lg">
                        <button type="button" className="btn btn-secondary" onClick={addSection}>
                            <i className="fa-solid fa-layer-group"></i> Add Section
                        </button>
                        <button type="submit" className="btn btn-primary btn-lg px-xl" disabled={saving}>
                            {saving ? 'Saving...' : (isEdit ? 'Update Exam' : 'Create Exam')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

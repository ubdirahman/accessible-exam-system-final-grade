import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function ExamCreator() {
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [timeLimit, setTimeLimit] = useState(60);
    const [sections, setSections] = useState([
        {
            name: 'Part 1',
            questions: [{
                type: 'mcq', questionText: '', options: [
                    { label: 'A', text: '' }, { label: 'B', text: '' },
                    { label: 'C', text: '' }, { label: 'D', text: '' }
                ], correctAnswer: '', points: 1
            }]
        }
    ]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const addSection = () => {
        setSections([...sections, {
            name: `Part ${sections.length + 1}`,
            questions: []
        }]);
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
        const q = {
            type,
            questionText: '',
            correctAnswer: '',
            points: type === 'open-ended' ? 5 : type === 'mcq' ? 2 : 1,
            options: type === 'mcq'
                ? [{ label: 'A', text: '' }, { label: 'B', text: '' }, { label: 'C', text: '' }, { label: 'D', text: '' }]
                : type === 'true-false'
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
            await api.post('/exams', { title, description, timeLimit, sections });
            navigate('/admin/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Error creating exam.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page">
            <div className="app-container">
                {/* Header */}
                <div className="flex items-center justify-between mb-md">
                    <h1 style={{ fontWeight: 800, fontSize: 'var(--font-size-xl)' }}>
                        ✏️ Create Exam
                    </h1>
                    <button className="btn btn-secondary" onClick={() => navigate('/admin/dashboard')}>
                        ← Back to Dashboard
                    </button>
                </div>

                {error && (
                    <div className="badge badge-danger" style={{ width: '100%', justifyContent: 'center', padding: 14, marginBottom: 16 }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Basic Info */}
                    <div className="card mb-md">
                        <h3 style={{ marginBottom: 16, fontWeight: 700 }}>📋 Exam Details</h3>
                        <div className="input-group">
                            <label>Title</label>
                            <input className="input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g., Midterm Exam" />
                        </div>
                        <div className="input-group">
                            <label>Description</label>
                            <textarea className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of the exam" rows={3} />
                        </div>
                        <div className="input-group">
                            <label>Time Limit (minutes)</label>
                            <input className="input" type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} min={1} max={300} required />
                        </div>
                    </div>

                    {/* Sections */}
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
                                {sections.length > 1 && (
                                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeSection(secIdx)}>
                                        🗑️ Remove Section
                                    </button>
                                )}
                            </div>

                            {/* Questions */}
                            {section.questions.map((q, qIdx) => (
                                <div key={qIdx} className="card" style={{ marginBottom: 16, background: 'var(--bg-secondary)' }}>
                                    <div className="flex items-center justify-between mb-md">
                                        <span className="badge badge-info">
                                            {q.type === 'mcq' ? '🔤 MCQ' : q.type === 'true-false' ? '✅ True/False' : '📝 Open-Ended'}
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
                                            <button type="button" className="btn btn-sm btn-danger" onClick={() => removeQuestion(secIdx, qIdx)}>✖️</button>
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

                                    {/* Options for MCQ */}
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

                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label>Correct Answer {q.type === 'mcq' || q.type === 'true-false' ? '(A/B/C/D)' : '(Reference text)'}</label>
                                        {q.type === 'open-ended' ? (
                                            <textarea
                                                className="input"
                                                value={q.correctAnswer}
                                                onChange={e => updateQuestion(secIdx, qIdx, 'correctAnswer', e.target.value)}
                                                required
                                                rows={3}
                                                placeholder="Reference answer for ML grading..."
                                            />
                                        ) : (
                                            <input
                                                className="input"
                                                value={q.correctAnswer}
                                                onChange={e => updateQuestion(secIdx, qIdx, 'correctAnswer', e.target.value.toUpperCase())}
                                                required
                                                placeholder="e.g., A"
                                                maxLength={1}
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Add question buttons */}
                            <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                <button type="button" className="btn btn-sm btn-secondary" onClick={() => addQuestion(secIdx, 'mcq')}>
                                    ➕ MCQ
                                </button>
                                <button type="button" className="btn btn-sm btn-secondary" onClick={() => addQuestion(secIdx, 'true-false')}>
                                    ➕ True/False
                                </button>
                                <button type="button" className="btn btn-sm btn-secondary" onClick={() => addQuestion(secIdx, 'open-ended')}>
                                    ➕ Open-Ended
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Add section */}
                    <button type="button" className="btn btn-secondary mb-md" onClick={addSection}>
                        ➕ Add Section
                    </button>

                    {/* Submit */}
                    <div className="text-center mt-lg">
                        <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
                            {saving ? '⏳ Creating...' : '✅ Create Exam'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { useVoiceCommands } from '../hooks/useVoiceCommands';

export default function TeacherExamResponses() {
    const { id } = useParams(); // exam id
    const [students, setStudents] = useState([]);
    const [selected, setSelected] = useState(null);
    const [data, setData] = useState({ questions: [], responses: [] });
    const [loading, setLoading] = useState(true);
    const [selectedResp, setSelectedResp] = useState(null);
    const [selectedQ, setSelectedQ] = useState(null);

    // allow admin/teacher to say "correct" or "incorrect" after clicking a response row
    useVoiceCommands({
        correct: () => grade(selectedResp, selectedQ, true),
        incorrect: () => grade(selectedResp, selectedQ, false),
    });

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/exams/${id}/students`);
            setStudents(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadResponses = async (student, { preserveSelection = false } = {}) => {
        if (!student) return;
        try {
            setLoading(true);
            const res = await api.get(`/exams/${id}/students/${student.studentId}/responses`);
            setData(res.data);
            setSelected(student);
            const currentRespId = preserveSelection && selectedResp?._id;
            if (res.data.responses.length > 0) {
                // try to keep the same response selected after refresh
                const nextResp = currentRespId
                    ? res.data.responses.find(r => r._id === currentRespId) || res.data.responses[0]
                    : res.data.responses[0];
                const nextQ = res.data.questions.find(q => q._id === nextResp.questionId);
                setSelectedResp(nextResp);
                setSelectedQ(nextQ || null);
            } else {
                setSelectedResp(null);
                setSelectedQ(null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const grade = async (resp, question, correct) => {
        const score = correct ? question.points || 1 : 0;
        try {
            await api.put(`/exams/${id}/students/${selected.studentId}/responses/${resp?._id || 'new'}`, {
                isCorrect: correct,
                score,
                teacherFeedback: correct ? 'Correct' : 'Incorrect',
                questionId: question._id
            });
            // auto-refresh table to reflect new status
            await loadResponses(selected, { preserveSelection: true });
        } catch (err) {
            console.error('Grading error', err);
        }
    };

    if (loading) return <div className="spinner"></div>;

    return (
        <div>
            <h2 style={{ fontWeight: 700 }}>Responses for Exam</h2>
            <div className="flex gap-md">
                <div style={{ flex: 1 }}>
                    <h3>Students</h3>
                    <ul>
                        {students.map(s => (
                            <li key={s._id} style={{ cursor: 'pointer', fontWeight: selected?.studentId === s.studentId ? 600 : 400 }}
                                onClick={() => loadResponses(s)}>
                                {s.name} ({s.studentId})
                            </li>
                        ))}
                        {students.length === 0 && <p className="text-muted">No one has started this exam yet.</p>}
                    </ul>
                </div>
                <div style={{ flex: 2 }}>
                    {selected ? (
                        <>
                            <h3>Answers for {selected.name}</h3>
                            <div className="table-wrapper" style={{ maxHeight: 400, overflowY: 'auto' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Question</th>
                                            <th>Answer</th>
                                            <th>Score</th>
                                            <th>Select</th>
                                            <th>Status</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
        {data.questions
            // show every question; teachers may override auto-grading
            .map(q => {
                const resp = data.responses.find(r => r.questionId && r.questionId.toString() === q._id.toString());
                return (
                    <tr
                        key={q._id}
                        className={
                            resp?.manuallyGraded ? 'text-muted' : resp?.autoGraded ? 'bg-light' : ''
                                                        }
                                                        onClick={() => { setSelectedResp(resp); setSelectedQ(q); }}
                                                        style={{ cursor: 'pointer', background: selectedResp === resp ? '#f0f8ff' : undefined }}
                                                    >
                                                        <td>{q.questionText}</td>
                                                        <td>{resp?.selectedAnswer || '—'}</td>
                                                        <td>{resp?.score != null ? resp.score : '-'}</td>
                                                        <td>
                                                            <button
                                                                className="btn btn-sm btn-secondary"
                                                                onClick={(e) => { e.stopPropagation(); setSelectedResp(resp); setSelectedQ(q); }}
                                                            >
                                                                Select
                                                            </button>
                                                        </td>
                                                        <td>
                                                            {resp?.isCorrect == null
                                                                ? '—'
                                                                : resp.isCorrect
                                                                    ? <i className="fa-solid fa-circle-check" aria-hidden="true"></i>
                                                                    : <i className="fa-solid fa-circle-xmark" aria-hidden="true"></i>}
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="btn btn-sm btn-success"
                                                                onClick={() => grade(resp, q, true)}
                                                            >Correct</button>
                                                            <button
                                                                className="btn btn-sm btn-danger ml-sm"
                                                                onClick={() => grade(resp, q, false)}
                                                            >Incorrect</button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <p className="text-muted">Select a student to view their answers.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

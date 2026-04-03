import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { useVoiceCommands } from '../hooks/useVoiceCommands';

export default function TeacherExamResponses() {
    const { id } = useParams(); // exam id
    const [students, setStudents] = useState([]);
    const [data, setData] = useState({ questions: [], responses: [] });
    const [loading, setLoading] = useState(true);
    
    // For grading
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedResp, setSelectedResp] = useState(null);
    const [selectedQ, setSelectedQ] = useState(null);
    const [manualScore, setManualScore] = useState('');

    useVoiceCommands({
        correct: () => grade(selectedResp, selectedQ, true, manualScore || null),
        incorrect: () => grade(selectedResp, selectedQ, false, manualScore || null),
    });

    useEffect(() => {
        loadExamData();
    }, []);

    const loadExamData = async ({ preserveSelection = false } = {}) => {
        try {
            if (!preserveSelection) setLoading(true);
            const [studentsRes, dataRes] = await Promise.all([
                api.get(`/exams/${id}/students`),
                api.get(`/exams/${id}/all-responses`),
            ]);
            setStudents(studentsRes.data);
            setData(dataRes.data);

            if (preserveSelection && selectedResp?._id) {
                const updatedResp = dataRes.data.responses.find(r => r._id === selectedResp._id) || selectedResp;
                setSelectedResp(updatedResp);
                setManualScore(updatedResp.score != null ? updatedResp.score.toString() : '');
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const grade = async (resp, question, correct, customScore = null) => {
        if (!question || !selectedStudent) return;
        
        // resp can be null if student skipped the question
        
        let score = customScore !== null && customScore !== '' ? Number(customScore) : (correct ? (question.points || 1) : 0);
        
        try {
            await api.put(`/exams/${id}/students/${selectedStudent.studentId}/responses/${resp?._id || 'new'}`, {
                isCorrect: correct,
                score,
                teacherFeedback: correct ? 'Correct' : 'Incorrect',
                questionId: question._id
            });
            // auto-refresh table to reflect new status
            await loadExamData({ preserveSelection: true });
        } catch (err) {
            console.error('Grading error', err);
        }
    };

    if (loading && students.length === 0) return <div className="spinner"></div>;

    return (
        <div>
            <h2 style={{ fontWeight: 700, marginBottom: 24 }}>Responses for Exam Students</h2>
            {students.length === 0 ? (
                <p className="text-muted">No one has started this exam yet.</p>
            ) : (
                <div className="flex flex-col gap-lg">
                    {students.map(student => {
                        const studentResponses = data.responses.filter(r => r.studentId === student.studentId);
                        
                        return (
                            <div key={student._id} className="card shadow-sm" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                                    <h3 style={{ margin: 0, fontWeight: 700 }}>
                                        <i className="fa-solid fa-user-graduate text-primary" style={{ marginRight: 8 }}></i>
                                        {student.name} <span className="text-muted" style={{ fontSize: '0.8em', fontWeight: 400 }}>({student.studentId})</span>
                                    </h3>
                                </div>
                                <div className="table-wrapper" style={{ margin: 0, border: 'none' }}>
                                    <table style={{ margin: 0 }}>
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
                                            {data.questions.map(q => {
                                                const resp = studentResponses.find(r => r.questionId && r.questionId.toString() === q._id.toString());
                                                const isSelected = selectedStudent?.studentId === student.studentId && selectedQ?._id === q._id;
                                                
                                                return (
                                                    <tr
                                                        key={q._id}
                                                        className={resp?.manuallyGraded ? 'text-muted' : resp?.autoGraded ? 'bg-light' : ''}
                                                        onClick={() => { 
                                                            setSelectedStudent(student);
                                                            setSelectedResp(resp || null); 
                                                            setSelectedQ(q); 
                                                            setManualScore(resp?.score != null ? resp.score.toString() : '');
                                                        }}
                                                        style={{ cursor: 'pointer', background: isSelected ? 'rgba(var(--accent-primary-rgb), 0.1)' : undefined }}
                                                    >
                                                        <td>{q.questionText}</td>
                                                        <td>{resp?.selectedAnswer || '—'}</td>
                                                        <td>{resp?.score != null ? resp.score : '-'}</td>
                                                        <td>
                                                            <button
                                                                className="btn btn-sm btn-secondary"
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    setSelectedStudent(student);
                                                                    setSelectedResp(resp || null); 
                                                                    setSelectedQ(q); 
                                                                    setManualScore(resp?.score != null ? resp.score.toString() : '');
                                                                }}
                                                            >
                                                                Select
                                                            </button>
                                                        </td>
                                                        <td>
                                                            {resp?.isCorrect == null
                                                                ? '—'
                                                                : resp.isCorrect
                                                                    ? <i className="fa-solid fa-circle-check text-success"></i>
                                                                    : <i className="fa-solid fa-circle-xmark text-danger"></i>}
                                                        </td>
                                                        <td>
                                                            {q.type === 'open-ended' ? (
                                                                <>
                                                                    <button
                                                                        className="btn btn-sm btn-success"
                                                                        onClick={(e) => { e.stopPropagation(); setSelectedStudent(student); grade(resp, q, true, manualScore || null); }}
                                                                    >Correct</button>
                                                                    <button
                                                                        className="btn btn-sm btn-danger ml-sm"
                                                                        onClick={(e) => { e.stopPropagation(); setSelectedStudent(student); grade(resp, q, false, manualScore || null); }}
                                                                    >Incorrect</button>
                                                                </>
                                                            ) : (
                                                                <span className="text-muted">Auto</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                
                                {selectedStudent?.studentId === student.studentId && selectedQ && (
                                    <div className="fade-in" style={{ padding: '20px', borderTop: '4px solid var(--accent-primary)', backgroundColor: 'var(--bg-secondary)' }}>
                                        <div className="flex items-center justify-between mb-sm">
                                            <h4 style={{ margin: 0 }}>Grading: {selectedQ.questionText}</h4>
                                            <span className="badge badge-info">{selectedQ.type.toUpperCase()}</span>
                                        </div>
                                        <p className="text-secondary mb-md">Student Answer: <strong style={{color: 'var(--text-primary)'}}>{selectedResp?.selectedAnswer || '(Empty)'}</strong></p>
                                        
                                        <div className="grid-2 gap-md items-end">
                                            <div className="input-group" style={{ marginBottom: 0 }}>
                                                <label>Points Awarded (Max: {selectedQ.points || 1})</label>
                                                <input 
                                                    type="number" 
                                                    className="input" 
                                                    value={manualScore} 
                                                    onChange={e => setManualScore(e.target.value)}
                                                    placeholder="Enter score"
                                                />
                                            </div>
                                            <div className="flex gap-sm">
                                                <button 
                                                    className="btn btn-success" 
                                                    style={{ flex: 1 }}
                                                    onClick={() => grade(selectedResp, selectedQ, true, manualScore)}
                                                >
                                                    Mark Correct
                                                </button>
                                                <button 
                                                    className="btn btn-danger" 
                                                    style={{ flex: 1 }}
                                                    onClick={() => grade(selectedResp, selectedQ, false, manualScore)}
                                                >
                                                    Mark Wrong
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-muted mt-sm" style={{ fontSize: 11 }}>
                                            * You can enter partial credit (e.g. 5 points instead of 10) and then click Correct/Wrong.
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

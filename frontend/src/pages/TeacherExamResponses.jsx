import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { broadcastResultExamSync } from '../utils/resultExamSync';

function isSameResponseSlot(response, studentId, questionId) {
    return response?.studentId === studentId
        && response?.questionId?.toString() === questionId?.toString();
}

export default function TeacherExamResponses() {
    const { id } = useParams(); // exam id
    const [students, setStudents] = useState([]);
    const [data, setData] = useState({ questions: [], responses: [] });
    const [loading, setLoading] = useState(true);
    const [gradingKey, setGradingKey] = useState('');
    const [questionPageByStudent, setQuestionPageByStudent] = useState({});

    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedResp, setSelectedResp] = useState(null);
    const [selectedQ, setSelectedQ] = useState(null);
    const [manualScore, setManualScore] = useState('');

    const selectResponse = useCallback((student, question, resp) => {
        setSelectedStudent(student);
        setSelectedResp(resp || null);
        setSelectedQ(question);
        setManualScore(resp?.score != null ? resp.score.toString() : '');
    }, []);

    const setStudentQuestionPage = useCallback((studentId, page) => {
        setQuestionPageByStudent((prev) => ({ ...prev, [studentId]: page }));
    }, []);

    const loadExamData = useCallback(async ({ preserveSelection = false, studentId = null, questionId = null } = {}) => {
        try {
            if (!preserveSelection) setLoading(true);
            const [studentsRes, dataRes] = await Promise.all([
                api.get(`/exams/${id}/students`),
                api.get(`/exams/${id}/all-responses`),
            ]);
            setStudents(studentsRes.data);
            setData(dataRes.data);

            if (preserveSelection) {
                const targetStudentId = studentId || selectedStudent?.studentId;
                const targetQuestionId = questionId || selectedQ?._id;
                const updatedStudent = studentsRes.data.find(student => student.studentId === targetStudentId) || selectedStudent;
                const updatedQuestion = dataRes.data.questions.find(question => question._id === targetQuestionId) || selectedQ;
                const updatedResp = dataRes.data.responses.find((response) =>
                    isSameResponseSlot(response, targetStudentId, targetQuestionId)
                ) || null;

                if (updatedStudent) setSelectedStudent(updatedStudent);
                if (updatedQuestion) setSelectedQ(updatedQuestion);
                setSelectedResp(updatedResp);
                setManualScore(updatedResp?.score != null ? updatedResp.score.toString() : '');
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    }, [id, selectedQ?._id, selectedStudent?.studentId]);

    useVoiceCommands({
        correct: () => grade(selectedStudent, selectedResp, selectedQ, true, manualScore || null),
        incorrect: () => grade(selectedStudent, selectedResp, selectedQ, false, manualScore || null),
    });

    useEffect(() => {
        loadExamData();
    }, [loadExamData]);

    useEffect(() => {
        if (!selectedStudent && students.length > 0) {
            setSelectedStudent(students[0]);
        }
    }, [selectedStudent, students]);

    const applyOptimisticGrade = useCallback((student, resp, question, correct, score) => {
        const optimisticResponse = {
            ...resp,
            _id: resp?._id || `temp-${student.studentId}-${question._id}`,
            studentId: student.studentId,
            questionId: question._id,
            selectedAnswer: resp?.selectedAnswer || '',
            isCorrect: correct,
            score,
            autoGraded: false,
            manuallyGraded: true,
            teacherFeedback: correct ? 'Correct' : 'Incorrect'
        };

        setData((prev) => ({
            ...prev,
            responses: [
                ...prev.responses.filter((response) => !isSameResponseSlot(response, student.studentId, question._id)),
                optimisticResponse
            ]
        }));

        selectResponse(student, question, optimisticResponse);
    }, [selectResponse]);

    const grade = useCallback(async (student, resp, question, correct, customScore = null) => {
        if (!question || !student) return;
        
        const score = customScore !== null && customScore !== '' ? Number(customScore) : (correct ? (question.points || 1) : 0);
        const maxPoints = Number(question.points || 1);
        const safeScore = Number.isFinite(score) ? score : 0;
        const cappedScore = Math.min(Math.max(safeScore, 0), maxPoints);
        const requestKey = `${student.studentId}:${question._id}`;
        
        try {
            setGradingKey(requestKey);
            applyOptimisticGrade(student, resp, question, correct, cappedScore);

            await api.put(`/exams/${id}/students/${student.studentId}/responses/${resp?._id || 'new'}`, {
                isCorrect: correct,
                score: cappedScore,
                teacherFeedback: correct ? 'Correct' : 'Incorrect',
                questionId: question._id
            });

            await loadExamData({
                preserveSelection: true,
                studentId: student.studentId,
                questionId: question._id
            });
            broadcastResultExamSync({
                source: 'teacher-exam-responses',
                examId: id,
                studentId: student.studentId
            });
        } catch (err) {
            console.error('Grading error', err);
            await loadExamData({
                preserveSelection: true,
                studentId: student.studentId,
                questionId: question._id
            });
        } finally {
            setGradingKey('');
        }
    }, [applyOptimisticGrade, id, loadExamData]);

    if (loading && students.length === 0) return <div className="spinner"></div>;

    const examTotalPoints = data.questions.reduce((sum, question) => sum + (Number(question.points) || 1), 0);
    const activeStudent = selectedStudent || students[0] || null;

    const activeResponses = activeStudent
        ? data.responses.filter(r => r.studentId === activeStudent.studentId)
        : [];
    const activeTotalScore = activeResponses.reduce((sum, response) => sum + (Number(response.score) || 0), 0);

    const pageSize = 8;
    const totalQuestions = data.questions.length;
    const totalPages = Math.max(Math.ceil(totalQuestions / pageSize), 1);
    const currentPage = activeStudent
        ? Math.min(questionPageByStudent[activeStudent.studentId] ?? 0, totalPages - 1)
        : 0;
    const startIndex = currentPage * pageSize;
    const pageQuestions = data.questions.slice(startIndex, startIndex + pageSize);

    return (
        <div>
            <h2 style={{ fontWeight: 700, marginBottom: 24 }}>Responses for Exam Students</h2>
            {students.length === 0 ? (
                <p className="text-muted">No one has started this exam yet.</p>
            ) : (
                <div className="flex flex-col gap-lg">
                    <div className="card" style={{ padding: 20 }}>
                        <div className="grid-2 gap-lg" style={{ alignItems: 'start' }}>
                            {(() => {
                                const openEndedIds = new Set(
                                    data.questions.filter(q => q.type === 'open-ended').map(q => q._id?.toString())
                                );

                                const isStudentComplete = (studentId) => {
                                    if (openEndedIds.size === 0) return true;
                                    const studentResponses = data.responses.filter(r => r.studentId === studentId);
                                    const gradedIds = new Set(
                                        studentResponses
                                            .filter(r => r.manuallyGraded && r.isCorrect != null)
                                            .map(r => r.questionId?.toString())
                                    );
                                    for (const qid of openEndedIds) {
                                        if (!gradedIds.has(qid)) return false;
                                    }
                                    return true;
                                };

                                const completedStudents = students.filter(s => isStudentComplete(s.studentId));
                                const pendingStudents = students.filter(s => !isStudentComplete(s.studentId));

                                const renderList = (list, title) => (
                                    <div>
                                        <div className="text-muted" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                                            {title}
                                        </div>
                                        <div style={{ display: 'grid', gap: 8 }}>
                                            {list.length === 0 ? (
                                                <div className="text-muted" style={{ fontSize: 13 }}>None</div>
                                            ) : (
                                                list.map((student, idx) => {
                                                    const isActive = activeStudent?.studentId === student.studentId;
                                                    return (
                                                        <button
                                                            key={student.studentId}
                                                            className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                                                            onClick={() => {
                                                                setSelectedStudent(student);
                                                                setSelectedQ(null);
                                                                setSelectedResp(null);
                                                            }}
                                                        >
                                                            {idx + 1}. {student.name} ({student.studentId})
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                );

                                return (
                                    <>
                                        {renderList(completedStudents, 'Completed')}
                                        {renderList(pendingStudents, 'Needs Grading')}
                                    </>
                                );
                            })()}
                        </div>
                        {activeStudent && (
                            <div
                                style={{
                                    marginTop: 16,
                                    minWidth: 150,
                                    padding: '10px 14px',
                                    borderRadius: 12,
                                    background: 'rgba(var(--accent-primary-rgb), 0.08)',
                                    border: '1px solid rgba(var(--accent-primary-rgb), 0.16)',
                                    textAlign: 'right'
                                }}
                            >
                                <div className="text-muted" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Score
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                                    {activeTotalScore} / {examTotalPoints}
                                </div>
                            </div>
                        )}
                    </div>

                    {activeStudent && (
                        <div className="card shadow-sm" style={{ padding: 0, overflow: 'hidden' }}>
                            <div
                                className="flex items-center justify-between gap-md"
                                style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}
                            >
                                <h3 style={{ margin: 0, fontWeight: 700 }}>
                                    <i className="fa-solid fa-user-graduate text-primary" style={{ marginRight: 8 }}></i>
                                    {activeStudent.name} <span className="text-muted" style={{ fontSize: '0.8em', fontWeight: 400 }}>({activeStudent.studentId})</span>
                                </h3>
                                <span className="badge badge-info">{data.questions.length} Questions</span>
                            </div>

                            <div className="table-wrapper" style={{ margin: 0, border: 'none' }}>
                                <table style={{ margin: 0 }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: 70 }}>#</th>
                                            <th>Question</th>
                                            <th>Answer</th>
                                            <th style={{ width: 80 }}>Score</th>
                                            <th style={{ width: 80 }}>Status</th>
                                            <th style={{ width: 260 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageQuestions.map((q, idx) => {
                                            const resp = activeResponses.find(r => r.questionId && r.questionId.toString() === q._id.toString());
                                            const isSelected = selectedQ?._id === q._id;
                                            const isGradingThisRow = gradingKey === `${activeStudent.studentId}:${q._id}`;

                                            return (
                                                <tr
                                                    key={q._id}
                                                    className={resp?.manuallyGraded ? 'text-muted' : resp?.autoGraded ? 'bg-light' : ''}
                                                    onClick={() => selectResponse(activeStudent, q, resp)}
                                                    style={{ cursor: 'pointer', background: isSelected ? 'rgba(var(--accent-primary-rgb), 0.1)' : undefined }}
                                                >
                                                    <td>{startIndex + idx + 1}</td>
                                                    <td>{q.questionText}</td>
                                                    <td>{resp?.selectedAnswer || '-'}</td>
                                                    <td>{resp?.score != null ? resp.score : '-'}</td>
                                                    <td>
                                                        {resp?.isCorrect == null
                                                            ? '-'
                                                            : resp.isCorrect
                                                                ? <i className="fa-solid fa-circle-check text-success"></i>
                                                                : <i className="fa-solid fa-circle-xmark text-danger"></i>}
                                                    </td>
                                                    <td>
                                                        <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                                            <button
                                                                className="btn btn-sm btn-secondary"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    selectResponse(activeStudent, q, resp);
                                                                }}
                                                            >
                                                                Select
                                                            </button>
                                                            {q.type === 'open-ended' ? (
                                                                <>
                                                                    <button
                                                                        className="btn btn-sm btn-success"
                                                                        disabled={isGradingThisRow}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            grade(activeStudent, resp, q, true, isSelected ? manualScore || null : resp?.score ?? null);
                                                                        }}
                                                                    >{isGradingThisRow ? 'Saving...' : 'Correct'}</button>
                                                                    <button
                                                                        className="btn btn-sm btn-danger"
                                                                        disabled={isGradingThisRow}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            grade(activeStudent, resp, q, false, isSelected ? manualScore || null : resp?.score ?? null);
                                                                        }}
                                                                    >{isGradingThisRow ? 'Saving...' : 'Incorrect'}</button>
                                                                </>
                                                            ) : (
                                                                <span className="text-muted" style={{ alignSelf: 'center' }}>Auto</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex items-center justify-between gap-md" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)' }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>
                                    Page {currentPage + 1} of {totalPages}
                                </span>
                                <div className="flex gap-sm">
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => setStudentQuestionPage(activeStudent.studentId, Math.max(currentPage - 1, 0))}
                                        disabled={currentPage === 0}
                                    >
                                        Prev
                                    </button>
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => setStudentQuestionPage(activeStudent.studentId, Math.min(currentPage + 1, totalPages - 1))}
                                        disabled={currentPage >= totalPages - 1}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>

                            {selectedQ && (
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
                                                min="0"
                                                max={selectedQ.points || 1}
                                                onChange={e => setManualScore(e.target.value)}
                                                placeholder="Enter score"
                                            />
                                        </div>
                                        <div className="flex gap-sm">
                                            <button 
                                                className="btn btn-success" 
                                                style={{ flex: 1 }}
                                                disabled={gradingKey === `${activeStudent.studentId}:${selectedQ._id}`}
                                                onClick={() => grade(activeStudent, selectedResp, selectedQ, true, manualScore)}
                                            >
                                                {gradingKey === `${activeStudent.studentId}:${selectedQ._id}` ? 'Saving...' : 'Mark Correct'}
                                            </button>
                                            <button 
                                                className="btn btn-danger" 
                                                style={{ flex: 1 }}
                                                disabled={gradingKey === `${activeStudent.studentId}:${selectedQ._id}`}
                                                onClick={() => grade(activeStudent, selectedResp, selectedQ, false, manualScore)}
                                            >
                                                {gradingKey === `${activeStudent.studentId}:${selectedQ._id}` ? 'Saving...' : 'Mark Wrong'}
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-muted mt-sm" style={{ fontSize: 11 }}>
                                        * You can enter partial credit (e.g. 5 points instead of 10) and then click Correct/Wrong.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

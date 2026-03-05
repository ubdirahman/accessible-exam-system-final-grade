import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { useTTS } from '../hooks/useTTS';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import api from '../api/axios';

export default function StudentDashboard() {
    const { user, logout } = useAuth();
    const { startExam } = useExam();
    const { speak } = useTTS();
    const navigate = useNavigate();
    const [examResult, setExamResult] = useState(null);
    const [examData, setExamData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [waitingStart, setWaitingStart] = useState(false);
    const [waitingRepeat, setWaitingRepeat] = useState(false);
    const [hasSpokenIntro, setHasSpokenIntro] = useState(false);
    const [confirmStartPending, setConfirmStartPending] = useState(false);

    const speakExamInstructions = useCallback((payload = examData) => {
        const data = payload || examData;
        const exam = data?.exam;
        if (!exam) return;

        const totalQuestions = data?.questions?.length || 0;
        const description = exam.description ? `${exam.description} ` : '';
        const timeLine = exam.timeLimit > 0
            ? `You have ${exam.timeLimit} minutes to finish. `
            : 'This exam is not timed. ';

        const text = [
            `Welcome ${user?.name || 'student'}. Ku soo dhawoow ${user?.name || 'araday'}.`,
            `You are scheduled for the exam titled ${exam.title}.`,
            description,
            `It contains ${totalQuestions} questions.`,
            timeLine,
            'Should I start the exam now? Please say Yes or No. Ma ku bilaabaa imtixaanka? Haa ama Maya.'
        ].join(' ');

        // Slightly slower than default so it is easy to follow
        speak(text, { rate: 1.0 });
        setWaitingStart(true);
        setConfirmStartPending(true);
        setWaitingRepeat(false);
    }, [examData, speak, user?.name]);

    const handleAffirmative = () => {
        if (waitingStart && confirmStartPending) {
            setWaitingStart(false);
            setConfirmStartPending(false);
            startExamNow();
        } else if (waitingRepeat) {
            setWaitingRepeat(false);
            speakExamInstructions();
            // speakExamInstructions sets waitingStart for us
        }
    };

    const handleNegative = () => {
        if (waitingStart || waitingRepeat) {
            setWaitingRepeat(false);
            speakExamInstructions();
        }
    };

    const requestStartConfirmation = () => {
        setWaitingStart(true);
        setConfirmStartPending(true);
        speak('Ma bilaabi karaa imtixaanka? Should I start the exam now? Please say Yes or No.', { rate: 1.0 });
    };

    // Voice Commands
    const commandMap = {
        'start exam': () => {
            console.log('Voice: Start exam command');
            requestStartConfirmation();
        },
        'begin exam': () => requestStartConfirmation(),
        'start': () => requestStartConfirmation(),
        'repeat instructions': () => {
            if (examData?.exam) {
                speakExamInstructions();
            }
        },
        'help me': () => {
            speak('Sideen ku caawin karaa? I can repeat the exam instructions or start the exam. Say "Repeat instructions" or say "Start exam" when you are ready.');
            setWaitingRepeat(true);
            setWaitingStart(false);
            setConfirmStartPending(false);
        },
        'yes': handleAffirmative,
        'haa': handleAffirmative, // Somali: yes
        'no': handleNegative,
        'maya': handleNegative,   // Somali: no
        'logout': () => {
            speak('Logging out.');
            logout();
            navigate('/');
        },
        'log out': () => {
            speak('Logging out.');
            logout();
            navigate('/');
        },
        'sign out': () => {
            speak('Signing out.');
            logout();
            navigate('/');
        },
        'exit': () => {
            speak('Exiting.');
            logout();
            navigate('/');
        },
        'close': () => {
            speak('Closing session.');
            logout();
            navigate('/');
        }
    };

    const { isListening, startListening, stopListening } = useVoiceCommands(commandMap, true);

    useEffect(() => {
        loadExam();
        loadResults();
        startListening(); // Start voice listening
    }, []);

    useEffect(() => {
        if (examData?.exam && !examResult && !hasSpokenIntro) {
            speakExamInstructions(examData);
            setHasSpokenIntro(true);
        }
    }, [examData, examResult, hasSpokenIntro, speakExamInstructions]);

    const loadExam = async () => {
        try {
            const res = await api.get(`/exams/${user.examId}`);
            setExamData(res.data);
        } catch (err) {
            console.error('Load exam error:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadResults = async () => {
        try {
            const res = await api.get(`/results/${user.studentId}`);
            // Find result for current exam
            const currentResult = res.data.find(r => r.examId._id === user.examId || r.examId === user.examId);
            if (currentResult) {
                setExamResult(currentResult);
            }
        } catch (err) {
            console.error('Load results error:', err);
        }
    };

    async function startExamNow() {
        if (examResult) {
            navigate('/student/result');
            return;
        }

        try {
            const res = await api.post(`/exams/${user.examId}/start`);
            startExam(res.data.exam, res.data.sections, res.data.questions);
            navigate('/student/exam');
        } catch (err) {
            const msg = err.response?.data?.message || 'Could not start exam.';

            // If error is "already completed", try to load results
            if (err.response?.status === 400 && msg.includes('already completed')) {
                loadResults();
            }
        }
    }

    if (loading) {
        return (
            <div className="loading-page">
                <div className="spinner"></div>
                <p>Loading exam details...</p>
            </div>
        );
    }

    const exam = examData?.exam;

    return (
        <div className="page">
            <div className="app-container">
                {/* Header */}
                <div className="navbar" style={{ position: 'relative', borderRadius: 'var(--radius)', marginBottom: 32 }}>
                    <div className="navbar-brand">
                        <span className="icon" aria-hidden="true"><i className="fa-solid fa-universal-access"></i></span>
                        Student Dashboard
                    </div>
                    <div className="navbar-actions">
                        <span className="badge badge-info"><i className="fa-solid fa-user-graduate" aria-hidden="true"></i> {user?.name}</span>
                        <button className="btn btn-secondary btn-sm" onClick={() => { logout(); navigate('/'); }}>
                            Logout
                        </button>
                    </div>
                </div>

                {exam ? (
                    <>
                        {/* Exam Info Card */}
                        <div className="card" style={{ marginBottom: 24 }}>
                            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, marginBottom: 12 }}>
                                <i className="fa-solid fa-clipboard-list" aria-hidden="true"></i> {exam.title}
                            </h2>
                            <p className="text-muted" style={{ marginBottom: 20 }}>{exam.description}</p>

                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-value">{exam.timeLimit}</div>
                                    <div className="stat-label">Minutes</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{examData.questions?.length || 0}</div>
                                    <div className="stat-label">Questions</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value" aria-hidden="true">
                                        <i className={`fa-solid ${exam.timeLimit > 0 ? 'fa-hourglass-half' : 'fa-infinity'}`}></i>
                                    </div>
                                    <div className="stat-label">{exam.timeLimit > 0 ? 'Timed' : 'No Time Limit'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Instructions */}
                        {!examResult && (
                            <div className="card" style={{ marginBottom: 24 }}>
                                <h3 style={{ marginBottom: 16, fontWeight: 700 }}><i className="fa-solid fa-microphone-lines" aria-hidden="true"></i> Voice Commands</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                                    {[
                                        '"Next Question" — Go to next',
                                        '"Previous Question" — Go back',
                                        '"Option A/B/C/D" — Select answer',
                                        '"Repeat Question" — Hear again',
                                        '"Skip Question" — Skip current',
                                        '"How many remaining" — Check progress',
                                        '"Return to Unanswered" — Go to skipped',
                                        '"Finish Exam" — Submit exam',
                                        '"I don\'t understand" — Ask for explanation',
                                        '"Help me" — Get support',
                                        '"What does [word] mean" — Define a word',
                                        '"I feel nervous" — Calming advice'
                                    ].map((cmd, i) => (
                                        <div key={i} style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)' }}>
                                            {cmd}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Start Button */}
                        <div className="text-center">
                            {examResult ? (
                                <div>
                                    <div className="badge badge-success mb-md" style={{ display: 'inline-flex', padding: '12px 24px', fontSize: '1.1rem' }}>
                                        <i className="fa-solid fa-circle-check" aria-hidden="true"></i> Exam Completed
                                    </div>
                                    <br />
                                    <button
                                        className="btn btn-secondary btn-lg"
                                        onClick={() => navigate('/student/result')}
                                        style={{ padding: '20px 60px', fontSize: 'var(--font-size-xl)', marginTop: 16 }}
                                    >
                                        <i className="fa-solid fa-chart-column" aria-hidden="true"></i> View Results
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        className="btn btn-primary btn-lg"
                                        onClick={requestStartConfirmation}
                                        aria-label="Start Exam"
                                        style={{ padding: '20px 60px', fontSize: 'var(--font-size-xl)' }}
                                    >
                                        <i className="fa-solid fa-rocket" aria-hidden="true"></i> Start Exam
                                    </button>
                                    <p className="text-muted mt-md">Or say &quot;Start Exam&quot;</p>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="card text-center">
                        <h2>No exam available</h2>
                        <p className="text-muted mt-md">Your exam may not be active yet. Contact your administrator.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

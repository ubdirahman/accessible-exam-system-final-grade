import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { useTTS } from '../hooks/useTTS';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import api from '../api/axios';

function joinNamesForSpeech(names = []) {
    if (!names.length) return 'none';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export default function ResultPage() {
    const { user, logout } = useAuth();
    const { result, exam, resetExamSession } = useExam();
    const { speak } = useTTS();
    const navigate = useNavigate();

    const [details, setDetails] = useState(result?.details);
    const [latestResult, setLatestResult] = useState(result);
    const [queueData, setQueueData] = useState(null);
    const [queueLoaded, setQueueLoaded] = useState(false);
    const [hasSpokenIntro, setHasSpokenIntro] = useState(false);

    const showResult = latestResult || result;
    const finishedSubjectName = exam?.subjectName || exam?.title || latestResult?.examId?.title || 'this subject';
    const remainingSubjects = (queueData?.exams || [])
        .filter((entry) => entry.status !== 'completed')
        .map((entry) => entry.subjectName);

    const handleLogout = useCallback(() => {
        resetExamSession();
        logout();
        navigate('/');
    }, [logout, navigate, resetExamSession]);

    const readDetails = useCallback(() => {
        const list = details || showResult?.details;
        if (!list?.length) {
            speak('There is no detailed feedback available yet.');
            return;
        }

        const phrases = list.map((entry, idx) => {
            const status = entry.isCorrect === true
                ? 'correct'
                : entry.isCorrect === false
                    ? 'incorrect'
                    : 'still waiting for grading';
            return `Question ${idx + 1} is ${status}. ${entry.teacherFeedback || ''}`.trim();
        });

        speak(phrases.join(' '));
    }, [details, showResult, speak]);

    const speakQueueSummary = useCallback(() => {
        if (!queueData) return;

        if (queueData.currentExam) {
            speak(
                `You have completed ${queueData.completedCount} of ${queueData.totalCount} exams. ` +
                `Your next subject is ${queueData.currentExam.subjectName}. ` +
                `Remaining subjects are ${joinNamesForSpeech(remainingSubjects)}.`
            );
            return;
        }

        if (queueData.totalCount > 0) {
            speak(`You have completed all ${queueData.totalCount} exams. There are no remaining subjects.`);
            return;
        }

        speak('There are no active exams remaining right now.');
    }, [queueData, remainingSubjects, speak]);

    const speakResultSummary = useCallback((includeNextStep = true) => {
        if (!showResult) return;

        const messages = [
            `You completed ${finishedSubjectName}.`,
            `Your score is ${showResult.score} out of ${showResult.totalPoints}.`,
            `${showResult.percentage} percent.`,
            `${showResult.correctCount} correct, ${showResult.wrongCount} wrong, and ${showResult.skippedCount} skipped.`,
            `Time taken ${Math.floor((showResult.timeTaken || 0) / 60)} minutes and ${(showResult.timeTaken || 0) % 60} seconds.`
        ];

        if (queueData?.currentExam) {
            messages.push(`You have now completed ${queueData.completedCount} of ${queueData.totalCount} exams.`);
            messages.push(`When you log in again, your next subject will be ${queueData.currentExam.subjectName}.`);
            messages.push(`The remaining subjects are ${joinNamesForSpeech(remainingSubjects)}.`);
        } else if (queueData?.totalCount > 0) {
            messages.push(`You have completed all ${queueData.totalCount} exams.`);
        }

        if (includeNextStep) {
            messages.push('Say logout to leave now, or say dashboard to hear the exam plan again.');
        }

        speak(messages.join(' '));
    }, [finishedSubjectName, queueData, remainingSubjects, showResult, speak]);

    useEffect(() => {
        const loadPageData = async () => {
            if (!user?.studentId) return;
            setQueueLoaded(false);
            setHasSpokenIntro(false);

            try {
                const [resultsRes, queueRes] = await Promise.all([
                    api.get(`/results/${user.studentId}`),
                    api.get('/exams/student/queue')
                ]);

                const list = Array.isArray(resultsRes.data) ? resultsRes.data : [];
                const currentExamId = exam?.id || exam?._id || user?.examId;
                const current = currentExamId
                    ? list.find((entry) => entry.examId?._id === currentExamId || entry.examId === currentExamId)
                    : list[0];

                if (current) {
                    setLatestResult(current);
                    if (current.details) setDetails(current.details);
                }

                setQueueData(queueRes.data);
            } catch (err) {
                console.error('Could not load result page data', err);
            } finally {
                setQueueLoaded(true);
            }
        };

        loadPageData();
    }, [exam, user?.examId, user?.studentId]);

    const commandMap = {
        'read feedback': () => readDetails(),
        'read details': () => readDetails(),
        'read questions': () => readDetails(),
        'eeg faahfaahinta': () => readDetails(),
        'akhri natiijada': () => speakResultSummary(false),
        'read results': () => speakResultSummary(false),
        'read summary': () => speakResultSummary(false),
        'next exam': () => speakQueueSummary(),
        'remaining subjects': () => speakQueueSummary(),
        'dashboard': () => navigate('/student/dashboard'),
        'go to dashboard': () => navigate('/student/dashboard'),
        'logout': () => handleLogout(),
        'log out': () => handleLogout(),
        'sign out': () => handleLogout(),
        'exit': () => handleLogout()
    };
    const { startListening, stopListening } = useVoiceCommands(commandMap, true);

    useEffect(() => {
        startListening();
        return () => {
            stopListening();
        };
    }, [startListening, stopListening]);

    useEffect(() => {
        if (!showResult || hasSpokenIntro || !queueLoaded) return;
        speakResultSummary(true);
        setHasSpokenIntro(true);
    }, [hasSpokenIntro, queueLoaded, showResult, speakResultSummary]);

    if (!showResult) {
        return (
            <div className="page">
                <div className="app-container text-center">
                    <h2>No result available</h2>
                    <button className="btn btn-primary mt-lg" onClick={() => navigate('/')}>
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    const passed = showResult.percentage >= 50;

    const handleDownloadPDF = async () => {
        const examId = exam?.id || exam?._id || user?.examId;
        if (!examId) return;

        try {
            const res = await api.get(`/results/${user.studentId}/${examId}/pdf`, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `result_${user.studentId}_${examId}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('PDF download failed', err);
        }
    };

    return (
        <div className="page">
            <div className="app-container">
                <div className="navbar" style={{ position: 'relative', borderRadius: 'var(--radius)', marginBottom: 32 }}>
                    <div className="navbar-brand">
                        <span className="icon" aria-hidden="true"><i className="fa-solid fa-flag-checkered"></i></span>
                        Exam Results
                    </div>
                    <div className="navbar-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/student/dashboard')}>
                            Dashboard
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </div>

                <div className="card text-center" style={{ marginBottom: 24, padding: 40 }}>
                    <div style={{ fontSize: 72, marginBottom: 16 }}>
                        <i className={`fa-solid ${passed ? 'fa-trophy' : 'fa-book-open'}`}></i>
                    </div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginBottom: 8 }}>
                        {passed ? 'Congratulations!' : 'Keep Studying!'}
                    </h1>
                    <p className="text-muted" style={{ marginBottom: 16 }}>
                        Finished Subject: {finishedSubjectName}
                    </p>
                    <div className={`badge ${passed ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 'var(--font-size-lg)', padding: '12px 28px', marginBottom: 20 }}>
                        <i className={`fa-solid ${passed ? 'fa-circle-check' : 'fa-circle-xmark'}`} aria-hidden="true"></i> {passed ? 'PASSED' : 'NOT PASSED'}
                    </div>

                    <div className="stat-value" style={{ fontSize: 64, margin: '16px 0' }}>
                        {showResult.percentage}%
                    </div>
                    <p className="text-muted" style={{ fontSize: 'var(--font-size-lg)' }}>
                        {showResult.score} / {showResult.totalPoints} points
                    </p>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: 'var(--success)' }}>
                            {showResult.correctCount}
                        </div>
                        <div className="stat-label"><i className="fa-solid fa-circle-check" aria-hidden="true"></i> Correct</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: 'var(--danger)' }}>
                            {showResult.wrongCount}
                        </div>
                        <div className="stat-label"><i className="fa-solid fa-circle-xmark" aria-hidden="true"></i> Wrong</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: 'var(--warning)' }}>
                            {showResult.skippedCount}
                        </div>
                        <div className="stat-label"><i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Skipped</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">
                            {Math.floor((showResult.timeTaken || 0) / 60)}:{String((showResult.timeTaken || 0) % 60).padStart(2, '0')}
                        </div>
                        <div className="stat-label"><i className="fa-solid fa-clock" aria-hidden="true"></i> Time Taken</div>
                    </div>
                </div>

                {queueData && (
                    <div className="card" style={{ marginTop: 24 }}>
                        <h3 style={{ marginBottom: 16, fontWeight: 700 }}>
                            <i className="fa-solid fa-route" aria-hidden="true"></i> Next Exam Plan
                        </h3>
                        <div className="stats-grid" style={{ marginBottom: 20 }}>
                            <div className="stat-card">
                                <div className="stat-value">{queueData.completedCount}</div>
                                <div className="stat-label">Completed Now</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{queueData.totalCount}</div>
                                <div className="stat-label">Total Exams</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{queueData.currentExam ? queueData.currentExam.subjectName : 'None'}</div>
                                <div className="stat-label">Next Subject</div>
                            </div>
                        </div>

                        <p className="text-muted" style={{ marginBottom: 8 }}>
                            {queueData.currentExam
                                ? `When the student logs in again, the next subject will be ${queueData.currentExam.subjectName}.`
                                : 'There is no next subject remaining.'}
                        </p>
                        <p className="text-muted">
                            Remaining subjects: {remainingSubjects.length ? remainingSubjects.join(', ') : 'none'}
                        </p>
                    </div>
                )}

                <div className="flex justify-between mt-lg" style={{ justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary btn-lg" onClick={handleDownloadPDF}>
                        <i className="fa-solid fa-file-arrow-down" aria-hidden="true"></i> Download PDF Report
                    </button>
                    <button className="btn btn-secondary btn-lg" onClick={() => speakResultSummary(false)}>
                        <i className="fa-solid fa-volume-high" aria-hidden="true"></i> Read Results
                    </button>
                    <button className="btn btn-secondary btn-lg" onClick={readDetails} disabled={!details && !showResult?.details}>
                        <i className="fa-solid fa-comments" aria-hidden="true"></i> Read Feedback
                    </button>
                    <button className="btn btn-secondary btn-lg" onClick={() => navigate('/student/dashboard')}>
                        <i className="fa-solid fa-table-columns" aria-hidden="true"></i> Dashboard
                    </button>
                    <button className="btn btn-secondary btn-lg" onClick={handleLogout}>
                        <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Logout
                    </button>
                </div>
            </div>
        </div>
    );
}

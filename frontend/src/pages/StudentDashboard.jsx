import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { useTTS } from '../hooks/useTTS';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import api from '../api/axios';
import useConfirmDialog from '../hooks/useConfirmDialog';

function joinNamesForSpeech(names = []) {
    if (!names.length) return 'none';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function getLatestCompletedExam(exams = []) {
    return exams
        .filter((exam) => exam.status === 'completed')
        .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))[0] || null;
}

export default function StudentDashboard() {
    const { user, logout } = useAuth();
    const { startExam, resetExamSession, ensureExamRecording, recordingState } = useExam();
    const { speak } = useTTS();
    const navigate = useNavigate();

    const [queueData, setQueueData] = useState(null);
    const [examData, setExamData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hasSpokenIntro, setHasSpokenIntro] = useState(false);
    const [waitingStart, setWaitingStart] = useState(false);
    const [waitingRepeat, setWaitingRepeat] = useState(false);
    const [confirmStartPending, setConfirmStartPending] = useState(false);
    const [confirmLogoutPending, setConfirmLogoutPending] = useState(false);
    const { confirmDialog, askConfirm, triggerConfirm, triggerCancel } = useConfirmDialog();

    const currentExam = queueData?.currentExam || null;
    const exams = queueData?.exams || [];
    const completedExams = exams.filter((exam) => exam.status === 'completed');
    const remainingAfterCurrent = exams.filter((exam) => exam.status === 'remaining');
    const latestCompletedExam = getLatestCompletedExam(exams);

    const handleLogout = useCallback(async () => {
        setConfirmLogoutPending(true);
        speak('Ma hubtaa inaad rabto inaad ka baxdo? Dheh haa ama maya.', { lang: 'so-SO', rate: 1.0 });
        const confirmed = await askConfirm({
            title: 'Logout Confirmation',
            message: 'Are you sure you want to log out of the system?',
            confirmText: 'Yes, Logout',
            cancelText: 'Cancel',
            type: 'warning'
        });
        if (confirmed) {
            setConfirmLogoutPending(false);
            await resetExamSession({ recordingStatus: 'stopped' });
            logout();
            navigate('/');
        } else {
            setConfirmLogoutPending(false);
            speak('Ka bixitaankii waa la joojiyay.', { lang: 'so-SO', rate: 1.0 });
        }
    }, [askConfirm, logout, navigate, resetExamSession, speak]);

    const loadDashboardData = useCallback(async () => {
        setLoading(true);
        setError('');
        setWaitingStart(false);
        setWaitingRepeat(false);
        setConfirmStartPending(false);

        try {
            const queueRes = await api.get('/exams/student/queue');
            const nextExamId = queueRes.data.currentExam?.id;
            let nextExamData = null;

            if (nextExamId) {
                const examRes = await api.get(`/exams/${nextExamId}`);
                nextExamData = examRes.data;
            }

            setQueueData(queueRes.data);
            setExamData(nextExamData);
            setHasSpokenIntro(false);
        } catch (err) {
            console.error('Load student dashboard error:', err);
            setError(err.response?.data?.message || 'Could not load your exam dashboard.');
        } finally {
            setLoading(false);
        }
    }, []);

    const buildDashboardSpeech = useCallback((includeStartPrompt = true) => {
        const totalCount = queueData?.totalCount || 0;
        const completedCount = queueData?.completedCount || 0;
        const completedNames = completedExams.map((exam) => exam.subjectName);
        const remainingNames = remainingAfterCurrent.map((exam) => exam.subjectName);
        const currentSubject = currentExam?.subjectName || currentExam?.title;
        const currentTitle = currentExam?.title || currentExam?.subjectName;
        const totalQuestions = examData?.questions?.length || 0;
        const timeLimit = currentExam?.timeLimit || examData?.exam?.timeLimit || 0;

        if (totalCount === 0) {
            return [
                `Kula soo dhawoow gacmo furan, ${user?.name || 'arday'}.`,
                'Ma jiraan imtixaano hadda kuu qorshaysan oo aad u fadhiisan karto.',
                'Fadlan dheh "ka bax" marka aad rabto inaad ka baxdo nidaamka.'
            ].join(' ');
        }

        if (!currentExam) {
            return [
                `Kula soo dhawoow gacmo furan, ${user?.name || 'arday'}.`,
                `Waxaad si guul leh u dhammaystirtay dhammaan ${completedCount} imtixaan oo kuu qorshaysnaa.`,
                completedNames.length
                    ? `Maaddooyinka aad u fadhiisatay ee aad dhammaystirtay waa: ${joinNamesForSpeech(completedNames)}.`
                    : 'Wali ma aadan dhammaystirin wax imtixaan ah.',
                'Ma jiraan imtixaano kale oo kuu dhiman.',
                latestCompletedExam
                    ? `Imtixaankii ugu dambeeyay ee aad dhammaystirtay wuxuu ahaa maaddada: ${latestCompletedExam.subjectName}.`
                    : '',
                'Dheh "ka bax" si aad uga baxdo nidaamka.'
            ].filter(Boolean).join(' ');
        }

        return [
            `Kula soo dhawoow gacmo furan, ${user?.name || 'arday'}.`,
            `Waxaad leedahay wadar ahaan ${totalCount} imtixaan oo kuu qorshaysan.`,
            completedCount > 0
                ? `Waxaad mar hore si guul leh u dhammaystirtay ${completedCount} imtixaan oo kala ah: ${joinNamesForSpeech(completedNames)}.`
                : 'Wali ma aadan dhammaystirin wax imtixaan ah.',
            `Hadda waxaad u fadhiisanaysaa imtixaanka maaddada ${currentSubject}.`,
            currentTitle && currentTitle !== currentSubject
                ? `Ciwaanka rasmiga ah ee imtixaanku waa: ${currentTitle}.`
                : '',
            remainingNames.length
                ? `Maaddadan ka dib, imtixaanada kale ee kuu dhiman waa: ${joinNamesForSpeech(remainingNames)}.`
                : 'Imtixaankan ka dib, ma jiraan maaddooyin kale oo kuu dhiman.',
            totalQuestions > 0 ? `Imtixaankani wuxuu ka kooban yahay ${totalQuestions} su'aalood.` : '',
            timeLimit > 0 ? `Waxaad haysataa muddo dhan ${timeLimit} daqiiqo oo aad ku dhammayso.` : 'Imtixaankani waqti xaddidan ma laha.',
            includeStartPrompt ? 'Miyaan bilaabaa imtixaanka hadda? Fadlan dheh haa ama maya.' : ''
        ].filter(Boolean).join(' ');
    }, [completedExams, currentExam, examData, latestCompletedExam, queueData, remainingAfterCurrent, user?.name]);

    const speakDashboardSummary = useCallback((includeStartPrompt = true) => {
        const text = buildDashboardSpeech(includeStartPrompt);
        if (!text) return;

        speak(text, { lang: 'so-SO', rate: 1.0 });
        setWaitingRepeat(false);

        if (currentExam && includeStartPrompt) {
            setWaitingStart(true);
            setConfirmStartPending(true);
        } else {
            setWaitingStart(false);
            setConfirmStartPending(false);
        }
    }, [buildDashboardSpeech, currentExam, speak]);

    const speakCompletedSubjects = useCallback(() => {
        if (!completedExams.length) {
            speak('Wali ma aadan dhammaystirin wax imtixaan ah.', { lang: 'so-SO' });
            return;
        }

        speak(`Waxaad si guul leh u dhammaystirtay ${completedExams.length} imtixaan oo kala ah: ${joinNamesForSpeech(completedExams.map((exam) => exam.subjectName))}.`, { lang: 'so-SO' });
    }, [completedExams, speak]);

    const speakRemainingSubjects = useCallback(() => {
        if (!currentExam) {
            speak('Ma jiraan imtixaano kale oo kuu dhiman.', { lang: 'so-SO' });
            return;
        }

        if (!remainingAfterCurrent.length) {
            speak(`Hadda waxaad u fadhiisanaysaa imtixaanka maaddada ${currentExam.subjectName}. Imtixaankan ka dib, ma jiraan imtixaano kale oo kuu dhiman.`, { lang: 'so-SO' });
            return;
        }

        speak(`Hadda waxaad u fadhiisanaysaa imtixaanka maaddada ${currentExam.subjectName}. Imtixaanada ku xiga ee kuu dhiman waa: ${joinNamesForSpeech(remainingAfterCurrent.map((exam) => exam.examId || exam.subjectName))}.`, { lang: 'so-SO' });
    }, [currentExam, remainingAfterCurrent, speak]);

    const requestStartConfirmation = useCallback(() => {
        if (!currentExam) {
            speak('Ma jiro imtixaan diyaar ah oo aad hadda bilaabi karto.', { lang: 'so-SO' });
            return;
        }

        setWaitingStart(true);
        setConfirmStartPending(true);
        speak('Miyaan bilaabaa imtixaankaaga hadda? Fadlan dheh haa ama maya.', { lang: 'so-SO', rate: 1.0 });
    }, [currentExam, speak]);

    async function startExamNow() {
        if (!currentExam?.id) {
            speak('Ma jiro imtixaan diyaar ah oo aad hadda bilaabi karto.', { lang: 'so-SO' });
            return;
        }

        try {
            await ensureExamRecording({
                examId: currentExam.id,
                examTitle: currentExam.title,
                subjectName: currentExam.subjectName,
                studentId: user?.studentId,
                studentName: user?.name
            });
            const res = await api.post(`/exams/${currentExam.id}/start`);
            startExam(res.data.exam, res.data.sections, res.data.questions);
            navigate('/student/exam');
        } catch (err) {
            const msg = err.response?.data?.message || 'Could not start the exam.';
            console.error('Start exam error:', err);

            if (err.response?.status === 400 && msg.toLowerCase().includes('already')) {
                await loadDashboardData();
                speak('Imtixaankaas mar hore ayaad dhammaystirtay. Waan cusboonaysiiyay boggaaga waxaana kuu soo doortay imtixaanka ku xiga.', { lang: 'so-SO', rate: 1.0 });
                return;
            }

            speak(msg, { lang: 'so-SO', rate: 1.0 });
        }
    }

    const handleAffirmative = useCallback(() => {
        if (confirmLogoutPending) {
            triggerConfirm();
            return;
        }

        if (waitingStart && confirmStartPending) {
            setWaitingStart(false);
            setConfirmStartPending(false);
            startExamNow();
            return;
        }

        if (waitingRepeat) {
            setWaitingRepeat(false);
            speakDashboardSummary(!!currentExam);
        }
    }, [confirmLogoutPending, triggerConfirm, confirmStartPending, currentExam, speakDashboardSummary, waitingRepeat, waitingStart]);

    const handleNegative = useCallback(() => {
        if (confirmLogoutPending) {
            triggerCancel();
            return;
        }

        if (waitingStart || waitingRepeat) {
            setWaitingStart(false);
            setConfirmStartPending(false);
            setWaitingRepeat(true);
            speak('Haye. Dheh ku celi warbixinta si aad mar kale u maqasho qorshahaaga, ama dheh ka bax markaad diyaar tahay.', { lang: 'so-SO', rate: 1.0 });
        }
    }, [confirmLogoutPending, triggerCancel, speak, waitingRepeat, waitingStart]);

    const commandMap = {
        'start exam': () => requestStartConfirmation(),
        'begin exam': () => requestStartConfirmation(),
        'start': () => requestStartConfirmation(),
        'start next exam': () => requestStartConfirmation(),
        'begin next exam': () => requestStartConfirmation(),
        'take exam': () => requestStartConfirmation(),
        'go to exam': () => requestStartConfirmation(),
        'repeat instructions': () => speakDashboardSummary(...[!!currentExam]),
        'repeat summary': () => speakDashboardSummary(false),
        'repeat dashboard': () => speakDashboardSummary(false),
        'dashboard summary': () => speakDashboardSummary(false),
        'read summary': () => speakDashboardSummary(false),
        'tell me summary': () => speakDashboardSummary(false),
        'tell summary': () => speakDashboardSummary(false),
        'how many exams': () => speakDashboardSummary(false),
        'how many subjects': () => speakDashboardSummary(false),
        'current subject': () => {
            if (currentExam) {
                speak(`Hadda waxaad u fadhiisanaysaa imtixaanka maaddada ${currentExam.subjectName}.`, { lang: 'so-SO', rate: 1.0 });
            } else {
                speak('Ma jiraan imtixaano hadda kuu furan oo aad u fadhiisan karto.', { lang: 'so-SO', rate: 1.0 });
            }
        },
        'what am i taking': () => {
            if (currentExam) {
                speak(`Hadda waxaad u fadhiisanaysaa imtixaanka maaddada ${currentExam.subjectName}.`, { lang: 'so-SO', rate: 1.0 });
            } else {
                speak('Ma jiraan imtixaano hadda kuu furan oo aad u fadhiisan karto.', { lang: 'so-SO', rate: 1.0 });
            }
        },
        'what is next': () => speakRemainingSubjects(),
        'remaining subjects': () => speakRemainingSubjects(),
        'remaining exams': () => speakRemainingSubjects(),
        'completed subjects': () => speakCompletedSubjects(),
        'refresh dashboard': () => loadDashboardData(),
        'reload dashboard': () => loadDashboardData(),
        'refresh': () => loadDashboardData(),
        'reload': () => loadDashboardData(),
        'help me': () => {
            speak(
                currentExam
                    ? 'Waxaad dhihi kartaa: "bilow imtixaan", "ku celi warbixinta", "imtixaanada dhammaaday", "imtixaanada haray", "cusboonaysii bogga", ama "ka bax".'
                    : 'Waxaad dhihi kartaa: "ku celi warbixinta", "imtixaanada dhammaaday", "cusboonaysii bogga", ama "ka bax".',
                { lang: 'so-SO', rate: 1.0 }
            );
            setWaitingRepeat(true);
        },
        'yes': handleAffirmative,
        'haa': handleAffirmative,
        'no': handleNegative,
        'maya': handleNegative,
        'logout': () => handleLogout(),
        'log out': () => handleLogout(),
        'sign out': () => handleLogout(),
        'exit': () => handleLogout(),
        'logout system': () => handleLogout(),
        'sign out of system': () => handleLogout(),
        'try': () => {
            if (confirmLogoutPending) {
                speak('Ma hubtaa inaad rabto inaad ka baxdo? Dheh haa ama maya.', { lang: 'so-SO', rate: 1.0 });
            } else if (confirmStartPending) {
                speak('Miyaan bilaabaa imtixaankaaga hadda? Fadlan dheh haa ama maya.', { lang: 'so-SO', rate: 1.0 });
            } else {
                speakDashboardSummary(false);
            }
        },
        'again': () => {
            if (confirmLogoutPending) {
                speak('Ma hubtaa inaad rabto inaad ka baxdo? Dheh haa ama maya.', { lang: 'so-SO', rate: 1.0 });
            } else if (confirmStartPending) {
                speak('Miyaan bilaabaa imtixaankaaga hadda? Fadlan dheh haa ama maya.', { lang: 'so-SO', rate: 1.0 });
            } else {
                speakDashboardSummary(false);
            }
        },
        'try again': () => {
            if (confirmLogoutPending) {
                speak('Ma hubtaa inaad rabto inaad ka baxdo? Dheh haa ama maya.', { lang: 'so-SO', rate: 1.0 });
            } else if (confirmStartPending) {
                speak('Miyaan bilaabaa imtixaankaaga hadda? Fadlan dheh haa ama maya.', { lang: 'so-SO', rate: 1.0 });
            } else {
                speakDashboardSummary(false);
            }
        },
        'repeat': () => {
            if (confirmLogoutPending) {
                speak('Ma hubtaa inaad rabto inaad ka baxdo? Dheh haa ama maya.', { lang: 'so-SO', rate: 1.0 });
            } else if (confirmStartPending) {
                speak('Miyaan bilaabaa imtixaankaaga hadda? Fadlan dheh haa ama maya.', { lang: 'so-SO', rate: 1.0 });
            } else {
                speakDashboardSummary(false);
            }
        }
    };

    const { isListening, startListening, stopListening } = useVoiceCommands(commandMap, true);

    useEffect(() => {
        loadDashboardData();
        startListening();

        return () => {
            stopListening();
        };
    }, [loadDashboardData, startListening, stopListening]);

    useEffect(() => {
        if (loading || !queueData || hasSpokenIntro) return;
        if (currentExam && !examData) return;

        speakDashboardSummary(!!currentExam);
        setHasSpokenIntro(true);
    }, [currentExam, examData, hasSpokenIntro, loading, queueData, speakDashboardSummary]);

    useEffect(() => {
        if (!currentExam?.id) return;

        ensureExamRecording({
            examId: currentExam.id,
            examTitle: currentExam.title,
            subjectName: currentExam.subjectName,
            studentId: user?.studentId,
            studentName: user?.name
        }).catch((error) => {
            console.error('Recording setup failed on dashboard:', error);
        });
    }, [currentExam?.id, currentExam?.subjectName, currentExam?.title, ensureExamRecording, user?.name, user?.studentId]);

    if (loading) {
        return (
            <div className="loading-page">
                <div className="spinner"></div>
                <p>Loading your exams...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="app-container">
                <div className="navbar" style={{ position: 'relative', borderRadius: 'var(--radius)', marginBottom: 32 }}>
                    <div className="navbar-brand">
                        <span className="icon" aria-hidden="true"><i className="fa-solid fa-universal-access"></i></span>
                        Student Dashboard
                    </div>
                    <div className="navbar-actions">
                        <span className={`badge ${isListening ? 'badge-success' : 'badge-info'}`}>
                            <i className="fa-solid fa-ear-listen" aria-hidden="true"></i> {isListening ? 'Voice Ready' : 'Voice Off'}
                        </span>
                        <span className={`badge ${
                            recordingState.status === 'recording'
                                ? 'badge-success'
                                : recordingState.status === 'error'
                                    ? 'badge-danger'
                                    : 'badge-warning'
                        }`}>
                            <i className="fa-solid fa-microphone-lines" aria-hidden="true"></i> {recordingState.status === 'recording' ? 'Recording On' : recordingState.status === 'error' ? 'Recording Error' : 'Recording Standby'}
                        </span>
                        <span className="badge badge-info"><i className="fa-solid fa-user-graduate" aria-hidden="true"></i> {user?.name}</span>
                        <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="badge badge-danger" style={{ marginBottom: 16, width: '100%', justifyContent: 'center', padding: 14 }} role="alert">
                        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> {error}
                    </div>
                )}

                <div className="card" style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, marginBottom: 16 }}>
                        <i className="fa-solid fa-list-check" aria-hidden="true"></i> Exam Plan
                    </h2>

                    <div className="stats-grid" style={{ marginBottom: 20 }}>
                        <div className="stat-card">
                            <div className="stat-value">{queueData?.totalCount || 0}</div>
                            <div className="stat-label">Total Exams</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--success)' }}>{queueData?.completedCount || 0}</div>
                            <div className="stat-label">Completed</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: currentExam ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                                {currentExam ? currentExam.subjectName : 'None'}
                            </div>
                            <div className="stat-label">Current Subject</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--warning)' }}>{queueData?.remainingCount || 0}</div>
                            <div className="stat-label">Not Finished Yet</div>
                        </div>
                    </div>

                    <p className="text-muted" style={{ marginBottom: 8 }}>
                        {completedExams.length
                            ? `Completed subjects: ${completedExams.map((exam) => exam.subjectName).join(', ')}`
                            : 'Completed subjects: none yet'}
                    </p>
                    <p className="text-muted">
                        {currentExam
                            ? `Remaining after current subject: ${remainingAfterCurrent.length ? remainingAfterCurrent.map((exam) => exam.subjectName).join(', ') : 'none'}`
                            : 'Remaining after current subject: none'}
                    </p>
                </div>

                {currentExam ? (
                    <div className="card" style={{ marginBottom: 24 }}>
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, marginBottom: 8 }}>
                            <i className="fa-solid fa-book-open-reader" aria-hidden="true"></i> {currentExam.subjectName}
                        </h2>
                        {currentExam.title !== currentExam.subjectName && (
                            <p className="text-muted" style={{ marginBottom: 8 }}>
                                Exam Title: {currentExam.title}
                            </p>
                        )}
                        {currentExam.description && (
                            <p className="text-muted" style={{ marginBottom: 20 }}>{currentExam.description}</p>
                        )}

                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-value">{examData?.questions?.length || 0}</div>
                                <div className="stat-label">Questions</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{currentExam.timeLimit || 0}</div>
                                <div className="stat-label">Minutes</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{(queueData?.completedCount || 0) + 1}</div>
                                <div className="stat-label">Current Order</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="card text-center" style={{ marginBottom: 24 }}>
                        <h2>All available exams are complete</h2>
                        <p className="text-muted mt-md">
                            {latestCompletedExam
                                ? `Your latest completed subject is ${latestCompletedExam.subjectName}.`
                                : 'There is no unfinished exam waiting for you.'}
                        </p>
                    </div>
                )}

                <div className="card" style={{ marginBottom: 24 }}>
                    <h3 style={{ marginBottom: 16, fontWeight: 700 }}>
                        <i className="fa-solid fa-layer-group" aria-hidden="true"></i> Subject Queue
                    </h3>

                    <div style={{ display: 'grid', gap: 12 }}>
                        {exams.length ? exams.map((exam) => (
                            <div
                                key={exam.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 16,
                                    padding: '14px 16px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-secondary)'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 700 }}>{exam.subjectName}</div>
                                    {exam.title !== exam.subjectName && (
                                        <div className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{exam.title}</div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    {exam.status === 'completed' && exam.totalPoints > 0 && (
                                        <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                                            {exam.score}/{exam.totalPoints}
                                        </span>
                                    )}
                                    <span className={`badge ${
                                        exam.status === 'completed'
                                            ? 'badge-success'
                                            : exam.status === 'current'
                                                ? 'badge-info'
                                                : 'badge-warning'
                                    }`}>
                                        {exam.status === 'completed'
                                            ? 'Completed'
                                            : exam.status === 'current'
                                                ? 'Current'
                                                : 'Waiting'}
                                    </span>
                                </div>
                            </div>
                        )) : (
                            <p className="text-muted">No active exams are available for this student right now.</p>
                        )}
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 24 }}>
                    <h3 style={{ marginBottom: 16, fontWeight: 700 }}>
                        <i className="fa-solid fa-microphone-lines" aria-hidden="true"></i> Voice Commands
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                        {[
                            '"Start Exam" to begin the current subject',
                            '"Repeat Summary" to hear the full exam plan again',
                            '"Completed Subjects" to hear what you already finished',
                            '"Remaining Subjects" to hear what is left',
                            '"Current Subject" to hear what you are taking now',
                            '"Refresh Dashboard" to update the plan',
                            '"Logout" to leave the system'
                        ].map((cmd) => (
                            <div key={cmd} style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)' }}>
                                {cmd}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="text-center">
                    {currentExam ? (
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={requestStartConfirmation}
                            aria-label="Start next exam"
                            style={{ padding: '20px 60px', fontSize: 'var(--font-size-xl)' }}
                        >
                            <i className="fa-solid fa-rocket" aria-hidden="true"></i> Start Next Exam
                        </button>
                    ) : (
                        <button
                            className="btn btn-secondary btn-lg"
                            onClick={handleLogout}
                            style={{ padding: '20px 60px', fontSize: 'var(--font-size-xl)' }}
                        >
                            <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Logout
                        </button>
                    )}
                    <p className="text-muted mt-md">
                        {currentExam ? 'Or say "Start Exam"' : 'Or say "Logout"'}
                    </p>
                </div>
            </div>
            {confirmDialog}
        </div>
    );
}

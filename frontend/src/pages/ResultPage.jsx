import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { useTTS } from '../hooks/useTTS';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import api from '../api/axios';

export default function ResultPage() {
    const { user, logout } = useAuth();
    const { result, exam, questions, answers } = useExam();
    const { speak } = useTTS();
    const navigate = useNavigate();

    const [details, setDetails] = useState(result?.details);
    const [latestResult, setLatestResult] = useState(result);

    // if result exists but missing details, refetch from server
    useEffect(() => {
        const loadDetails = async () => {
            if (!user?.studentId || !exam) return;
            try {
                const res = await api.get(`/results/${user.studentId}`);
                const list = Array.isArray(res.data) ? res.data : [];
                const current = list.find(r => r.examId._id === (exam?.id || exam?._id) || r.examId === (exam?.id || exam?._id));
                if (current) {
                    setLatestResult(current);
                    if (current.details) setDetails(current.details);
                }
            } catch (err) {
                console.error('Could not load result details', err);
            }
        };
        loadDetails();
    }, [user?.studentId, exam]);

    // voice commands for reading detailed feedback
    const commandMap = {
        'read feedback': () => readDetails(),
        'read details': () => readDetails(),
        'read questions': () => readDetails(),
        'eeg faahfaahinta': () => readDetails(),
        'akhri natiijada': () => {
            const data = latestResult || result;
            if (data) {
                speak(
                    `Exam complete. Your score is ${data.score} out of ${data.totalPoints}. ` +
                    `${data.percentage} percent. ${data.correctCount} correct, ${data.wrongCount} wrong, ${data.skippedCount} skipped.`
                );
            }
        }
    };
    const { isListening, startListening, stopListening } = useVoiceCommands(commandMap, true);

    useEffect(() => {
        if (latestResult || result) {
            const data = latestResult || result;
            speak(
                `Exam complete. Your score is ${data.score} out of ${data.totalPoints}. ` +
                `${data.percentage} percent. ${data.correctCount} correct, ${data.wrongCount} wrong, ${data.skippedCount} skipped. ` +
                `Time taken: ${Math.floor((data.timeTaken || 0) / 60)} minutes and ${(data.timeTaken || 0) % 60} seconds.`
            );
            // start listening to allow user to say "read feedback"
            startListening();
        }
    }, [latestResult]);

    const showResult = latestResult || result;

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

    const readDetails = () => {
        const list = details || showResult?.details;
        if (!list) return;
        const phrases = list.map((d, idx) => {
            const status = d.isCorrect ? 'correct' : d.isCorrect === false ? 'incorrect' : 'ungraded';
            return `Question ${idx + 1} ${status}. ${d.teacherFeedback || ''}`;
        });
        speak(phrases.join(' '));
    };

    return (
        <div className="page">
            <div className="app-container">
                {/* Header */}
                <div className="navbar" style={{ position: 'relative', borderRadius: 'var(--radius)', marginBottom: 32 }}>
                    <div className="navbar-brand">
                        <span className="icon" aria-hidden="true"><i className="fa-solid fa-flag-checkered"></i></span>
                        Exam Results
                    </div>
                    <div className="navbar-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => { logout(); navigate('/'); }}>
                            Logout
                        </button>
                    </div>
                </div>

                {/* Result hero */}
                <div className="card text-center" style={{ marginBottom: 24, padding: 40 }}>
                    <div style={{ fontSize: 72, marginBottom: 16 }}>
                        <i className={`fa-solid ${passed ? 'fa-trophy' : 'fa-book-open'}`}></i>
                    </div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginBottom: 8 }}>
                        {passed ? 'Congratulations!' : 'Keep Studying!'}
                    </h1>
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

                {/* Stats */}
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

                {/* Actions */}
                <div className="flex justify-between mt-lg" style={{ justifyContent: 'center', gap: 16 }}>
                    <button className="btn btn-primary btn-lg" onClick={handleDownloadPDF}>
                        <i className="fa-solid fa-file-arrow-down" aria-hidden="true"></i> Download PDF Report
                    </button>
                    <button className="btn btn-secondary btn-lg" onClick={() => {
                        speak(`Your score is ${result.percentage} percent. ${result.correctCount} correct, ${result.wrongCount} wrong, ${result.skippedCount} waiting.`);
                    }}>
                        <i className="fa-solid fa-volume-high" aria-hidden="true"></i> Read Results
                    </button>
                    <button className="btn btn-secondary btn-lg" onClick={readDetails} disabled={!details && !result?.details}>
                        <i className="fa-solid fa-comments" aria-hidden="true"></i> Read Feedback
                    </button>
                </div>
            </div>
        </div>
    );
}

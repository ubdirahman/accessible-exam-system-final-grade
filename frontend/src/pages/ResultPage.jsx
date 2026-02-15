import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { useTTS } from '../hooks/useTTS';

export default function ResultPage() {
    const { user, logout } = useAuth();
    const { result, exam, questions, answers } = useExam();
    const { speak } = useTTS();
    const navigate = useNavigate();

    useEffect(() => {
        if (result) {
            speak(
                `Exam complete. Your score is ${result.score} out of ${result.totalPoints}. ` +
                `${result.percentage} percent. ${result.correctCount} correct, ${result.wrongCount} wrong, ${result.skippedCount} skipped. ` +
                `Time taken: ${Math.floor(result.timeTaken / 60)} minutes and ${result.timeTaken % 60} seconds.`
            );
        }
    }, [result]);

    if (!result) {
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

    const passed = result.percentage >= 50;

    const handleDownloadPDF = () => {
        const url = `/api/results/${user.studentId}/${exam?.id || user.examId}/pdf`;
        window.open(url, '_blank');
    };

    return (
        <div className="page">
            <div className="app-container">
                {/* Header */}
                <div className="navbar" style={{ position: 'relative', borderRadius: 'var(--radius)', marginBottom: 32 }}>
                    <div className="navbar-brand">
                        <span className="icon">🏆</span>
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
                        {passed ? '🎉' : '📚'}
                    </div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginBottom: 8 }}>
                        {passed ? 'Congratulations!' : 'Keep Studying!'}
                    </h1>
                    <div className={`badge ${passed ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 'var(--font-size-lg)', padding: '12px 28px', marginBottom: 20 }}>
                        {passed ? '✅ PASSED' : '❌ NOT PASSED'}
                    </div>

                    <div className="stat-value" style={{ fontSize: 64, margin: '16px 0' }}>
                        {result.percentage}%
                    </div>
                    <p className="text-muted" style={{ fontSize: 'var(--font-size-lg)' }}>
                        {result.score} / {result.totalPoints} points
                    </p>
                </div>

                {/* Stats */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: 'var(--success)' }}>
                            {result.correctCount}
                        </div>
                        <div className="stat-label">✅ Correct</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: 'var(--danger)' }}>
                            {result.wrongCount}
                        </div>
                        <div className="stat-label">❌ Wrong</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: 'var(--warning)' }}>
                            {result.skippedCount}
                        </div>
                        <div className="stat-label">⏭️ Skipped</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">
                            {Math.floor(result.timeTaken / 60)}:{String(result.timeTaken % 60).padStart(2, '0')}
                        </div>
                        <div className="stat-label">⏱️ Time Taken</div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between mt-lg" style={{ justifyContent: 'center', gap: 16 }}>
                    <button className="btn btn-primary btn-lg" onClick={handleDownloadPDF}>
                        📄 Download PDF Report
                    </button>
                    <button className="btn btn-secondary btn-lg" onClick={() => {
                        speak(`Your score is ${result.percentage} percent. ${result.correctCount} correct, ${result.wrongCount} wrong, ${result.skippedCount} skipped.`);
                    }}>
                        🔊 Read Results
                    </button>
                </div>
            </div>
        </div>
    );
}

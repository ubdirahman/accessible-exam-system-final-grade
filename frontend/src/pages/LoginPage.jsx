import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTTS } from '../hooks/useTTS';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import api from '../api/axios';

export default function LoginPage() {
    const [mode, setMode] = useState('student'); // 'student' | 'admin'
    const [studentId, setStudentId] = useState('');
    const [examCode, setExamCode] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const { speak } = useTTS();

    // Student Login Core Logic
    const performStudentLogin = useCallback(async (id = studentId) => {
        if (!id) {
            speak('Please provide your student I D first.');
            return;
        }
        setError('');
        setLoading(true);

        try {
            const res = await api.post('/student-login', { studentId: id });
            login(
                { ...res.data.student, role: 'student', examId: res.data.exam.id },
                res.data.token
            );
            speak(`Login successful. Welcome ${res.data.student.name}. Your exam is ready.`);
            navigate('/student/dashboard');
        } catch (err) {
            const msg = err.response?.data?.message || 'Login failed. Please check your I D.';
            setError(msg);
            speak(msg);

            // Clear textbox and restart listening if login failed
            setStudentId('');
            if (mode === 'student') {
                // Using a flag to restart listening
                window._shouldRestartListening = true;
            }
        } finally {
            setLoading(false);
        }
    }, [studentId, login, navigate, speak, mode]);

    const handleStudentLogin = (e) => {
        e.preventDefault();
        performStudentLogin();
    };

    const handleAdminLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await api.post('/admin-login', { email, password });
            login(res.data.admin, res.data.token);
            navigate('/admin/dashboard');
        } catch (err) {
            const msg = err.response?.data?.message || 'Login failed.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Voice Commands
    const commandMap = {
        'set student id': (id) => {
            console.log('Voice: Setting student ID to', id);
            setStudentId(id);
            speak(`I D ${id} entered. Say "Enter exam" to continue.`);
        },
        'enter exam': () => {
            console.log('Voice: Enter exam command');
            performStudentLogin();
        },
        'go exam': () => {
            console.log('Voice: Go exam command');
            performStudentLogin();
        },
        'begin': () => performStudentLogin(),
        'start': () => performStudentLogin()
    };

    const { isListening, transcript, lastCommand, startListening, stopListening } = useVoiceCommands(commandMap, mode === 'student');

    // Sync transcript to Student ID field ONLY AFTER speech ends (not during)
    // Wait for silence, then show text and auto-submit
    useEffect(() => {
        if (isListening && transcript && mode === 'student') {
            const lower = transcript.toLowerCase();

            // Don't show command phrases in textbox
            const commandPhrases = ['enter exam', 'go exam', 'begin', 'start'];
            const isCommand = commandPhrases.some(cmd => lower.includes(cmd));

            // Clear any previous timer
            clearTimeout(window._transcriptTimer);

            // Don't update textbox immediately - wait for speech to pause
            window._transcriptTimer = setTimeout(() => {
                // Speech has paused - now process and display
                if (lower.includes('my id is')) {
                    // Extract ID after "my id is"
                    const parts = lower.split('my id is');
                    if (parts[1]) {
                        const id = parts[1].trim().replace(/\s/g, '').toUpperCase();
                        setStudentId(id);

                        // Auto-submit IMMEDIATELY after displaying
                        if (id && id.length >= 3) {
                            console.log('Auto-submitting with ID:', id);
                            stopListening();
                            performStudentLogin(id);
                        }
                    }
                } else if (!isCommand) {
                    // Direct number input
                    const cleanText = transcript.replace(/\s/g, '').toUpperCase();
                    setStudentId(cleanText);

                    // Auto-submit if 4-6 characters
                    if (/^[A-Z0-9]{4,6}$/.test(cleanText)) {
                        console.log('Auto-submitting with detected ID:', cleanText);
                        stopListening();
                        performStudentLogin(cleanText);
                    }
                }
            }, 800); // Reduced to 800ms for snappier response
        }
    }, [transcript, isListening, mode, performStudentLogin, stopListening]);

    useEffect(() => {
        if (mode === 'student') {
            startListening();
            speak('Welcome. Please say "My I D is" followed by your identification number.');
        } else {
            stopListening();
        }
        return () => stopListening();
    }, [mode]);

    // Restart listening if login failed
    useEffect(() => {
        if (window._shouldRestartListening && !isListening) {
            window._shouldRestartListening = false;
            setTimeout(() => startListening(), 1000);
        }
    }, [loading, isListening, startListening]);

    return (
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Voice Indicator */}
            {mode === 'student' && (
                <div className={`voice-indicator ${isListening ? 'listening' : ''}`} style={{ position: 'fixed', top: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
                    <div className="voice-dot"></div>
                    <span>{isListening ? (lastCommand || 'Listening...') : 'Voice Off'}</span>
                </div>
            )}
            <div style={{ width: '100%', maxWidth: 520 }}>
                {/* Header */}
                <div className="text-center" style={{ marginBottom: 40 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>♿</div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginBottom: 8 }}>
                        Accessible Exam System
                    </h1>
                    <p className="text-muted" style={{ fontSize: 'var(--font-size-base)' }}>
                        Voice-controlled examination platform
                    </p>
                </div>

                {/* Role Tabs */}
                <div className="section-tabs" style={{ justifyContent: 'center', marginBottom: 24 }}>
                    <button
                        className={`section-tab ${mode === 'student' ? 'active' : ''}`}
                        onClick={() => { setMode('student'); setError(''); }}
                        aria-label="Switch to student login"
                    >
                        🎓 Student
                    </button>
                    <button
                        className={`section-tab ${mode === 'admin' ? 'active' : ''}`}
                        onClick={() => { setMode('admin'); setError(''); }}
                        aria-label="Switch to admin login"
                    >
                        🛡️ Admin
                    </button>
                </div>

                {/* Login Card */}
                <div className="card">
                    {error && (
                        <div className="badge badge-danger" style={{ marginBottom: 16, width: '100%', justifyContent: 'center', padding: 14 }} role="alert">
                            ⚠️ {error}
                        </div>
                    )}

                    {mode === 'student' ? (
                        <form onSubmit={handleStudentLogin}>
                            <div className="input-group">
                                <label htmlFor="studentId">Student ID</label>
                                <input
                                    id="studentId"
                                    className="input"
                                    type="text"
                                    placeholder="Enter your Student ID (e.g., STU001)"
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    required
                                    autoFocus
                                    aria-required="true"
                                />
                            </div>

                            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} type="submit" disabled={loading}>
                                {loading ? '⏳ Logging in...' : '🎤 Enter Exam'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleAdminLogin}>
                            <div className="input-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    id="email"
                                    className="input"
                                    type="email"
                                    placeholder="admin@exam.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="input-group">
                                <label htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    className="input"
                                    type="password"
                                    placeholder="Enter password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} type="submit" disabled={loading}>
                                {loading ? '⏳ Logging in...' : '🔐 Admin Login'}
                            </button>
                        </form>
                    )}

                    <div className="text-center mt-lg text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                        {mode === 'student'
                            ? '💡 Simply enter your Student ID to access your exam'
                            : '💡 Contact system admin if you forgot your credentials'
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}

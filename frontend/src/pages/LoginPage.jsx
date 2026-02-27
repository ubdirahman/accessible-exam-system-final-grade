import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTTS } from '../hooks/useTTS';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import api from '../api/axios';

export default function LoginPage() {
    const [mode, setMode] = useState('student'); // 'student' | 'admin'
    const [studentId, setStudentId] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Voice Flow State: 'IDLE' | 'LISTENING_ID' | 'CONFIRM_ID'
    const [voiceStep, setVoiceStep] = useState('IDLE');

    const { login } = useAuth();
    const navigate = useNavigate();
    const { speak, stop: stopSpeaking, isSpeaking } = useTTS();

    // Student Login Core Logic
    const performStudentLogin = useCallback(async (id = studentId) => {
        if (!id) {
            speak('Please provide your student I D first.', { rate: 1.2 });
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
            // Navuate immediately - Dashboard will handle the welcome speech
            navigate('/student/dashboard');
        } catch (err) {
            const msg = err.response?.data?.message || 'Login failed. Please check your I D.';
            setError(msg);
            speak(msg, { rate: 1.2 });

            // Clear textbox and restart listening if login failed
            setStudentId('');
            if (mode === 'student') {
                setVoiceStep('LISTENING_ID');
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

    // Voice Commands Map - Dynamic based on voiceStep
    const getCommandMap = () => {
        if (voiceStep === 'CONFIRM_ID') {
            return {
                'yes': () => {
                    console.log('Voice: Confirmed ID');
                    setVoiceStep('IDLE'); // Stop listening/flow while logging in
                    performStudentLogin();
                },
                'no': () => {
                    console.log('Voice: Rejected ID');
                    setStudentId('');
                    // Quick clear prompts
                    stopListening();
                    speak('Cleared. Enter I D.', {
                        rate: 1.3,
                        onEnd: () => {
                            setVoiceStep('LISTENING_ID');
                            startListening();
                        }
                    });
                },
                'cancel': () => {
                    setStudentId('');
                    stopListening();
                    speak('Cleared.', {
                        rate: 1.3,
                        onEnd: () => {
                            setVoiceStep('LISTENING_ID');
                            startListening();
                        }
                    });
                }
            };
        }

        // Default commands when listening for ID
        return {
            'set student id': (id) => {
                handleIdInput(id);
            }
        };
    };

    const { isListening, transcript, lastCommand, startListening, stopListening } = useVoiceCommands(getCommandMap(), mode === 'student');

    // Helper to switch between speaking and listening
    // This enforces the "Silencing" requirement
    const speakAndListen = useCallback((text, options = {}) => {
        stopListening(); // Turn off mic immediately
        speak(text, {
            ...options,
            onEnd: () => {
                if (options.onEnd) options.onEnd();
                // Turn mic back on ONLY after speech finishes
                startListening();
            }
        });
    }, [speak, startListening, stopListening]);

    // Helper to process valid ID input
    const handleIdInput = useCallback((id) => {
        if (!id || voiceStep !== 'LISTENING_ID') return;

        const cleanId = id.replace(/\s/g, '').toUpperCase();
        setStudentId(cleanId);

        // Transition to Confirmation
        setVoiceStep('CONFIRM_ID');
        // Stop Listen -> Speak -> Start Listen
        speakAndListen(`Are you sure? I D is ${cleanId.split('').join(' ')}. Yes or No?`, { rate: 1.2 });
    }, [voiceStep, speakAndListen]);

    // Transcript Processing specifically for capturing ID
    useEffect(() => {
        if (isListening && transcript && mode === 'student' && voiceStep === 'LISTENING_ID') {
            const lower = transcript.toLowerCase();

            // 1. Real-time visual update (Sound to Text)
            if (lower.includes('yes') || lower.includes('no')) return;

            let potentialId = transcript;
            if (lower.includes('my id is')) {
                const parts = lower.split('my id is');
                potentialId = parts[1] || '';
            }

            const cleanText = potentialId.replace(/\s/g, '').toUpperCase();

            // Textbox Update
            if (cleanText) {
                setStudentId(cleanText);
            }

            // 2. Debounce for Finalization
            clearTimeout(window._transcriptTimer);

            // 500ms delay to allow finishing the ID
            window._transcriptTimer = setTimeout(() => {
                // Finalize if we have content
                if (cleanText.length >= 1) {
                    handleIdInput(cleanText);
                }
            }, 500);
        }
    }, [transcript, isListening, mode, voiceStep, handleIdInput]);

    // Initial Welcome Flow
    useEffect(() => {
        if (mode === 'student') {
            // Reset state
            setStudentId('');
            setError('');
            setVoiceStep('LISTENING_ID');

            // Strict Sequence:
            // 1. System Speak "Welcome..." (Mic OFF)
            // 2. System Silent
            // 3. System Listen (Mic ON)
            speakAndListen('Welcome. Enter Student I D.', { rate: 1.2 });
        } else {
            stopListening();
            setVoiceStep('IDLE');
        }
    }, [mode, speakAndListen, stopListening]);

    // Restart listening if needed (e.g. after error)
    useEffect(() => {
        if (window._shouldRestartListening && !isListening) {
            window._shouldRestartListening = false;
            startListening();
        }
    }, [isListening, startListening]);

    return (
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Voice Indicator */}
            {mode === 'student' && (
                <div className={`voice-indicator ${isListening ? 'listening' : ''}`}
                    style={{
                        position: 'fixed',
                        top: 'clamp(80px, 15vh, 120px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1000,
                        width: 'max-content',
                        maxWidth: '90vw'
                    }}>
                    <div className="voice-dot"></div>
                    <span>
                        {voiceStep === 'CONFIRM_ID' ? 'Say Yes or No' :
                            isListening ? (lastCommand || 'Listening for ID...') : 'Voice Off'}
                    </span>
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
                                    // Visual cue for state
                                    style={{
                                        borderColor: voiceStep === 'CONFIRM_ID' ? 'var(--primary)' : undefined,
                                        boxShadow: voiceStep === 'CONFIRM_ID' ? '0 0 0 4px rgba(37, 99, 235, 0.1)' : undefined
                                    }}
                                />
                            </div>

                            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} type="submit" disabled={loading}>
                                {loading ? '⏳ Logging in...' : (voiceStep === 'CONFIRM_ID' ? '🎤 Say "Yes" to Confirm' : '🎤 Enter Exam')}
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
                            ? '💡 Speak your ID, then say Yes to confirm.'
                            : '💡 Contact system admin if you forgot your credentials'
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}

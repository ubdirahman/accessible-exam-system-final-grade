import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { useTTS } from '../hooks/useTTS';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import api from '../api/axios';
import {
    extractStudentIdChunks,
    extractSingleStudentIdCharacter,
    normalizeStudentIdFromSpeech,
    sanitizeStudentId,
    isLikelyStudentId,
    spellStudentId
} from '../utils/studentIdSpeech';

const LAST_STUDENT_ID_KEY = 'last_student_id';

export default function LoginPage() {
    const [mode, setMode] = useState('student'); // 'student' | 'admin' | 'teacher'
    const [studentId, setStudentId] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [studentStatus, setStudentStatus] = useState('');
    const [guidedEntryMode, setGuidedEntryMode] = useState(true);
    const [idConfirmationMode, setIdConfirmationMode] = useState('login');
    const [lastIdActivityAt, setLastIdActivityAt] = useState(Date.now());
    const [silenceConfirmedId, setSilenceConfirmedId] = useState('');

    // Voice Flow State: 'IDLE' | 'LISTENING_ID' | 'CONFIRM_ID'
    const [voiceStep, setVoiceStep] = useState('IDLE');
    const voiceStepRef = useRef('IDLE');
    const studentIdRef = useRef('');
    const lastProcessedSpeechRef = useRef({ text: '', time: 0 });
    const studentInputRef = useRef(null);

    const { login } = useAuth();
    const { ensureExamRecording } = useExam();
    const navigate = useNavigate();
    const { speak, stop } = useTTS();
    const interimIdTimeoutRef = useRef(null);

    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const isAudioPlayingRef = useRef(false);
    const audioSafetyTimeoutRef = useRef(null);
    const setAudioPlayingState = useCallback((playing) => {
        setIsAudioPlaying(playing);
        isAudioPlayingRef.current = playing;
        // Safety: auto-reset after 15 seconds to prevent permanent lock
        if (audioSafetyTimeoutRef.current) clearTimeout(audioSafetyTimeoutRef.current);
        if (playing) {
            audioSafetyTimeoutRef.current = setTimeout(() => {
                setIsAudioPlaying(false);
                isAudioPlayingRef.current = false;
            }, 15000);
        }
    }, []);

    useEffect(() => {
        voiceStepRef.current = voiceStep;
    }, [voiceStep]);

    useEffect(() => {
        studentIdRef.current = studentId;
        const status = studentId
            ? `Current student ID ${spellStudentId(studentId)}.`
            : `No student ID entered yet.`;
        setStudentStatus(status);
    }, [guidedEntryMode, studentId]);

    const listeningControlsRef = useRef({
        startListening: () => { },
        stopListening: () => { }
    });

    const focusStudentInput = useCallback(() => {
        requestAnimationFrame(() => {
            studentInputRef.current?.focus();
        });
    }, []);

    const markStudentIdActivity = useCallback(() => {
        setLastIdActivityAt(Date.now());
    }, []);

    const speakAndListen = useCallback((text, options = {}) => {
        const { startListening: resumeListening, stopListening: pauseListening } = listeningControlsRef.current;
        pauseListening();
        setAudioPlayingState(true);

        // Helper: resume listening after a short delay to prevent mic picking up audio tail
        const safeResume = () => {
            setTimeout(() => {
                if (mode === 'student') {
                    resumeListening();
                }
            }, 300);
        };

        speak(text, {
            lang: 'so-SO',
            ...options,
            onEnd: () => {
                setAudioPlayingState(false);
                if (options.onEnd) options.onEnd();
                safeResume();
            }
        });
    }, [mode, speak, setAudioPlayingState]);

    const playConfirmationSequence = useCallback((cleanId) => {
        const { startListening: resumeListening, stopListening: pauseListening } = listeningControlsRef.current;
        pauseListening();
        stop();
        setAudioPlayingState(true);

        // Helper: resume listening after a short delay to prevent mic picking up audio tail
        const safeResume = () => {
            setTimeout(() => {
                if (mode === 'student') {
                    resumeListening();
                }
            }, 300);
        };

        speak([
            'Ma hubtaa in nambarkaaga ardaygu yahay',
            spellStudentId(cleanId),
            'Dheh haa ama maya.'
        ], {
            lang: 'so-SO',
            onEnd: () => {
                setAudioPlayingState(false);
                safeResume();
            }
        });
    }, [mode, speak, stop, setAudioPlayingState]);

    const startGuidedEntry = useCallback((resetCurrent = false) => {
        const existingId = resetCurrent ? '' : sanitizeStudentId(studentIdRef.current);
        if (resetCurrent) {
            setStudentId('');
            setSilenceConfirmedId('');
        }

        setError('');
        setIdConfirmationMode('login');
        setVoiceStep('LISTENING_ID');
        setGuidedEntryMode(true);
        markStudentIdActivity();

        if (existingId) {
            speakAndListen(spellStudentId(existingId));
        } else {
            speakAndListen('Fadlan akhri nambarkaaga ardayga.');
        }
        focusStudentInput();
    }, [focusStudentInput, markStudentIdActivity, speakAndListen]);

    const stopGuidedEntry = useCallback(() => {
        setGuidedEntryMode(false);
        setIdConfirmationMode('login');
        setVoiceStep('LISTENING_ID');
        markStudentIdActivity();
        speakAndListen('Habkii hagaha waa la xiray.');
        focusStudentInput();
    }, [focusStudentInput, markStudentIdActivity, speakAndListen]);

    const readCurrentStudentId = useCallback(() => {
        const current = sanitizeStudentId(studentIdRef.current);
        if (!current) {
            speakAndListen('Fadlan akhri nambarkaaga ardayga.');
            focusStudentInput();
            return;
        }

        markStudentIdActivity();
        speakAndListen(spellStudentId(current));
        focusStudentInput();
    }, [focusStudentInput, markStudentIdActivity, speakAndListen]);

    const clearCurrentStudentId = useCallback((force = false) => {
        if (!force && studentIdRef.current) {
            setVoiceStep('CONFIRM_CLEAR');
            speakAndListen('Ma rabtaa inaad tirtirto nambarkii aad gelisay? Dheh haa ama maya.');
            focusStudentInput();
            return;
        }

        setStudentId('');
        setSilenceConfirmedId('');
        setError('');
        setIdConfirmationMode('login');
        setVoiceStep('LISTENING_ID');
        markStudentIdActivity();
        speakAndListen('Fadlan akhri nambarkaaga ardayga.');
        focusStudentInput();
    }, [focusStudentInput, markStudentIdActivity, speakAndListen]);

    const deleteLastStudentIdCharacter = useCallback(() => {
        const current = sanitizeStudentId(studentIdRef.current);
        if (!current) {
            speakAndListen('Fadlan mar kale akhri nambarkaaga ardayga.');
            focusStudentInput();
            return;
        }

        const updated = current.slice(0, -1);
        setStudentId(updated);
        setSilenceConfirmedId('');
        setError('');
        setIdConfirmationMode('login');
        setVoiceStep('LISTENING_ID');
        markStudentIdActivity();

        if (updated) {
            speakAndListen(spellStudentId(updated));
        } else {
            speakAndListen('Fadlan akhri nambarkaaga ardayga.');
        }

        focusStudentInput();
    }, [focusStudentInput, markStudentIdActivity, speakAndListen]);

    const promptStudentIdConfirmation = useCallback((candidate = studentIdRef.current) => {
        const cleanId = normalizeStudentIdFromSpeech(candidate) || sanitizeStudentId(candidate);
        if (!cleanId) {
            speakAndListen('Fadlan mar kale akhri nambarkaaga ardayga.');
            setStudentId('');
            setVoiceStep('LISTENING_ID');
            focusStudentInput();
            return;
        }

        const isValid = /^[A-Z]+[A-Z0-9]*$/.test(cleanId);
        if (!isValid) {
            speakAndListen('Fadlan mar kale akhri nambarkaaga ardayga.');
            setStudentId('');
            setVoiceStep('LISTENING_ID');
            focusStudentInput();
            return;
        }

        setStudentId(cleanId);
        setSilenceConfirmedId('');
        setError('');
        setIdConfirmationMode('login');
        setVoiceStep('CONFIRM_ID');
        playConfirmationSequence(cleanId);
        focusStudentInput();
    }, [focusStudentInput, playConfirmationSequence]);

    const promptSilenceStudentIdConfirmation = useCallback((candidate = studentIdRef.current) => {
        const cleanId = normalizeStudentIdFromSpeech(candidate) || sanitizeStudentId(candidate);
        if (!cleanId) return;

        setStudentId(cleanId);
        setError('');
        setIdConfirmationMode('save');
        setVoiceStep('CONFIRM_ID');
        playConfirmationSequence(cleanId);
        focusStudentInput();
    }, [focusStudentInput, playConfirmationSequence]);

    const saveStudentIdOnly = useCallback((candidate = studentIdRef.current) => {
        const cleanId = normalizeStudentIdFromSpeech(candidate) || sanitizeStudentId(candidate);
        if (!cleanId) {
            speakAndListen('Fadlan mar kale akhri nambarkaaga ardayga.');
            focusStudentInput();
            return;
        }

        localStorage.setItem(LAST_STUDENT_ID_KEY, cleanId);
        setStudentId(cleanId);
        setError('');
        setSilenceConfirmedId(cleanId);
        setIdConfirmationMode('login');
        setVoiceStep('LISTENING_ID');
        markStudentIdActivity();
        speakAndListen(spellStudentId(cleanId));
        focusStudentInput();
    }, [focusStudentInput, markStudentIdActivity, speakAndListen]);

    const useLastSavedStudentId = useCallback(() => {
        const savedId = sanitizeStudentId(localStorage.getItem(LAST_STUDENT_ID_KEY) || '');
        if (!savedId) {
            speakAndListen('Fadlan mar kale akhri nambarkaaga ardayga.');
            focusStudentInput();
            return;
        }

        markStudentIdActivity();
        promptStudentIdConfirmation(savedId);
    }, [focusStudentInput, markStudentIdActivity, promptStudentIdConfirmation, speakAndListen]);

    const applyStudentIdChunks = useCallback((chunks, options = {}) => {
        const { replace = false, autoConfirm = false } = options;
        const chunkValue = sanitizeStudentId(chunks.join(''));
        if (!chunkValue) {
            speakAndListen('Fadlan mar kale akhri nambarkaaga ardayga.');
            focusStudentInput();
            return '';
        }

        const nextId = sanitizeStudentId(`${replace ? '' : studentIdRef.current}${chunkValue}`);
        setStudentId(nextId);
        setSilenceConfirmedId('');
        setError('');
        setIdConfirmationMode('login');
        setVoiceStep('LISTENING_ID');
        markStudentIdActivity();

        if (autoConfirm && isLikelyStudentId(nextId)) {
            promptStudentIdConfirmation(nextId);
            return nextId;
        }

        speakAndListen(spellStudentId(nextId));
        focusStudentInput();
        return nextId;
    }, [focusStudentInput, markStudentIdActivity, promptStudentIdConfirmation, speakAndListen]);

    const handleStudentVoiceFallback = useCallback((spokenText, isFinal) => {
        if (mode !== 'student' || voiceStepRef.current !== 'LISTENING_ID' || isAudioPlayingRef.current) return false;

        const cleaned = String(spokenText || '').trim();
        if (!cleaned) return false;

        const chunks = extractStudentIdChunks(cleaned);
        if (!chunks.length) return false;

        const finalId = normalizeStudentIdFromSpeech(cleaned) || chunks.join('');
        
        if (isFinal) {
            if (interimIdTimeoutRef.current) clearTimeout(interimIdTimeoutRef.current);
            if (finalId) {
                setStudentId(finalId); // Show in input immediately
                promptStudentIdConfirmation(finalId);
                return true;
            }
        } else {
            // Show ID in input field immediately so student sees what's captured
            if (finalId) {
                setStudentId(finalId);
            }
            // Set a timeout to auto-confirm if they pause speaking for 2 seconds.
            if (interimIdTimeoutRef.current) clearTimeout(interimIdTimeoutRef.current);
            if (finalId && finalId.length >= 2) {
                interimIdTimeoutRef.current = setTimeout(() => {
                    if (voiceStepRef.current === 'LISTENING_ID') {
                        promptStudentIdConfirmation(finalId);
                    }
                }, 2000);
            }
        }
        return false;
    }, [mode, promptStudentIdConfirmation]);

    const performStudentLogin = useCallback(async (id = studentIdRef.current) => {
        const normalizedId = normalizeStudentIdFromSpeech(id || studentIdRef.current) || sanitizeStudentId(id || studentIdRef.current);
        if (!normalizedId) {
            speakAndListen('Fadlan mar kale akhri nambarkaaga ardayga.');
            focusStudentInput();
            return;
        }

        setError('');
        setLoading(true);
        setIdConfirmationMode('login');
        setVoiceStep('IDLE');
        listeningControlsRef.current.stopListening();

        try {
            const res = await api.post('/student-login', { studentId: normalizedId });
            localStorage.setItem(LAST_STUDENT_ID_KEY, normalizedId);
            const nextUser = { ...res.data.student, role: 'student', examId: res.data.exam?.id || null };
            login(nextUser, res.data.token);

            if (res.data.exam?.id) {
                await ensureExamRecording({
                    examId: res.data.exam.id,
                    examTitle: res.data.exam.title,
                    subjectName: res.data.exam.subjectName,
                    studentId: res.data.student?.studentId,
                    studentName: res.data.student?.name
                });
            }

            navigate('/student/dashboard');
        } catch (err) {
            const msg = err.response?.data?.message || 'Login failed. Please check your I D.';
            setError(msg);
            setStudentId('');
            setSilenceConfirmedId('');
            setIdConfirmationMode('login');
            setVoiceStep('LISTENING_ID');
            markStudentIdActivity();
            speakAndListen('Fadlan mar kale akhri nambarkaaga ardayga.');
            focusStudentInput();
        } finally {
            setLoading(false);
        }
    }, [ensureExamRecording, focusStudentInput, login, markStudentIdActivity, navigate, speakAndListen]);

    const handleStudentLogin = (e) => {
        e.preventDefault();
        if (voiceStep === 'CONFIRM_ID') {
            if (idConfirmationMode === 'save') {
                saveStudentIdOnly(studentId);
                return;
            }
            performStudentLogin(studentId);
            return;
        }

        promptStudentIdConfirmation(studentId);
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

    const handleTeacherLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/teacher-login', { email, password });
            login(res.data.teacher, res.data.token);
            navigate('/teacher/dashboard');
        } catch (err) {
            const msg = err.response?.data?.message || 'Login failed.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const getCommandMap = () => {
        const baseCommands = {
            'set student id': (id) => promptStudentIdConfirmation(id),
            'repeat id': () => readCurrentStudentId(),
            'read id': () => readCurrentStudentId(),
            'current id': () => readCurrentStudentId(),
            'guided mode': () => startGuidedEntry(false),
            'start guided entry': () => startGuidedEntry(false),
            'step by step': () => startGuidedEntry(false),
            'character mode': () => startGuidedEntry(false),
            'guided entry': () => startGuidedEntry(false),
            'finish guided entry': () => promptStudentIdConfirmation(studentIdRef.current),
            'stop guided entry': () => stopGuidedEntry(),
            'exit guided entry': () => stopGuidedEntry(),
            'exit guided': () => stopGuidedEntry(),
            'exit guided mode': () => stopGuidedEntry(),
            'stop guided': () => stopGuidedEntry(),
            'start guided': () => startGuidedEntry(false),
            'toggle guided': () => guidedEntryMode ? stopGuidedEntry() : startGuidedEntry(false),
            'clear': () => clearCurrentStudentId(),
            'tir tir': () => clearCurrentStudentId(),
            'tir-tir': () => clearCurrentStudentId(),
            'tirtir': () => clearCurrentStudentId(),
            'iga tirtir': () => clearCurrentStudentId(),
            'id iga tirtir': () => clearCurrentStudentId(),
            'delete last': () => deleteLastStudentIdCharacter(),
            'remove last': () => deleteLastStudentIdCharacter(),
            'backspace': () => deleteLastStudentIdCharacter(),
            'delete last character': () => deleteLastStudentIdCharacter(),
            'delete last letter': () => deleteLastStudentIdCharacter(),
            'delete last number': () => deleteLastStudentIdCharacter(),
            'remove last character': () => deleteLastStudentIdCharacter(),
            'remove last letter': () => deleteLastStudentIdCharacter(),
            'remove last number': () => deleteLastStudentIdCharacter(),
            'continue': () => promptStudentIdConfirmation(studentIdRef.current),
            'done': () => promptStudentIdConfirmation(studentIdRef.current),
            'login': () => promptStudentIdConfirmation(studentIdRef.current),
            'enter exam': () => promptStudentIdConfirmation(studentIdRef.current),
            'continue with id': () => promptStudentIdConfirmation(studentIdRef.current),
            'confirm and login': () => promptStudentIdConfirmation(studentIdRef.current),
            'save confirmed id': () => saveStudentIdOnly(studentIdRef.current),
            'use last id': () => useLastSavedStudentId(),
            'last id': () => useLastSavedStudentId(),
            'use last student id': () => useLastSavedStudentId(),
            'use saved id': () => useLastSavedStudentId(),
            'use last saved id': () => useLastSavedStudentId(),
            'load last id': () => useLastSavedStudentId(),
            'load saved id': () => useLastSavedStudentId(),
            'repeat': () => readCurrentStudentId(),
            'again': () => readCurrentStudentId(),
            'try': () => readCurrentStudentId(),
            'try again': () => clearCurrentStudentId(),
            'student login': () => { setMode('student'); setError(''); },
            'admin login': () => { setMode('admin'); setError(''); },
            'teacher login': () => { setMode('teacher'); setError(''); },
            'admin tab': () => { setMode('admin'); setError(''); },
            'teacher tab': () => { setMode('teacher'); setError(''); },
            'student tab': () => { setMode('student'); setError(''); }
        };

        if (voiceStep === 'CONFIRM_CLEAR') {
            const handleClearYes = () => {
                clearCurrentStudentId(true);
            };

            const handleClearNo = () => {
                setVoiceStep('LISTENING_ID');
                speakAndListen(`Nambarka waa la keydiyay. Nambarka hadda waa: ${spellStudentId(studentIdRef.current)}`);
                focusStudentInput();
            };

            return {
                ...baseCommands,
                'yes': handleClearYes,
                'haa': handleClearYes,
                'no': handleClearNo,
                'maya': handleClearNo
            };
        }

        if (voiceStep === 'CONFIRM_ID') {
            const handleConfirmYes = () => {
                if (idConfirmationMode === 'save') {
                    saveStudentIdOnly(studentIdRef.current);
                    return;
                }
                performStudentLogin(studentIdRef.current);
            };

            const handleConfirmNo = () => {
                setVoiceStep('LISTENING_ID');
                setIdConfirmationMode('login');
                setStudentId('');
                markStudentIdActivity();
                speakAndListen('Fadlan akhri nambarkaaga ardayga.');
            };

            return {
                ...baseCommands,
                'yes': handleConfirmYes,
                'haa': handleConfirmYes,
                'no': handleConfirmNo,
                'maya': handleConfirmNo,
                'try': () => promptStudentIdConfirmation(studentIdRef.current),
                'again': () => promptStudentIdConfirmation(studentIdRef.current),
                'repeat': () => promptStudentIdConfirmation(studentIdRef.current)
            };
        }

        return baseCommands;
    };

    const {
        isListening,
        transcript,
        lastCommand,
        startListening,
        stopListening
    } = useVoiceCommands(
        getCommandMap(),
        mode === 'student',
        mode === 'student' ? handleStudentVoiceFallback : null
    );

    useEffect(() => {
        listeningControlsRef.current = { startListening, stopListening };
    }, [startListening, stopListening]);

    useEffect(() => {
        if (mode === 'student') {
            setStudentId('');
            setSilenceConfirmedId('');
            setError('');
            setIdConfirmationMode('login');
            setVoiceStep('LISTENING_ID');
            setGuidedEntryMode(true);
            setLastIdActivityAt(Date.now());
            lastProcessedSpeechRef.current = { text: '', time: 0 };

            const welcomeMessage = 'Fadlan akhri nambarkaaga ardayga.';

            speakAndListen(welcomeMessage);
            focusStudentInput();
        } else {
            setGuidedEntryMode(false);
            stopListening();
            stop();
            setVoiceStep('IDLE');
        }
    }, [focusStudentInput, mode, speakAndListen, stopListening, stop]);

    useEffect(() => {
        if (mode !== 'student' || loading || voiceStep !== 'LISTENING_ID') return undefined;

        const currentId = sanitizeStudentId(studentId);
        if (!currentId) return undefined;
        if (currentId === silenceConfirmedId) return undefined;

        const elapsed = Date.now() - lastIdActivityAt;
        const remaining = Math.max(0, 60000 - elapsed);

        const timeoutId = window.setTimeout(() => {
            const latestId = sanitizeStudentId(studentIdRef.current);
            if (latestId && voiceStepRef.current === 'LISTENING_ID') {
                promptSilenceStudentIdConfirmation(latestId);
            }
        }, remaining);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [lastIdActivityAt, loading, mode, promptSilenceStudentIdConfirmation, silenceConfirmedId, studentId, voiceStep]);

    // Safety Cleanup Effect: Ensure absolutely no audio runs in the background
    // if the user switches to Admin/Teacher or leaves the page.
    useEffect(() => {
        const cleanupAudioAndVoice = () => {
            stop(); // Stop any ongoing TTS
            if (interimIdTimeoutRef.current) {
                clearTimeout(interimIdTimeoutRef.current);
            }
            if (mode !== 'student') {
                setAudioPlayingState(false);
            }
        };

        if (mode !== 'student') {
            cleanupAudioAndVoice();
            listeningControlsRef.current.stopListening();
            setVoiceStep('IDLE');
        }

        return () => {
            cleanupAudioAndVoice();
        };
    }, [mode, stop, setAudioPlayingState]);

    return (
        <div className="page login-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {mode === 'student' && (
                <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                    {studentStatus}
                </div>
            )}
            {/* Voice Indicator */}
            {mode === 'student' && (
                <>
                    <div className={`voice-indicator student-voice-indicator ${isListening ? 'listening' : ''}`}
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
                                voiceStep === 'CONFIRM_CLEAR' ? 'Clear ID? Say Yes or No' :
                                guidedEntryMode ? 'Guided ID Entry' :
                                isListening ? (lastCommand || 'Listening for ID...') : 'Voice Off'}
                        </span>
                    </div>
                    {/* live raw transcript */}
                    {isListening && transcript && voiceStep === 'LISTENING_ID' && (
                        <div className="transcript student-login-transcript" style={{ position: 'fixed', top: 'clamp(120px,18vh,160px)', left: '50%', transform: 'translateX(-50%)', fontSize: 'var(--font-size-sm)' }}>
                            Heard: {transcript}
                        </div>
                    )}
                </>
            )}
            <div className="login-shell" style={{ width: '100%', maxWidth: 520 }}>
                {/* Header */}
                <div className="text-center login-header" style={{ marginBottom: 40 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }} aria-hidden="true">
                        <i className="fa-solid fa-universal-access"></i>
                    </div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginBottom: 8 }}>
                        Accessible Exam System
                    </h1>
                    <p className="text-muted" style={{ fontSize: 'var(--font-size-base)' }}>
                        Voice-controlled examination platform
                    </p>
                </div>

                {/* Role Tabs */}
                <div className="section-tabs login-role-tabs" style={{ justifyContent: 'center', marginBottom: 24 }}>
                    <button
                        className={`section-tab ${mode === 'student' ? 'active' : ''}`}
                        onClick={() => { setMode('student'); setError(''); }}
                        aria-label="Switch to student login"
                    >
                        <i className="fa-solid fa-user-graduate" aria-hidden="true"></i> Student
                    </button>
                    <button
                        className={`section-tab ${mode === 'admin' ? 'active' : ''}`}
                        onClick={() => { setMode('admin'); setError(''); }}
                        aria-label="Switch to admin login"
                    >
                        <i className="fa-solid fa-shield-halved" aria-hidden="true"></i> Admin
                    </button>
                    <button
                        className={`section-tab ${mode === 'teacher' ? 'active' : ''}`}
                        onClick={() => { setMode('teacher'); setError(''); }}
                        aria-label="Switch to teacher login"
                    >
                        <i className="fa-solid fa-chalkboard-user" aria-hidden="true"></i> Teacher
                    </button>
                </div>

                {/* Login Card */}
                <div className="card login-card">
                    {error && (
                        <div className="badge badge-danger" style={{ marginBottom: 16, width: '100%', justifyContent: 'center', padding: 14 }} role="alert">
                            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> {error}
                        </div>
                    )}

                    {mode === 'student' ? (
                        <form onSubmit={handleStudentLogin}>
                            <div className="input-group">
                                <label htmlFor="studentId">Student ID</label>
                                <input
                                    id="studentId"
                                    ref={studentInputRef}
                                    className="input"
                                    type="text"
                                    placeholder="Say or type your student ID"
                                    value={studentId}
                                    onChange={(e) => {
                                        setStudentId(sanitizeStudentId(e.target.value));
                                        setSilenceConfirmedId('');
                                        setError('');
                                        setIdConfirmationMode('login');
                                        markStudentIdActivity();
                                        if (voiceStep === 'CONFIRM_ID') {
                                            setVoiceStep('LISTENING_ID');
                                        }
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleStudentLogin(e)}
                                    disabled={isAudioPlaying}
                                    aria-label="Student ID Input"
                                    required
                                    autoFocus
                                    aria-required="true"
                                    style={{
                                        borderColor: (voiceStep === 'CONFIRM_ID' || voiceStep === 'CONFIRM_CLEAR') ? 'var(--accent-primary)' : undefined,
                                        boxShadow: (voiceStep === 'CONFIRM_ID' || voiceStep === 'CONFIRM_CLEAR') ? '0 0 0 4px rgba(37, 99, 235, 0.1)' : undefined
                                    }}
                                />
                            </div>

                            <button className="btn btn-primary btn-lg student-login-submit" style={{ width: '100%' }} type="submit" disabled={loading}>
                                {loading
                                    ? (<><i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Logging in...</>)
                                    : (voiceStep === 'CONFIRM_ID'
                                        ? (
                                            idConfirmationMode === 'save'
                                                ? (<><i className="fa-solid fa-circle-check" aria-hidden="true"></i> Save Confirmed ID</>)
                                                : (<><i className="fa-solid fa-circle-check" aria-hidden="true"></i> Confirm And Login</>)
                                        )
                                        : voiceStep === 'CONFIRM_CLEAR'
                                            ? (<><i className="fa-solid fa-eraser" aria-hidden="true"></i> Confirm Clear ID</>)
                                            : (<><i className="fa-solid fa-id-card" aria-hidden="true"></i> Continue With ID</>)
                                    )
                                }
                            </button>
                        </form>
                    ) : mode === 'admin' ? (
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
                                {loading
                                    ? (<><i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Logging in...</>)
                                    : (<><i className="fa-solid fa-lock" aria-hidden="true"></i> Admin Login</>)
                                }
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleTeacherLogin}>
                            <div className="input-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    id="email"
                                    className="input"
                                    type="email"
                                    placeholder="teacher@school.com"
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
                                {loading
                                    ? (<><i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Logging in...</>)
                                    : (<><i className="fa-solid fa-lock" aria-hidden="true"></i> Teacher Login</>)
                                }
                            </button>
                        </form>
                    )}

                </div>
            </div>
        </div>
    );
}

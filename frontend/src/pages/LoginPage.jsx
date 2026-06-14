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

    useEffect(() => {
        voiceStepRef.current = voiceStep;
    }, [voiceStep]);

    useEffect(() => {
        studentIdRef.current = studentId;
        const status = studentId
            ? `Current student ID ${spellStudentId(studentId)}.${guidedEntryMode ? ' Guided entry mode is on.' : ''}`
            : `No student ID entered yet.${guidedEntryMode ? ' Guided entry mode is on.' : ''}`;
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
        speak(text, {
            ...options,
            onEnd: () => {
                if (options.onEnd) options.onEnd();
                if (mode === 'student') {
                    resumeListening();
                }
            }
        });
    }, [mode, speak]);

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

        const guidedMessage = existingId
            ? `Guided student I D entry is on. Current I D is ${spellStudentId(existingId)}. Say one character at a time. After each character I will repeat the current I D back to you.`
            : 'Guided student I D entry is on. Say one letter or one number now. Example, C, or one. After each character I will repeat the current I D back to you.';

        speakAndListen(guidedMessage, { rate: 1.1 });
        focusStudentInput();
    }, [focusStudentInput, markStudentIdActivity, speakAndListen]);

    const stopGuidedEntry = useCallback(() => {
        setGuidedEntryMode(false);
        setIdConfirmationMode('login');
        setVoiceStep('LISTENING_ID');
        markStudentIdActivity();
        speakAndListen('Guided student I D entry is off. You can still say the whole I D, or say continue when you are ready.', { rate: 1.1 });
        focusStudentInput();
    }, [focusStudentInput, markStudentIdActivity, speakAndListen]);

    const readCurrentStudentId = useCallback((prefix = 'Current student I D is') => {
        const current = sanitizeStudentId(studentIdRef.current);
        if (!current) {
            speakAndListen('No student I D entered yet. Say the full I D, or spell it one character at a time.');
            focusStudentInput();
            return;
        }

        markStudentIdActivity();
        speakAndListen(`${prefix} ${spellStudentId(current)}. Say continue if it is correct, delete last to fix one character, or clear I D to start over.`, { rate: 1.15 });
        focusStudentInput();
    }, [focusStudentInput, markStudentIdActivity, speakAndListen]);

    const clearCurrentStudentId = useCallback((message = 'Student I D cleared. Say your student I D again.') => {
        setStudentId('');
        setSilenceConfirmedId('');
        setError('');
        setIdConfirmationMode('login');
        setVoiceStep('LISTENING_ID');
        markStudentIdActivity();
        const clearMessage = guidedEntryMode
            ? `${message} Guided entry is still on. Say the first character now.`
            : message;
        speakAndListen(clearMessage, { rate: 1.15 });
        focusStudentInput();
    }, [focusStudentInput, guidedEntryMode, markStudentIdActivity, speakAndListen]);

    const deleteLastStudentIdCharacter = useCallback(() => {
        const current = sanitizeStudentId(studentIdRef.current);
        if (!current) {
            speakAndListen('There is no character to remove yet.');
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
            speakAndListen(`Removed the last character. Current student I D is ${spellStudentId(updated)}.`, { rate: 1.15 });
        } else {
            speakAndListen('Removed the last character. The student I D is empty now.', { rate: 1.15 });
        }

        focusStudentInput();
    }, [focusStudentInput, markStudentIdActivity, speakAndListen]);

    const promptStudentIdConfirmation = useCallback((candidate = studentIdRef.current) => {
        const cleanId = normalizeStudentIdFromSpeech(candidate) || sanitizeStudentId(candidate);
        if (!cleanId) {
            speakAndListen('Please say the full student I D, or spell it one character at a time.', { rate: 1.15 });
            focusStudentInput();
            return;
        }

        setStudentId(cleanId);
        setSilenceConfirmedId('');
        setError('');
        setIdConfirmationMode('login');

        if (!isLikelyStudentId(cleanId)) {
            setVoiceStep('LISTENING_ID');
            markStudentIdActivity();
            speakAndListen(`I heard ${spellStudentId(cleanId)}. This sounds incomplete. Keep spelling your student I D, then say continue.`, { rate: 1.15 });
            focusStudentInput();
            return;
        }

        setVoiceStep('CONFIRM_ID');
        speakAndListen(`I heard ${spellStudentId(cleanId)}. Say yes to log in, no to keep editing, delete last to remove one character, or clear I D to start over.`, { rate: 1.15 });
        focusStudentInput();
    }, [focusStudentInput, markStudentIdActivity, speakAndListen]);

    const promptSilenceStudentIdConfirmation = useCallback((candidate = studentIdRef.current) => {
        const cleanId = normalizeStudentIdFromSpeech(candidate) || sanitizeStudentId(candidate);
        if (!cleanId) return;

        setStudentId(cleanId);
        setError('');
        setIdConfirmationMode('save');
        setVoiceStep('CONFIRM_ID');
        speakAndListen(`You were quiet for one minute. Current student I D is ${spellStudentId(cleanId)}. Say yes to save this I D, or no to clear it and start again.`, { rate: 1.15 });
        focusStudentInput();
    }, [focusStudentInput, speakAndListen]);

    const saveStudentIdOnly = useCallback((candidate = studentIdRef.current) => {
        const cleanId = normalizeStudentIdFromSpeech(candidate) || sanitizeStudentId(candidate);
        if (!cleanId) {
            speakAndListen('There is no valid student I D to save yet.', { rate: 1.15 });
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
        speakAndListen(`Student I D ${spellStudentId(cleanId)} has been saved. Say continue or login when you are ready.`, { rate: 1.15 });
        focusStudentInput();
    }, [focusStudentInput, markStudentIdActivity, speakAndListen]);

    const useLastSavedStudentId = useCallback(() => {
        const savedId = sanitizeStudentId(localStorage.getItem(LAST_STUDENT_ID_KEY) || '');
        if (!savedId) {
            speakAndListen('There is no saved student I D on this device yet.', { rate: 1.15 });
            focusStudentInput();
            return;
        }

        markStudentIdActivity();
        promptStudentIdConfirmation(savedId);
    }, [focusStudentInput, markStudentIdActivity, promptStudentIdConfirmation, speakAndListen]);

    const applyStudentIdChunks = useCallback((chunks, options = {}) => {
        const { replace = false, autoConfirm = false, guided = false } = options;
        const chunkValue = sanitizeStudentId(chunks.join(''));
        if (!chunkValue) {
            speakAndListen('I did not catch a valid letter or number. Please say it again.', { rate: 1.15 });
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

        const followUp = guided
            ? `I wrote ${spellStudentId(chunkValue)}. Current student I D is ${spellStudentId(nextId)}. Say the next character, say delete last, or say finish guided entry when you are done.`
            : `Added ${spellStudentId(chunkValue)}. Current student I D is ${spellStudentId(nextId)}. Say continue if correct, or keep spelling.`;
        speakAndListen(followUp, { rate: 1.15 });
        focusStudentInput();
        return nextId;
    }, [focusStudentInput, markStudentIdActivity, promptStudentIdConfirmation, speakAndListen]);

    const handleStudentVoiceFallback = useCallback((spokenText) => {
        if (mode !== 'student' || voiceStepRef.current === 'IDLE') return;

        const cleaned = String(spokenText || '').trim();
        if (!cleaned) return;

        const now = Date.now();
        if (
            lastProcessedSpeechRef.current.text === cleaned
            && now - lastProcessedSpeechRef.current.time < 1200
        ) {
            return;
        }
        lastProcessedSpeechRef.current = { text: cleaned, time: now };

        const hasIdCue = /\b(?:my\s+student\s+id|student\s+id|my\s+id|i\s*d|id|aqoonsi(?:ga(?:ygu)?)?)\b/i.test(cleaned);
        const chunks = extractStudentIdChunks(cleaned);
        if (!chunks.length) return;

        const singleCharacter = extractSingleStudentIdCharacter(cleaned);
        if (singleCharacter) {
            applyStudentIdChunks([singleCharacter], {
                replace: false,
                autoConfirm: false,
                guided: true
            });
            return;
        }

        if (guidedEntryMode) {
            applyStudentIdChunks(chunks, {
                replace: false,
                autoConfirm: false,
                guided: true
            });
            return;
        }

        if (hasIdCue) {
            promptStudentIdConfirmation(normalizeStudentIdFromSpeech(cleaned) || chunks.join(''));
            return;
        }

        const isBatchEntry = chunks.length > 1 || sanitizeStudentId(chunks.join('')).length >= 4;
        applyStudentIdChunks(chunks, {
            replace: false,
            autoConfirm: isBatchEntry && !studentIdRef.current
        });
    }, [applyStudentIdChunks, guidedEntryMode, mode, promptStudentIdConfirmation]);

    const performStudentLogin = useCallback(async (id = studentIdRef.current) => {
        const normalizedId = normalizeStudentIdFromSpeech(id || studentIdRef.current) || sanitizeStudentId(id || studentIdRef.current);
        if (!normalizedId) {
            speakAndListen('Please provide your student I D first.', { rate: 1.15 });
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
            setStudentId(normalizedId);
            setSilenceConfirmedId('');
            setIdConfirmationMode('login');
            setVoiceStep('LISTENING_ID');
            markStudentIdActivity();
            speakAndListen(`${msg}. Current student I D is ${spellStudentId(normalizedId)}. Say delete last, clear I D, spell more characters, or say continue to try again.`, { rate: 1.15 });
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
            'delete last': () => deleteLastStudentIdCharacter(),
            'remove last': () => deleteLastStudentIdCharacter(),
            'backspace': () => deleteLastStudentIdCharacter(),
            'delete last character': () => deleteLastStudentIdCharacter(),
            'delete last letter': () => deleteLastStudentIdCharacter(),
            'delete last number': () => deleteLastStudentIdCharacter(),
            'remove last character': () => deleteLastStudentIdCharacter(),
            'remove last letter': () => deleteLastStudentIdCharacter(),
            'remove last number': () => deleteLastStudentIdCharacter(),
            'clear id': () => clearCurrentStudentId(),
            'clear': () => clearCurrentStudentId(),
            'start over': () => clearCurrentStudentId(),
            'clear student id': () => clearCurrentStudentId(),
            'clear all': () => clearCurrentStudentId(),
            'reset': () => clearCurrentStudentId(),
            'reset id': () => clearCurrentStudentId(),
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
            'try again': () => clearCurrentStudentId('Student I D cleared. Try spelling it again.'),
            'student login': () => { setMode('student'); setError(''); },
            'admin login': () => { setMode('admin'); setError(''); },
            'teacher login': () => { setMode('teacher'); setError(''); },
            'admin tab': () => { setMode('admin'); setError(''); },
            'teacher tab': () => { setMode('teacher'); setError(''); },
            'student tab': () => { setMode('student'); setError(''); }
        };

        if (voiceStep === 'CONFIRM_ID') {
            const handleConfirmYes = () => {
                if (idConfirmationMode === 'save') {
                    saveStudentIdOnly(studentIdRef.current);
                    return;
                }
                performStudentLogin(studentIdRef.current);
            };

            const handleConfirmNo = () => {
                if (idConfirmationMode === 'save') {
                    clearCurrentStudentId('Okay. I cleared the student I D. Please start the student I D again from the beginning.');
                    return;
                }
                setVoiceStep('LISTENING_ID');
                setIdConfirmationMode('login');
                markStudentIdActivity();
                readCurrentStudentId('Okay. Keep editing. Current student I D is');
            };

            return {
                ...baseCommands,
                'yes': handleConfirmYes,
                'haa': handleConfirmYes,
                'no': handleConfirmNo,
                'maya': handleConfirmNo,
                'try': () => promptStudentIdConfirmation(studentIdRef.current),
                'again': () => promptStudentIdConfirmation(studentIdRef.current),
                'repeat': () => promptStudentIdConfirmation(studentIdRef.current),
                'try again': () => clearCurrentStudentId('Okay, started again. Spell your student I D now.')
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
            const savedId = sanitizeStudentId(localStorage.getItem(LAST_STUDENT_ID_KEY) || '');
            setStudentId('');
            setSilenceConfirmedId('');
            setError('');
            setIdConfirmationMode('login');
            setVoiceStep('LISTENING_ID');
            setGuidedEntryMode(true);
            setLastIdActivityAt(Date.now());
            lastProcessedSpeechRef.current = { text: '', time: 0 };

            const welcomeMessage = savedId
                ? 'Welcome. Student I D guided entry is on. Say one character now, for example C, then I will write it and read it back to you. You may also say the full I D at once. Say use last I D to reuse your saved I D. You can also say repeat I D, delete last, clear I D, or continue.'
                : 'Welcome. Student I D guided entry is on. Say one character now, for example C, then I will write it and read it back to you. You may also say the full I D at once. You can also say repeat I D, delete last, clear I D, or continue.';

            speakAndListen(welcomeMessage, { rate: 1.15 });
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
                            <div
                                className="badge badge-info student-login-status"
                                style={{ marginBottom: 16, width: '100%', justifyContent: 'center', padding: 14, textAlign: 'center', lineHeight: 1.5 }}
                                role="status"
                                aria-live="polite"
                            >
                                <i className="fa-solid fa-ear-listen" aria-hidden="true"></i>
                                {studentId
                                    ? `Current ID: ${spellStudentId(studentId)}${guidedEntryMode ? ' | Guided mode is ON' : ''}`
                                    : `Say the full ID or spell it one character at a time.${guidedEntryMode ? ' Guided mode is ON.' : ''} Commands: Repeat ID, Delete Last, Clear ID, Continue.`}
                            </div>

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
                                    required
                                    autoFocus
                                    aria-required="true"
                                    style={{
                                        borderColor: voiceStep === 'CONFIRM_ID' ? 'var(--accent-primary)' : undefined,
                                        boxShadow: voiceStep === 'CONFIRM_ID' ? '0 0 0 4px rgba(37, 99, 235, 0.1)' : undefined
                                    }}
                                />
                            </div>

                            <div className="flex gap-sm student-login-actions" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                        if (guidedEntryMode) {
                                            stopGuidedEntry();
                                        } else {
                                            startGuidedEntry(false);
                                        }
                                    }}
                                >
                                    <i className={`fa-solid ${guidedEntryMode ? 'fa-toggle-on' : 'fa-toggle-off'}`} aria-hidden="true"></i>
                                    {guidedEntryMode ? 'Exit Guided' : 'Guided Entry'}
                                </button>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => readCurrentStudentId()}>
                                    <i className="fa-solid fa-volume-high" aria-hidden="true"></i> Read ID
                                </button>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={deleteLastStudentIdCharacter} disabled={!studentId}>
                                    <i className="fa-solid fa-delete-left" aria-hidden="true"></i> Delete Last
                                </button>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => clearCurrentStudentId()} disabled={!studentId}>
                                    <i className="fa-solid fa-eraser" aria-hidden="true"></i> Clear ID
                                </button>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={useLastSavedStudentId}>
                                    <i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Use Last ID
                                </button>
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

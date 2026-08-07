import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getDefaultRouteForRole } from '../context/AuthContext';
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
    isCompleteStudentId,
    spellStudentId,
    mergeStudentIdSpeech
} from '../utils/studentIdSpeech';
import { somaliTtsOptions } from '../utils/somaliSpeech';
import { playSomaliAudioFile, stopSomaliAudio, AUDIO_PROMPTS } from '../utils/audioPlayer';

const LAST_STUDENT_ID_KEY = 'last_student_id';
const STUDENT_ID_RECOGNITION_OPTIONS = {
    lang: 'en-US',
    fallbackLang: 'en-US',
    continuous: true,
    interimResults: true,
    processInterimCommands: true,
    maxAlternatives: 5
};
const ENGLISH_ID_TTS_OPTIONS = {
    lang: 'en-US',
    rate: 0.65,
    pitch: 1,
    volume: 1
};

export default function LoginPage() {
    const [mode, setMode] = useState('student'); // 'student' | 'admin' | 'teacher'
    const [studentId, setStudentId] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [studentStatus, setStudentStatus] = useState('');
    const [guidedEntryMode, setGuidedEntryMode] = useState(true);
    const [idConfirmationMode, setIdConfirmationMode] = useState('login');
    const [lastIdActivityAt, setLastIdActivityAt] = useState(Date.now());
    const [silenceConfirmedId, setSilenceConfirmedId] = useState('');
    const [displayTranscript, setDisplayTranscript] = useState('');

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
    const modeRef = useRef(mode);
    const voiceRunRef = useRef(0);
    const resumeListeningTimerRef = useRef(null);

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

    const cancelStudentVoiceFlow = useCallback(() => {
        voiceRunRef.current += 1;
        if (resumeListeningTimerRef.current) {
            clearTimeout(resumeListeningTimerRef.current);
            resumeListeningTimerRef.current = null;
        }
        stop();
        stopSomaliAudio();
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        setAudioPlayingState(false);
    }, [setAudioPlayingState, stop]);

    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);

    useEffect(() => {
        voiceStepRef.current = voiceStep;
    }, [voiceStep]);

    const updateStudentId = useCallback((newId) => {
        const clean = sanitizeStudentId(newId);
        studentIdRef.current = clean;
        setStudentId(clean);
    }, []);

    useEffect(() => {
        studentIdRef.current = studentId;
        const status = studentId
            ? `Nambarka ardayga ee hadda waa ${spellStudentId(studentId)}.`
            : `Weli lama gelin nambarka ardayga.`;
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
        const runId = ++voiceRunRef.current;
        const { startListening: resumeListening, stopListening: pauseListening } = listeningControlsRef.current;
        const isActiveRun = () => modeRef.current === 'student' && voiceRunRef.current === runId;

        pauseListening();
        stop();
        stopSomaliAudio();
        setAudioPlayingState(true);

        const safeResume = () => {
            if (resumeListeningTimerRef.current) clearTimeout(resumeListeningTimerRef.current);
            resumeListeningTimerRef.current = setTimeout(() => {
                resumeListeningTimerRef.current = null;
                if (isActiveRun()) {
                    resumeListening();
                }
            }, 300);
        };

        const finishPrompt = () => {
            if (!isActiveRun()) return;
            setAudioPlayingState(false);
            if (options.onEnd) options.onEnd();
            safeResume();
        };

        const isPleaseEnterId = typeof text === 'string' && (
            text.includes('Fadlan akhri nambarkaaga') ||
            text.includes('Fadlan geli ID-gaaga') ||
            text.includes('Waxad joogtaa page loginka') ||
            text.includes('mar kale akhri')
        );

        if (isPleaseEnterId) {
            playSomaliAudioFile(AUDIO_PROMPTS.PLEASE_ENTER_ID, finishPrompt);
            return;
        }

        speak(text, somaliTtsOptions({
            ...options,
            onEnd: finishPrompt
        }));
    }, [speak, stop, setAudioPlayingState]);

    const playConfirmationSequence = useCallback((cleanId) => {
        const runId = ++voiceRunRef.current;
        const { startListening: resumeListening, stopListening: pauseListening } = listeningControlsRef.current;
        const isActiveRun = () => modeRef.current === 'student' && voiceRunRef.current === runId;

        stop();
        stopSomaliAudio();
        setAudioPlayingState(true);
        // Pause microphone listening while prompt audio plays so speaker output isn't picked up
        pauseListening();

        let ttsCompleted = false;
        const completeTtsStep = () => {
            if (ttsCompleted || !isActiveRun()) return;
            ttsCompleted = true;
            playSomaliAudioFile(AUDIO_PROMPTS.CONFIRM_YES_NO_PROMPT, () => {
                if (!isActiveRun()) return;
                setAudioPlayingState(false);
                // Turn microphone listening back ON to wait for student's explicit "haa" or "maya"
                resumeListening();
            });
        };

        playSomaliAudioFile(AUDIO_PROMPTS.ARE_YOU_SURE_ID, () => {
            if (!isActiveRun()) return;
            speak(spellStudentId(cleanId), {
                ...ENGLISH_ID_TTS_OPTIONS,
                onEnd: completeTtsStep
            });

            // Safety fallback: if TTS takes more than 4 seconds, proceed smoothly
            setTimeout(completeTtsStep, 4000);
        });
    }, [speak, stop, setAudioPlayingState]);

    const replayCurrentVoicePrompt = useCallback(() => {
        stop();
        stopSomaliAudio();
        const current = sanitizeStudentId(studentIdRef.current);
        if (voiceStep === 'CONFIRM_ID' && current) {
            playConfirmationSequence(current);
        } else if (current) {
            speakAndListen(spellStudentId(current), ENGLISH_ID_TTS_OPTIONS);
        } else {
            speakAndListen('Waxad joogtaa page loginka Fadlan geli id gaag.');
        }
        focusStudentInput();
    }, [focusStudentInput, playConfirmationSequence, speakAndListen, stop, voiceStep]);

    const startGuidedEntry = useCallback((resetCurrent = false) => {
        const existingId = resetCurrent ? '' : sanitizeStudentId(studentIdRef.current);
        if (resetCurrent) {
            updateStudentId('');
            setSilenceConfirmedId('');
        }

        setError('');
        setIdConfirmationMode('login');
        setVoiceStep('LISTENING_ID');
        setGuidedEntryMode(true);
        markStudentIdActivity();

        if (existingId) {
            speakAndListen(spellStudentId(existingId), ENGLISH_ID_TTS_OPTIONS);
        } else {
            speakAndListen('Waxad joogtaa page loginka Fadlan geli id gaag.');
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
            speakAndListen('Waxad joogtaa page loginka Fadlan geli id gaag.');
            focusStudentInput();
            return;
        }

        markStudentIdActivity();
        speakAndListen(spellStudentId(current), ENGLISH_ID_TTS_OPTIONS);
        focusStudentInput();
    }, [focusStudentInput, markStudentIdActivity, speakAndListen]);

    const clearCurrentStudentId = useCallback((force = false) => {
        if (!force && studentIdRef.current) {
            setVoiceStep('CONFIRM_CLEAR');
            speakAndListen('Ma rabtaa inaad tirtirto nambarkii aad gelisay? Dheh haa ama maya.');
            focusStudentInput();
            return;
        }

        updateStudentId('');
        setSilenceConfirmedId('');
        setError('');
        setIdConfirmationMode('login');
        setVoiceStep('LISTENING_ID');
        markStudentIdActivity();
        speakAndListen('Waxad joogtaa page loginka Fadlan geli id gaag.');
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
        updateStudentId(updated);
        setSilenceConfirmedId('');
        setError('');
        setIdConfirmationMode('login');
        setVoiceStep('LISTENING_ID');
        markStudentIdActivity();

        if (updated) {
            speakAndListen(spellStudentId(updated), ENGLISH_ID_TTS_OPTIONS);
        } else {
            speakAndListen('Waxad joogtaa page loginka Fadlan geli id gaag.');
        }

        focusStudentInput();
    }, [focusStudentInput, markStudentIdActivity, speakAndListen]);

    const promptStudentIdConfirmation = useCallback((candidate = studentIdRef.current) => {
        const cleanId = normalizeStudentIdFromSpeech(candidate) || sanitizeStudentId(candidate);
        if (!cleanId) {
            speakAndListen('Fadlan mar kale akhri nambarkaaga ardayga.');
            updateStudentId('');
            setVoiceStep('LISTENING_ID');
            focusStudentInput();
            return;
        }

        const isValid = isLikelyStudentId(cleanId);
        if (!isValid) {
            speakAndListen('Fadlan mar kale akhri nambarkaaga ardayga.');
            updateStudentId('');
            setVoiceStep('LISTENING_ID');
            focusStudentInput();
            return;
        }

        updateStudentId(cleanId);
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

        updateStudentId(cleanId);
        setError('');
        setIdConfirmationMode('login');
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
        updateStudentId(cleanId);
        setError('');
        setSilenceConfirmedId(cleanId);
        setIdConfirmationMode('login');
        setVoiceStep('LISTENING_ID');
        markStudentIdActivity();
        speakAndListen(spellStudentId(cleanId), ENGLISH_ID_TTS_OPTIONS);
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
        updateStudentId(nextId);
        setSilenceConfirmedId('');
        setError('');
        setIdConfirmationMode('login');
        setVoiceStep('LISTENING_ID');
        markStudentIdActivity();

        if (autoConfirm && isLikelyStudentId(nextId)) {
            promptStudentIdConfirmation(nextId);
            return nextId;
        }

        speakAndListen(spellStudentId(nextId), ENGLISH_ID_TTS_OPTIONS);
        focusStudentInput();
        return nextId;
    }, [focusStudentInput, markStudentIdActivity, promptStudentIdConfirmation, speakAndListen]);

    const handleStudentVoiceFallback = useCallback((spokenText, isFinal) => {
        if (mode !== 'student') return false;

        const cleaned = String(spokenText || '').trim();
        if (!cleaned) return false;

        // If in CONFIRM_ID or CONFIRM_CLEAR state, evaluate YES / NO intent immediately
        if (voiceStepRef.current === 'CONFIRM_ID' || voiceStepRef.current === 'CONFIRM_CLEAR') {
            const yesRegex = /(?:^|\b)(?:haa*|haah*|haye*h*|haya|hiya|yah|yea|yeah|yep|yup|yes|sure|confirm|do\s*it|okay|ok|o\.?k|diyaar|waan\s*diyaar\s*ahay|sax|saxan|waa\s*sax|sax\s*weeye|haa\s*sax|haa\s*waa\s*sax|geli|haa\s*geli|ingeli|hubaa|haa\s*hubaa)(?:$|\b)/i;
            const noRegex = /(?:^|\b)(?:maya*|ma\s*ya|maaya*|mya*|mayya|mayo|mayoo|no|nah|nope|naah|cancel|stop|ha\s*bilaabin|ma\s*diyaar\s*ihi|ma\s*diyaar\s*ahi|nay|noo+|never|tirtir|iga\s*tirtir|ma\s*saxan|maaha|ma\s*ahan|maaha\s*sax)(?:$|\b)/i;

            if (yesRegex.test(cleaned)) {
                const commands = getCommandMap();
                if (typeof commands['yes'] === 'function') {
                    commands['yes']();
                    return true;
                }
            }

            if (noRegex.test(cleaned)) {
                const commands = getCommandMap();
                if (typeof commands['no'] === 'function') {
                    commands['no']();
                    return true;
                }
            }
        }

        if (voiceStepRef.current !== 'LISTENING_ID') return false;

        // ── INTERIM results: display only, NEVER touch the student ID ──
        if (!isFinal) {
            setDisplayTranscript(cleaned);
            return 'continue'; // keep recognition running
        }

        // ── FINAL results: extract ID chunks and append to studentId ──
        const chunks = extractStudentIdChunks(cleaned);
        if (!chunks.length) return true; // consumed but no useful chunks

        const spokenId = chunks.join('');
        if (!spokenId) return true;

        // Simple append to current ID (final results are clean, one per utterance)
        const current = sanitizeStudentId(studentIdRef.current);
        let nextId = current + spokenId;

        // Cap at 8 characters max (typical student ID: 1 letter + 7 digits)
        if (nextId.length > 8) {
            if (/^[A-Z]\d{4,7}$/.test(spokenId) || /^\d{7,8}$/.test(spokenId)) {
                nextId = spokenId;
            } else {
                nextId = nextId.slice(0, 8);
            }
        }

        updateStudentId(nextId);
        setDisplayTranscript(cleaned);
        markStudentIdActivity();

        // Clear any pending auto-confirm timer
        if (interimIdTimeoutRef.current) clearTimeout(interimIdTimeoutRef.current);

        // Auto-confirm candidate ID after brief pause
        interimIdTimeoutRef.current = setTimeout(() => {
            if (voiceStepRef.current === 'LISTENING_ID' && studentIdRef.current) {
                promptStudentIdConfirmation(sanitizeStudentId(studentIdRef.current));
            }
        }, 400);

        focusStudentInput();
        return true;
    }, [focusStudentInput, markStudentIdActivity, mode, promptStudentIdConfirmation, updateStudentId]);

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

    const handleStaffLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let userObj = null;
            let token = null;

            try {
                const res = await api.post('/staff-login', { email, password });
                userObj = res.data.user || res.data.admin || res.data.teacher;
                token = res.data.token;
            } catch (staffErr) {
                try {
                    const adminRes = await api.post('/admin-login', { email, password });
                    userObj = adminRes.data.admin || adminRes.data.user;
                    token = adminRes.data.token;
                } catch (adminErr) {
                    const teacherRes = await api.post('/teacher-login', { email, password });
                    userObj = teacherRes.data.teacher || teacherRes.data.user;
                    token = teacherRes.data.token;
                }
            }

            login(userObj, token);
            const targetRoute = getDefaultRouteForRole(userObj.role);
            navigate(targetRoute || '/admin/dashboard');
        } catch (err) {
            const msg = err.response?.data?.message || 'Invalid email or password.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const getCommandMap = () => {
        const baseCommands = {
            __isWaitingConfirmation__: () => Boolean(voiceStep === 'CONFIRM_ID' || voiceStep === 'CONFIRM_CLEAR'),
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
                speakAndListen([
                    'Nambarka waa la keydiyay. Nambarka hadda waa:',
                    { text: spellStudentId(studentIdRef.current), options: ENGLISH_ID_TTS_OPTIONS }
                ]);
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
                stop();
                stopSomaliAudio();
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                const targetId = sanitizeStudentId(studentIdRef.current || studentId);
                if (idConfirmationMode === 'save') {
                    saveStudentIdOnly(targetId);
                    return;
                }
                performStudentLogin(targetId);
            };

            const handleConfirmNo = () => {
                stop();
                stopSomaliAudio();
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                setStudentId('');
                studentIdRef.current = '';
                setSilenceConfirmedId('');
                setError('');
                setIdConfirmationMode('login');
                setVoiceStep('LISTENING_ID');
                markStudentIdActivity();
                speakAndListen('Waxad joogtaa page loginka Fadlan geli id gaag.');
                focusStudentInput();
            };

            return {
                ...baseCommands,
                'yes': handleConfirmYes,
                'haa': handleConfirmYes,
                'haah': handleConfirmYes,
                'haye': handleConfirmYes,
                'diyaar': handleConfirmYes,
                'sax': handleConfirmYes,
                'waa sax': handleConfirmYes,
                'geli': handleConfirmYes,
                'hubaa': handleConfirmYes,
                'yep': handleConfirmYes,
                'yeah': handleConfirmYes,
                'sure': handleConfirmYes,
                'ok': handleConfirmYes,
                'okay': handleConfirmYes,
                'no': handleConfirmNo,
                'maya': handleConfirmNo,
                'mayo': handleConfirmNo,
                'maaya': handleConfirmNo,
                'tirtir': handleConfirmNo,
                'iga tirtir': handleConfirmNo,
                'cancel': handleConfirmNo,
                'nope': handleConfirmNo,
                'nah': handleConfirmNo
            };
        }

        return baseCommands;
    };

    const recognitionOptions = {
        lang: voiceStep === 'CONFIRM_ID' || voiceStep === 'CONFIRM_CLEAR' ? 'so-SO' : 'en-US',
        fallbackLang: 'en-US',
        continuous: true,
        interimResults: true,
        processInterimCommands: true,
        maxAlternatives: 5
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
        mode === 'student' ? handleStudentVoiceFallback : null,
        recognitionOptions
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

            const welcomeMessage = 'Waxad joogtaa page loginka Fadlan geli id gaag.';

            speakAndListen(welcomeMessage);
            focusStudentInput();
        } else {
            setGuidedEntryMode(false);
            stopListening();
            cancelStudentVoiceFlow();
            setVoiceStep('IDLE');
        }
    }, [cancelStudentVoiceFlow, focusStudentInput, mode, speakAndListen, stopListening]);



    // Safety Cleanup Effect: Ensure absolutely no audio runs in the background
    // if the user switches to Admin/Teacher or leaves the page.
    useEffect(() => {
        const cleanupAudioAndVoice = () => {
            cancelStudentVoiceFlow();
            if (interimIdTimeoutRef.current) {
                clearTimeout(interimIdTimeoutRef.current);
                interimIdTimeoutRef.current = null;
            }
        };

        if (mode !== 'student') {
            cleanupAudioAndVoice();
            listeningControlsRef.current.stopListening();
            setVoiceStep('IDLE');
        }

        return cleanupAudioAndVoice;
    }, [cancelStudentVoiceFlow, mode]);

    const roleConfig = {
        student: {
            title: 'Student Login',
            subtitle: 'Use your student ID or voice guidance to continue.',
            button: 'Continue With ID',
            secureText: 'Voice-guided student access'
        },
        admin: {
            title: 'Staff & Admin Login',
            subtitle: 'Super Admin, Admin & Teacher Sign-in using Email & Password.',
            button: 'Login to Dashboard',
            secureText: 'Secure staff & admin access'
        },
        teacher: {
            title: 'Staff & Admin Login',
            subtitle: 'Super Admin, Admin & Teacher Sign-in using Email & Password.',
            button: 'Login to Dashboard',
            secureText: 'Secure staff & admin access'
        }
    }[mode];

    const switchMode = (nextMode) => {
        listeningControlsRef.current.stopListening();
        cancelStudentVoiceFlow();
        setMode(nextMode);
        setError('');
    };

    return (
        <div className="page login-page modern-login-page">
            {mode === 'student' && (
                <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                    {studentStatus}
                </div>
            )}

            {mode === 'student' && (
                <>
                    <div className={`voice-indicator student-voice-indicator ${isListening ? 'listening' : ''}`}>
                        <div className="voice-dot"></div>
                        <span>
                            {voiceStep === 'CONFIRM_ID' ? 'Dheh haa ama maya' :
                                voiceStep === 'CONFIRM_CLEAR' ? 'Ma tirtaa? Dheh haa ama maya' :
                                guidedEntryMode ? 'Gelinta ID-ga' :
                                isListening ? (lastCommand || 'Dhageysanayaa ID-ga...') : 'Codku wuu dansan yahay'}
                        </span>
                    </div>
                    {(displayTranscript || transcript || studentId) && (
                        <div className="transcript student-login-transcript">
                            La maqlay: {displayTranscript || transcript || studentId}
                        </div>
                    )}
                </>
            )}

            <div className="login-background-dots" aria-hidden="true"></div>
            <div className="login-orb login-orb-left" aria-hidden="true"></div>
            <div className="login-orb login-orb-right" aria-hidden="true"></div>

            <main className="modern-login-shell">
                <header className="university-login-header" aria-label="Jamhuriya University of Science and Technology">
                    <img
                        className="university-banner-image"
                        src="/assets/brand/just-logo.png"
                        alt="Jamhuriya University of Science and Technology"
                    />
                </header>

                <nav className="modern-role-tabs" aria-label="Login role">
                    <button
                        type="button"
                        className={mode === 'student' ? 'active' : ''}
                        onClick={() => switchMode('student')}
                    >
                        <i className="fa-solid fa-graduation-cap" aria-hidden="true"></i>
                        Student
                    </button>
                    <button
                        type="button"
                        className={mode === 'admin' ? 'active' : ''}
                        onClick={() => switchMode('admin')}
                    >
                        <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
                        Admin
                    </button>
                </nav>

                <section className="modern-login-grid">
                    <aside className="login-feature-list" aria-label="Platform features">
                        <div className="login-feature tone-blue">
                            <span><i className="fa-solid fa-shield-halved" aria-hidden="true"></i></span>
                            <div>
                                <strong>Secure & Reliable</strong>
                                <p>Enterprise-grade security to protect your data and exams.</p>
                            </div>
                        </div>
                        <div className="login-feature tone-green">
                            <span><i className="fa-solid fa-wave-square" aria-hidden="true"></i></span>
                            <div>
                                <strong>Voice Controlled</strong>
                                <p>Navigate and interact using advanced voice technology.</p>
                            </div>
                        </div>
                        <div className="login-feature tone-purple">
                            <span><i className="fa-solid fa-chart-simple" aria-hidden="true"></i></span>
                            <div>
                                <strong>Smart Analytics</strong>
                                <p>Real-time insights and reports to track performance.</p>
                            </div>
                        </div>
                        <div className="login-feature tone-orange">
                            <span><i className="fa-solid fa-users" aria-hidden="true"></i></span>
                            <div>
                                <strong>Accessible for All</strong>
                                <p>Designed for inclusivity and ease of use for everyone.</p>
                            </div>
                        </div>
                    </aside>

                    <section className="modern-login-card" aria-label={roleConfig.title}>
                        <div className="login-card-heading">
                            <h2>{roleConfig.title}</h2>
                            <p>{roleConfig.subtitle}</p>
                        </div>

                        {error && (
                            <div className="modern-login-error" role="alert">
                                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                                {error}
                            </div>
                        )}

                        {mode === 'student' ? (
                            <form onSubmit={handleStudentLogin} className="modern-login-form">
                                <label htmlFor="studentId">Student ID</label>
                                <div className="modern-input-wrap">
                                    <i className="fa-solid fa-id-card" aria-hidden="true"></i>
                                    <input
                                        id="studentId"
                                        ref={studentInputRef}
                                        type="text"
                                        placeholder="Ku dhawaaq ama qor nambarkaaga ardayga"
                                        value={studentId}
                                        onChange={(e) => {
                                            setStudentId(e.target.value.toUpperCase());
                                            setSilenceConfirmedId('');
                                            setError('');
                                            setIdConfirmationMode('login');
                                            markStudentIdActivity();
                                            if (voiceStep === 'CONFIRM_ID') {
                                                setVoiceStep('LISTENING_ID');
                                            }
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && handleStudentLogin(e)}
                                        aria-label="Student ID Input"
                                        required
                                        autoFocus
                                        aria-required="true"
                                    />
                                </div>
                                <button className="modern-submit" type="submit" disabled={loading}>
                                    {loading ? (
                                        <><i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Logging in...</>
                                    ) : voiceStep === 'CONFIRM_ID' ? (
                                        idConfirmationMode === 'save'
                                            ? <><i className="fa-solid fa-circle-check" aria-hidden="true"></i> Save Confirmed ID</>
                                            : <><i className="fa-solid fa-circle-check" aria-hidden="true"></i> Confirm And Login</>
                                    ) : voiceStep === 'CONFIRM_CLEAR' ? (
                                        <><i className="fa-solid fa-eraser" aria-hidden="true"></i> Confirm Clear ID</>
                                    ) : (
                                        <><i className="fa-solid fa-lock" aria-hidden="true"></i> {roleConfig.button}</>
                                    )}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleStaffLogin} className="modern-login-form">
                                <label htmlFor="login-email">Email</label>
                                <div className="modern-input-wrap">
                                    <i className="fa-regular fa-envelope" aria-hidden="true"></i>
                                    <input
                                        id="login-email"
                                        type="email"
                                        placeholder={mode === 'admin' ? 'admin@exam.com' : 'teacher@school.com'}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <label htmlFor="login-password">Password</label>
                                <div className="modern-input-wrap">
                                    <i className="fa-solid fa-lock" aria-hidden="true"></i>
                                    <input
                                        id="login-password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        onClick={() => setShowPassword((visible) => !visible)}
                                    >
                                        <i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
                                    </button>
                                </div>

                                <div className="login-form-row">
                                    <label className="remember-check">
                                        <input type="checkbox" />
                                        <span>Remember me</span>
                                    </label>
                                    <button type="button">Forgot password?</button>
                                </div>

                                <button className="modern-submit" type="submit" disabled={loading}>
                                    {loading
                                        ? <><i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Logging in...</>
                                        : <><i className="fa-solid fa-lock" aria-hidden="true"></i> {roleConfig.button}</>
                                    }
                                </button>
                            </form>
                        )}

                        <div className="secure-divider">
                            <span></span>
                            <strong>{roleConfig.secureText}</strong>
                            <span></span>
                        </div>
                        <div className="protected-session">
                            <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
                            Your session is protected
                        </div>
                    </section>

                    <aside className="login-illustration" aria-hidden="true">
                        <div className="voice-bubble"><i className="fa-solid fa-wave-square"></i></div>
                        <div className="shield-bubble"><i className="fa-solid fa-shield-halved"></i></div>
                        <div className="lock-bubble"><i className="fa-solid fa-lock"></i></div>
                        <div className="laptop-scene">
                            <div className="laptop-screen">
                                <span></span>
                                <span></span>
                                <div><i className="fa-solid fa-universal-access"></i></div>
                                <span></span>
                                <span></span>
                            </div>
                            <div className="laptop-base"></div>
                        </div>
                    </aside>
                </section>

                <section className="login-trust-bar" aria-label="System highlights">
                    <div>
                        <span className="tone-blue"><i className="fa-solid fa-shield-halved" aria-hidden="true"></i></span>
                        <strong>99.9%</strong>
                        <p>System Uptime</p>
                    </div>
                    <div>
                        <span className="tone-green"><i className="fa-solid fa-bolt" aria-hidden="true"></i></span>
                        <strong>Fast & Responsive</strong>
                        <p>Optimized Performance</p>
                    </div>
                    <div>
                        <span className="tone-purple"><i className="fa-solid fa-users" aria-hidden="true"></i></span>
                        <strong>Trusted by 1000+</strong>
                        <p>Institutions Worldwide</p>
                    </div>
                    <div>
                        <span className="tone-orange"><i className="fa-solid fa-headset" aria-hidden="true"></i></span>
                        <strong>24/7 Support</strong>
                        <p>We're here to help</p>
                    </div>
                </section>
            </main>

            <footer className="modern-login-footer">
                &copy; 2025 Accessible Exam System. All rights reserved.
            </footer>
        </div>
    );
}






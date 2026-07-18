import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { useTTS } from '../hooks/useTTS';
import VoiceFeedback from '../components/VoiceFeedback';
import api from '../api/axios';

const TIME_WARNING_THRESHOLDS = [900, 600, 300, 60, 30];
const DICTATION_CONFIRM_DELAY = 4000;

function formatTime(totalSeconds) {
    const safeSeconds = Math.max(totalSeconds, 0);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getQuestionTypeLabel(type) {
    if (type === 'mcq') return 'Multiple Choice';
    if (type === 'true-false') return 'True or False';
    if (type === 'open-ended') return 'Open-Ended';
    return 'Question';
}

function getSelectedOption(question, answer) {
    if (!question?.options?.length || !answer) return null;
    return question.options.find((option) => option.label === answer) || null;
}

function getCurrentAnswerSummary(question, answer) {
    if (!question || !answer) return '';

    if (question.type === 'open-ended') {
        return answer.length > 180 ? `${answer.slice(0, 180)}...` : answer;
    }

    const selectedOption = getSelectedOption(question, answer);
    if (!selectedOption) {
        return `Option ${answer}`;
    }

    return `Option ${selectedOption.label}: ${selectedOption.text}`;
}

function buildQuestionSpeech(question, index, total, sectionName, currentAnswer) {
    if (!question) return '';

    const parts = [
        sectionName ? `Section ${sectionName}.` : '',
        `Question ${index + 1} of ${total}.`,
        `${getQuestionTypeLabel(question.type)} question.`,
        `${question.points} point${question.points === 1 ? '' : 's'}.`,
        question.questionText
    ];

    if (question.options?.length) {
        parts.push('Answer choices.');
        question.options.forEach((option) => {
            parts.push(`Option ${option.label}, ${option.text}.`);
        });
    }

    if (currentAnswer) {
        if (question.type === 'open-ended') {
            parts.push('You already have a saved draft answer for this question.');
        } else {
            parts.push(`Your current answer is ${getCurrentAnswerSummary(question, currentAnswer)}.`);
        }
    }

    if (question.type === 'open-ended') {
        parts.push('You may type or dictate your answer. Say save answer when you are ready.');
    } else if (question.type === 'true-false') {
        parts.push('Say A or B, then say yes to confirm.');
    } else {
        parts.push('Say A, B, C, or D, then say yes to confirm.');
    }

    return parts.filter(Boolean);
}

function buildTimeWarning(seconds) {
    if (seconds >= 60) {
        const minutes = Math.floor(seconds / 60);
        return `${minutes} minute${minutes === 1 ? '' : 's'} remaining.`;
    }

    return `${seconds} seconds remaining.`;
}

export default function ExamPage() {
    const { user } = useAuth();
    const {
        exam,
        sections,
        questions,
        currentIndex,
        currentQuestion,
        answers,
        answeredCount,
        unansweredQuestions,
        nextQuestion,
        prevQuestion,
        goToQuestion,
        goToFirstUnanswered,
        setAnswer,
        saveAnswer,
        getCurrentSectionName,
        getTimeTaken,
        finishExam
    } = useExam();
    const { speak, stop: stopTTS, isSpeaking, rate, setRate } = useTTS();
    const navigate = useNavigate();

    const [feedbackMsg, setFeedbackMsg] = useState('');
    const [screenReaderStatus, setScreenReaderStatus] = useState('');
    const [screenReaderAlert, setScreenReaderAlert] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingAnswer, setPendingAnswer] = useState(null);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [openEndedText, setOpenEndedText] = useState('');
    const [, setPendingDictation] = useState('');
    const [waitingAnswerConfirm, setWaitingAnswerConfirm] = useState(false);
    const [waitingNextConfirm, setWaitingNextConfirm] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(0);

    const pendingDictationRef = useRef('');
    const autoSaveRef = useRef(null);
    const dictationTimeoutRef = useRef(null);
    const listeningPromptRef = useRef(null);
    const activeQuestionIdRef = useRef(null);
    const feedbackTimerRef = useRef(null);
    const statusTimerRef = useRef(null);
    const alertTimerRef = useRef(null);
    const previousTimeRemainingRef = useRef(null);
    const hasAnnouncedIntroRef = useRef(false);
    const questionHeadingRef = useRef(null);
    const openEndedInputRef = useRef(null);
    const confirmYesButtonRef = useRef(null);
    const finishContinueButtonRef = useRef(null);

    const voiceSupported = typeof window !== 'undefined'
        && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
    const isTimedExam = Number(exam?.timeLimit) > 0;
    const currentSectionName = getCurrentSectionName();
    const currentAnswer = currentQuestion ? answers[currentQuestion.id] : '';
    const savedOpenEndedAnswer = currentQuestion?.type === 'open-ended' && typeof currentAnswer === 'string'
        ? currentAnswer
        : '';
    const openEndedDraft = currentQuestion?.type === 'open-ended' ? openEndedText.trim() : '';
    const hasUnsavedOpenEndedDraft = currentQuestion?.type === 'open-ended'
        && Boolean(openEndedDraft)
        && openEndedDraft !== savedOpenEndedAnswer.trim();
    const progressPercent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
    const timerClass = !isTimedExam ? '' : timeRemaining <= 60 ? 'danger' : timeRemaining <= 300 ? 'warning' : '';
    const questionGuidance = currentQuestion?.type === 'open-ended'
        ? 'Type or speak your answer. When you pause, the system reads it back and asks Yes or No. Say Yes to save, or No to continue speaking. You can also say "Save answer" or press Control and Enter.'
        : currentQuestion?.type === 'true-false'
            ? 'Choose one answer. Say A or B, then confirm with Yes. After saving, you will be asked if you want the next question.'
            : 'Choose one answer. Say A, B, C, or D, then confirm with Yes. After saving, you will be asked if you want the next question.';

    const clearAnnouncementTimer = useCallback((timerRef) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const pushFeedback = useCallback((message) => {
        clearAnnouncementTimer(feedbackTimerRef);
        setFeedbackMsg(message);
        feedbackTimerRef.current = setTimeout(() => {
            setFeedbackMsg('');
            feedbackTimerRef.current = null;
        }, 3500);
    }, [clearAnnouncementTimer]);

    const updateLiveRegion = useCallback((setter, timerRef, message) => {
        clearAnnouncementTimer(timerRef);
        setter('');
        timerRef.current = setTimeout(() => {
            setter(message);
            timerRef.current = null;
        }, 30);
    }, [clearAnnouncementTimer]);

    const announce = useCallback((message, options = {}) => {
        const {
            toast = true,
            assertive = false,
            speakMessage = false,
            speechOptions = undefined
        } = options;

        if (!message) return;

        if (toast) {
            pushFeedback(message);
        }

        if (assertive) {
            updateLiveRegion(setScreenReaderAlert, alertTimerRef, message);
        } else {
            updateLiveRegion(setScreenReaderStatus, statusTimerRef, message);
        }

        if (speakMessage) {
            speak(message, speechOptions);
        }
    }, [pushFeedback, speak, updateLiveRegion]);

    const clearDictationTimer = useCallback(() => {
        if (dictationTimeoutRef.current) {
            clearTimeout(dictationTimeoutRef.current);
            dictationTimeoutRef.current = null;
        }
    }, []);

    const clearListeningPrompt = useCallback(() => {
        if (listeningPromptRef.current) {
            clearTimeout(listeningPromptRef.current);
            listeningPromptRef.current = null;
        }
    }, []);

    const resetPromptState = useCallback(() => {
        setShowConfirm(false);
        setPendingAnswer(null);
        setWaitingAnswerConfirm(false);
        setWaitingNextConfirm(false);
    }, []);

    const persistCurrentDraft = useCallback(async () => {
        return;
    }, []);

    const requestOpenEndedSaveConfirmation = useCallback((reason = 'pause') => {
        if (!currentQuestion || currentQuestion.type !== 'open-ended') return false;

        const draft = (openEndedText || pendingDictationRef.current || '').trim();
        if (!draft) return false;

        clearDictationTimer();
        setWaitingAnswerConfirm(true);
        pendingDictationRef.current = draft;

        const preview = draft.length > 180 ? `${draft.slice(0, 180)}...` : draft;
        const message = reason === 'pause'
            ? `I heard: ${preview}. Say yes to save it, or no to continue speaking.`
            : `You have an unsaved answer. I heard: ${preview}. Say yes to save it, or no to continue editing.`;

        announce(message, {
            speakMessage: true,
            assertive: true
        });

        openEndedInputRef.current?.focus();
        return true;
    }, [announce, clearDictationTimer, currentQuestion, openEndedText]);

    const readAccessibilityHelp = useCallback(() => {
        const helpText = voiceSupported
            ? 'Accessibility help. Say next, previous, repeat question, finish, review unanswered, or save answer. On the keyboard use Alt plus N for next, Alt plus P for previous, Alt plus R to repeat, Alt plus F to finish, and Alt plus A to D to choose an option. In the long answer box press Control and Enter to save.'
            : 'Accessibility help. Voice commands are not available in this browser, so use the keyboard. Press Alt plus N for next, Alt plus P for previous, Alt plus R to repeat the question, Alt plus F to open finish options, and Alt plus A to D to choose an option. In the long answer box press Control and Enter to save.';

        announce(helpText, { speakMessage: true, assertive: true });
    }, [announce, voiceSupported]);

    const requestHelp = useCallback(async (studentText) => {
        if (!currentQuestion) {
            announce('No question is active right now.', { speakMessage: true, assertive: true });
            return;
        }

        try {
            const res = await fetch('/ml/help', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentText,
                    questionText: currentQuestion.questionText
                })
            });

            if (!res.ok) {
                throw new Error(`Status ${res.status}`);
            }

            const data = await res.json();
            const text = data.response || 'Sorry, I could not generate a help message.';
            announce(text, { speakMessage: true, assertive: true });
        } catch (error) {
            console.error('Help request failed', error);
            announce('Sorry, I could not get help right now.', { speakMessage: true, assertive: true });
        }
    }, [announce, currentQuestion]);

    const moveToNextQuestion = useCallback(async () => {
        if (hasUnsavedOpenEndedDraft && !waitingAnswerConfirm) {
            requestOpenEndedSaveConfirmation('navigation');
            return;
        }
        await persistCurrentDraft();
        resetPromptState();
        nextQuestion();
    }, [hasUnsavedOpenEndedDraft, nextQuestion, persistCurrentDraft, requestOpenEndedSaveConfirmation, resetPromptState, waitingAnswerConfirm]);

    const moveToPreviousQuestion = useCallback(async () => {
        if (hasUnsavedOpenEndedDraft && !waitingAnswerConfirm) {
            requestOpenEndedSaveConfirmation('navigation');
            return;
        }
        await persistCurrentDraft();
        resetPromptState();
        prevQuestion();
    }, [hasUnsavedOpenEndedDraft, persistCurrentDraft, prevQuestion, requestOpenEndedSaveConfirmation, resetPromptState, waitingAnswerConfirm]);

    const moveToQuestion = useCallback(async (index) => {
        if (hasUnsavedOpenEndedDraft && !waitingAnswerConfirm) {
            requestOpenEndedSaveConfirmation('navigation');
            return;
        }
        await persistCurrentDraft();
        resetPromptState();
        goToQuestion(index);
    }, [goToQuestion, hasUnsavedOpenEndedDraft, persistCurrentDraft, requestOpenEndedSaveConfirmation, resetPromptState, waitingAnswerConfirm]);

    const openFinishDialog = useCallback(() => {
        if (hasUnsavedOpenEndedDraft && !waitingAnswerConfirm) {
            requestOpenEndedSaveConfirmation('navigation');
            return;
        }
        resetPromptState();
        setShowFinishModal(true);

        const finishMessage = unansweredQuestions.length > 0
            ? `Finish dialog opened. You still have ${unansweredQuestions.length} unanswered question${unansweredQuestions.length === 1 ? '' : 's'}. Say review unanswered to jump there, say yes or submit exam to submit now, or say no to continue.`
            : 'Finish dialog opened. Say yes or submit exam to submit now, or say no to continue the exam.';

        announce(finishMessage, { speakMessage: true, assertive: true });
    }, [announce, hasUnsavedOpenEndedDraft, requestOpenEndedSaveConfirmation, resetPromptState, unansweredQuestions.length, waitingAnswerConfirm]);

    const closeFinishDialog = useCallback(() => {
        setShowFinishModal(false);
        announce('Finish dialog closed. Continuing the exam.', { speakMessage: true, assertive: true });
    }, [announce]);

    const jumpToFirstUnanswered = useCallback(async () => {
        if (hasUnsavedOpenEndedDraft && !waitingAnswerConfirm) {
            requestOpenEndedSaveConfirmation('navigation');
            return;
        }
        await persistCurrentDraft();
        resetPromptState();
        setShowFinishModal(false);

        if (!unansweredQuestions.length) {
            announce('All questions already have answers.', { speakMessage: true, assertive: true });
            return;
        }

        goToFirstUnanswered();
        announce('Moving to the first unanswered question.', { speakMessage: true, assertive: true });
    }, [announce, goToFirstUnanswered, hasUnsavedOpenEndedDraft, persistCurrentDraft, requestOpenEndedSaveConfirmation, resetPromptState, unansweredQuestions.length, waitingAnswerConfirm]);

    const handleFinish = useCallback(async () => {
        if (hasUnsavedOpenEndedDraft && !waitingAnswerConfirm) {
            requestOpenEndedSaveConfirmation('navigation');
            return;
        }
        try {
            await persistCurrentDraft();
            const result = await finishExam();
            const completionMessage = result
                ? `Exam submitted. Opening results. Score ${result.score} out of ${result.totalPoints}. ${result.percentage} percent.`
                : 'Exam submitted. Opening results.';

            announce(completionMessage, { speakMessage: true, assertive: true });
            navigate('/student/result');
        } catch (error) {
            console.error('Finish exam error:', error);
            announce('There was a problem submitting the exam. Please try again.', { speakMessage: true, assertive: true });
        }
    }, [announce, finishExam, hasUnsavedOpenEndedDraft, navigate, persistCurrentDraft, requestOpenEndedSaveConfirmation, waitingAnswerConfirm]);

    const selectOption = useCallback((letter) => {
        if (!currentQuestion || currentQuestion.type === 'open-ended') return;

        if (currentQuestion.type === 'true-false' && letter !== 'A' && letter !== 'B') {
            announce('Invalid option. Choose A or B.', {
                speakMessage: true,
                assertive: true
            });
            return;
        }

        const option = getSelectedOption(currentQuestion, letter);
        const optionDescription = option ? `: ${option.text}` : '';

        stopTTS();
        setPendingAnswer(letter);
        setShowConfirm(true);
        setWaitingNextConfirm(false);

        announce(`Option ${letter}${optionDescription}. Are you sure?`, {
            speakMessage: true,
            assertive: true
        });
    }, [announce, currentQuestion, stopTTS]);

    const confirmAnswer = useCallback(async () => {
        if (!pendingAnswer || !currentQuestion) return;

        setAnswer(currentQuestion.id, pendingAnswer);
        await saveAnswer(currentQuestion.id, pendingAnswer);
        setShowConfirm(false);
        setPendingAnswer(null);
        setWaitingNextConfirm(true);

        stopTTS();
        announce(`Saved. Next question?`, {
            speakMessage: true,
            assertive: true
        });
    }, [announce, currentQuestion, pendingAnswer, saveAnswer, setAnswer, stopTTS]);

    const cancelAnswer = useCallback(() => {
        setPendingAnswer(null);
        setShowConfirm(false);
        announce('Cancelled.', { speakMessage: true, assertive: true });
    }, [announce]);

    const handleOpenEndedChange = useCallback((event) => {
        if (!currentQuestion) return;

        const value = event.target.value;
        setOpenEndedText(value);
        setPendingDictation(value);
        pendingDictationRef.current = value;
    }, [currentQuestion]);

    const clearOpenEndedAnswer = useCallback(async () => {
        if (!currentQuestion || currentQuestion.type !== 'open-ended') return;

        const hadSavedAnswer = Boolean((answers[currentQuestion.id] || '').trim());
        setOpenEndedText('');
        setPendingDictation('');
        pendingDictationRef.current = '';
        setWaitingAnswerConfirm(false);

        if (hadSavedAnswer) {
            setAnswer(currentQuestion.id, '');
            await saveAnswer(currentQuestion.id, '');
        }

        announce('Answer cleared. You can dictate or type a new answer.', { speakMessage: true, assertive: true });
        openEndedInputRef.current?.focus();
    }, [announce, answers, currentQuestion, saveAnswer, setAnswer]);

    const handleOpenEndedSubmit = useCallback(async () => {
        if (!currentQuestion || currentQuestion.type !== 'open-ended') return;

        const draft = (openEndedText || pendingDictationRef.current || '').trim();
        if (!draft) {
            announce('There is no answer to save yet.', { speakMessage: true, assertive: true });
            return;
        }

        clearDictationTimer();
        setWaitingAnswerConfirm(false);
        setOpenEndedText(draft);
        setPendingDictation(draft);
        pendingDictationRef.current = draft;
        setAnswer(currentQuestion.id, draft);
        await saveAnswer(currentQuestion.id, draft);

        announce('Open-ended answer saved. Say next when you are ready for the following question.', {
            speakMessage: true,
            assertive: true
        });
    }, [announce, clearDictationTimer, currentQuestion, openEndedText, saveAnswer, setAnswer]);

    const readCurrentQuestion = useCallback((preface = '') => {
        if (!currentQuestion) return;

        activeQuestionIdRef.current = currentQuestion.id;
        const questionId = currentQuestion.id;

        const spokenQuestionParts = buildQuestionSpeech(
            currentQuestion,
            currentIndex,
            questions.length,
            currentSectionName,
            currentAnswer
        );

        const promptText = currentQuestion.type === 'open-ended'
            ? 'You can speak your answer now. Say save answer when you are done.'
            : currentQuestion.type === 'true-false'
                ? 'Say A or B to answer, or use Alt plus A or B on the keyboard.'
                : 'Say A, B, C, or D to answer, or use Alt plus A to D on the keyboard.';

        const speechParts = preface ? [preface, ...spokenQuestionParts] : spokenQuestionParts;

        speak(speechParts, {
            onEnd: () => {
                if (activeQuestionIdRef.current === questionId) {
                    announce(promptText, { speakMessage: true });
                }
            }
        });
        updateLiveRegion(
            setScreenReaderStatus,
            statusTimerRef,
            `Question ${currentIndex + 1} of ${questions.length}. ${currentSectionName ? `${currentSectionName}. ` : ''}${getQuestionTypeLabel(currentQuestion.type)}.`
        );
    }, [
        currentAnswer,
        currentIndex,
        currentQuestion,
        currentSectionName,
        questions.length,
        speak,
        updateLiveRegion,
        announce
    ]);

    const handleVoiceDictation = useCallback((text, isFinal) => {
        if (!isFinal) return false;

        const cleaned = text.trim();
        if (!cleaned) return false;

        if (/\b(understand|help|nervous|anxious|what does|explain)\b/i.test(cleaned)) {
            requestHelp(cleaned);
            return true;
        }

        if (!currentQuestion || currentQuestion.type !== 'open-ended') return false;

        const baseText = pendingDictationRef.current || openEndedText;
        const updated = baseText ? `${baseText} ${cleaned}` : cleaned;

        setOpenEndedText(updated);
        setPendingDictation(updated);
        pendingDictationRef.current = updated;
        setWaitingAnswerConfirm(false);

        clearDictationTimer();
        dictationTimeoutRef.current = setTimeout(() => {
            dictationTimeoutRef.current = null;
            requestOpenEndedSaveConfirmation('pause');
        }, DICTATION_CONFIRM_DELAY);
        return true;
    }, [clearDictationTimer, currentQuestion, openEndedText, requestHelp, requestOpenEndedSaveConfirmation]);

    const handleYes = () => {
        if (showConfirm && pendingAnswer) {
            confirmAnswer();
            return;
        }

        if (waitingAnswerConfirm && currentQuestion?.type === 'open-ended') {
            handleOpenEndedSubmit();
            return;
        }

        if (waitingNextConfirm) {
            setWaitingNextConfirm(false);
            moveToNextQuestion();
            return;
        }

        if (showFinishModal) {
            handleFinish();
        }
    };

    const handleNo = () => {
        if (showConfirm && pendingAnswer) {
            cancelAnswer();
            return;
        }

        if (waitingAnswerConfirm) {
            setWaitingAnswerConfirm(false);
            announce('Okay. Keep editing your answer, or say clear answer to start over.', {
                speakMessage: true,
                assertive: true
            });
            openEndedInputRef.current?.focus();
            return;
        }

        if (waitingNextConfirm) {
            setWaitingNextConfirm(false);
            announce('Staying on the current question.', { speakMessage: true, assertive: true });
            return;
        }

        if (showFinishModal) {
            closeFinishDialog();
        }
    };

    const commandMap = {
        __shouldMatchOption__: () => currentQuestion?.type !== 'open-ended',
        next: () => {
            setWaitingNextConfirm(false);
            moveToNextQuestion();
        },
        xiga: () => {
            setWaitingNextConfirm(false);
            moveToNextQuestion();
        },
        'next question': () => {
            setWaitingNextConfirm(false);
            moveToNextQuestion();
        },
        previous: () => moveToPreviousQuestion(),
        back: () => moveToPreviousQuestion(),
        hore: () => moveToPreviousQuestion(),
        'previous question': () => moveToPreviousQuestion(),
        again: () => readCurrentQuestion(),
        try: () => readCurrentQuestion(),
        'try again': () => readCurrentQuestion(),
        repeat: () => readCurrentQuestion(),
        'repeat question': () => readCurrentQuestion(),
        'repeat question again': () => readCurrentQuestion(),
        'ku celi': () => readCurrentQuestion(),
        'soo celi': () => readCurrentQuestion(),
        help: () => readAccessibilityHelp(),
        'help me': () => readAccessibilityHelp(),
        caawi: () => readAccessibilityHelp(),
        'question help': () => requestHelp('Please explain this question in simpler words.'),
        'ai explanation': () => requestHelp('Please explain this question in simpler words.'),
        'ai help': () => requestHelp('Please explain this question in simpler words.'),
        'explanation': () => requestHelp('Please explain this question in simpler words.'),
        'explain': () => requestHelp('Please explain this question in simpler words.'),
        'review unanswered': () => jumpToFirstUnanswered(),
        'submit exam': () => handleFinish(),
        'submit': () => openFinishDialog(),
        'stop reading': () => {
            activeQuestionIdRef.current = null;
            stopTTS();
            announce('Speech stopped.', { toast: true, assertive: true });
        },
        finish: () => openFinishDialog(),
        dhammee: () => openFinishDialog(),
        option: (letter) => selectOption(letter),
        'save answer': () => handleOpenEndedSubmit(),
        xaree: () => handleOpenEndedSubmit(),
        keydi: () => handleOpenEndedSubmit(),
        'clear answer': () => clearOpenEndedAnswer(),
        'tir tir': () => clearOpenEndedAnswer(),
        'tir-tir': () => clearOpenEndedAnswer(),
        yes: handleYes,
        haa: handleYes,
        no: handleNo,
        maya: handleNo,
        cancel: () => {
            if (showConfirm && pendingAnswer) {
                cancelAnswer();
            } else if (showFinishModal) {
                closeFinishDialog();
            }
        }
    };

    const {
        isListening,
        transcript,
        lastCommand,
        startListening,
        stopListening,
        toggleListening
    } = useVoiceCommands(commandMap, true, handleVoiceDictation);

    useEffect(() => {
        if (!exam) return;

        if (!isTimedExam) {
            setTimeRemaining(0);
            previousTimeRemainingRef.current = null;
            return undefined;
        }

        const totalSeconds = Number(exam.timeLimit) * 60;
        previousTimeRemainingRef.current = totalSeconds;
        setTimeRemaining(totalSeconds);

        const interval = setInterval(() => {
            const remaining = Math.max(totalSeconds - getTimeTaken(), 0);
            const previousRemaining = previousTimeRemainingRef.current;

            setTimeRemaining(remaining);

            TIME_WARNING_THRESHOLDS.forEach((threshold) => {
                if (previousRemaining > threshold && remaining <= threshold) {
                    const message = buildTimeWarning(threshold);
                    announce(message, {
                        speakMessage: threshold <= 300,
                        assertive: threshold <= 60
                    });
                }
            });

            if (remaining <= 0) {
                clearInterval(interval);
                announce('Time is up. Submitting the exam now.', { speakMessage: true, assertive: true });
                handleFinish();
            }

            previousTimeRemainingRef.current = remaining;
        }, 1000);

        return () => clearInterval(interval);
    }, [announce, exam, getTimeTaken, handleFinish, isTimedExam]);

    useEffect(() => {
        autoSaveRef.current = setInterval(() => {
            if (!currentQuestion) return;

            if (answers[currentQuestion.id]) {
                saveAnswer(currentQuestion.id, answers[currentQuestion.id]);
            }
        }, 15000);

        return () => {
            if (autoSaveRef.current) {
                clearInterval(autoSaveRef.current);
                autoSaveRef.current = null;
            }
        };
    }, [answers, currentQuestion, saveAnswer]);

    useEffect(() => {
        const prevent = (event) => event.preventDefault();

        const handleVisibility = () => {
            if (!document.hidden) return;

            api.post('/logs', {
                examId: exam?.id,
                action: 'tab_switch_attempt',
                details: 'User switched tabs'
            }).catch(() => { });

            announce('Warning. Please stay on the exam page.', { speakMessage: true, assertive: true });
        };

        document.addEventListener('copy', prevent);
        document.addEventListener('paste', prevent);
        document.addEventListener('cut', prevent);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            document.removeEventListener('copy', prevent);
            document.removeEventListener('paste', prevent);
            document.removeEventListener('cut', prevent);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [announce, exam?.id]);

    useEffect(() => {
        if (isSpeaking) {
            stopListening();
        } else {
            startListening();
        }
    }, [isSpeaking, startListening, stopListening]);

    useEffect(() => {
        startListening();

        return () => {
            clearDictationTimer();
            clearListeningPrompt();
            clearAnnouncementTimer(feedbackTimerRef);
            clearAnnouncementTimer(statusTimerRef);
            clearAnnouncementTimer(alertTimerRef);
            stopListening();
            stopTTS();
        };
    }, [clearAnnouncementTimer, clearDictationTimer, clearListeningPrompt, startListening, stopListening, stopTTS]);

    useEffect(() => {
        if (!currentQuestion) return;

        resetPromptState();
        clearDictationTimer();
        clearListeningPrompt();

        if (currentQuestion.type === 'open-ended') {
            const existingDraft = typeof answers[currentQuestion.id] === 'string' ? answers[currentQuestion.id] : '';
            setOpenEndedText(existingDraft);
            setPendingDictation(existingDraft);
            pendingDictationRef.current = existingDraft;
        } else {
            setOpenEndedText('');
            setPendingDictation('');
            pendingDictationRef.current = '';
        }

        activeQuestionIdRef.current = currentQuestion.id;
        const questionId = currentQuestion.id;

        const spokenQuestionParts = buildQuestionSpeech(
            currentQuestion,
            currentIndex,
            questions.length,
            currentSectionName,
            answers[currentQuestion.id]
        );

        const intro = hasAnnouncedIntroRef.current
            ? ''
            : `Exam started for ${user?.name || 'student'}. The current question is focused for screen readers.`;

        const speechParts = intro ? [intro, ...spokenQuestionParts] : spokenQuestionParts;

        const promptText = currentQuestion.type === 'open-ended'
            ? 'You can speak your answer now. Say save answer when you are done.'
            : currentQuestion.type === 'true-false'
                ? 'Say A or B to answer, or use Alt plus A or B on the keyboard.'
                : 'Say A, B, C, or D to answer, or use Alt plus A to D on the keyboard.';

        speak(speechParts, {
            onEnd: () => {
                if (activeQuestionIdRef.current === questionId) {
                    announce(promptText, { speakMessage: true });
                }
            }
        });
        updateLiveRegion(
            setScreenReaderStatus,
            statusTimerRef,
            `${currentSectionName ? `${currentSectionName}. ` : ''}Question ${currentIndex + 1} of ${questions.length}. ${getQuestionTypeLabel(currentQuestion.type)}.`
        );

        hasAnnouncedIntroRef.current = true;

        requestAnimationFrame(() => {
            questionHeadingRef.current?.focus();
        });

    }, [
        announce,
        clearDictationTimer,
        clearListeningPrompt,
        currentIndex,
        currentQuestion,
        currentSectionName,
        questions.length,
        resetPromptState,
        speak,
        updateLiveRegion,
        user?.name
    ]);

    useEffect(() => {
        if (showConfirm) {
            confirmYesButtonRef.current?.focus();
        }
    }, [showConfirm]);

    useEffect(() => {
        if (showFinishModal) {
            finishContinueButtonRef.current?.focus();
        }
    }, [showFinishModal]);

    useEffect(() => {
        const handleKeydown = (event) => {
            const isAltShortcut = event.altKey && !event.ctrlKey && !event.metaKey;
            const key = event.key.toLowerCase();
            const target = event.target;
            const isEditable = target instanceof HTMLElement
                && (target.tagName === 'TEXTAREA'
                    || target.tagName === 'INPUT'
                    || target.getAttribute('contenteditable') === 'true');

            if (event.key === 'Escape') {
                if (showConfirm) {
                    event.preventDefault();
                    cancelAnswer();
                    return;
                }

                if (showFinishModal) {
                    event.preventDefault();
                    closeFinishDialog();
                    return;
                }

                event.preventDefault();
                activeQuestionIdRef.current = null;
                stopTTS();
                announce('Speech stopped.', { toast: true, assertive: true });
                return;
            }

            if (isEditable) {
                if (currentQuestion?.type === 'open-ended' && (event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                    event.preventDefault();
                    handleOpenEndedSubmit();
                }
                return;
            }

            if (!isAltShortcut) return;

            if (key === 'n') {
                event.preventDefault();
                moveToNextQuestion();
                return;
            }

            if (key === 'p') {
                event.preventDefault();
                moveToPreviousQuestion();
                return;
            }

            if (key === 'r') {
                event.preventDefault();
                readCurrentQuestion();
                return;
            }

            if (key === 'f') {
                event.preventDefault();
                openFinishDialog();
                return;
            }

            if (key === 'u') {
                event.preventDefault();
                jumpToFirstUnanswered();
                return;
            }

            if (key === 'm' && voiceSupported) {
                event.preventDefault();
                toggleListening();
                announce(isListening ? 'Microphone off.' : 'Microphone on.', { speakMessage: true, assertive: true });
                return;
            }

            const isOptionKey = key === 'a' || key === 'b' ||
                ((key === 'c' || key === 'd') && currentQuestion?.type !== 'true-false');
            if (isOptionKey && currentQuestion?.type !== 'open-ended') {
                event.preventDefault();
                selectOption(key.toUpperCase());
            }
        };

        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    }, [
        announce,
        cancelAnswer,
        closeFinishDialog,
        currentQuestion?.type,
        handleOpenEndedSubmit,
        isListening,
        jumpToFirstUnanswered,
        moveToNextQuestion,
        moveToPreviousQuestion,
        openFinishDialog,
        readCurrentQuestion,
        selectOption,
        showConfirm,
        showFinishModal,
        stopTTS,
        toggleListening,
        voiceSupported
    ]);

    if (!exam || !questions.length) {
        return (
            <div className="loading-page">
                <div className="spinner"></div>
                <p>Loading exam...</p>
            </div>
        );
    }

    return (
        <div className="page" style={{ paddingTop: 0 }}>
            <a className="exam-skip-link" href="#current-question-heading">Skip to current question</a>

            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {screenReaderStatus}
            </div>
            <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
                {screenReaderAlert}
            </div>

            <div className="navbar">
                <div className="navbar-brand">
                    <span className="icon" aria-hidden="true"><i className="fa-solid fa-clipboard-list"></i></span>
                    {exam.title}
                </div>
                <div className="navbar-actions">
                    <div className={`timer ${timerClass}`} role="status" aria-live="polite" aria-label={isTimedExam ? `Time remaining ${formatTime(timeRemaining)}` : 'Untimed exam'}>
                        <i className="fa-solid fa-stopwatch" aria-hidden="true"></i>
                        {isTimedExam ? formatTime(timeRemaining) : 'No limit'}
                    </div>
                </div>
            </div>

            <main className="app-container exam-shell">
                <section className="card exam-overview" aria-labelledby="exam-accessibility-title">
                    <div className="exam-support-header">
                        <div>
                            <h2 id="exam-accessibility-title" style={{ marginBottom: 8 }}>Blind-Friendly Exam Controls</h2>
                            <p className="text-muted">
                                Voice, keyboard, and screen reader support are all active here so the student can move through the exam without relying on sight.
                            </p>
                        </div>
                        <div
                            className={`voice-indicator ${isListening ? 'listening' : ''}`}
                            role="status"
                            aria-live="polite"
                            aria-label={isListening ? 'Voice listening is on' : 'Voice listening is off'}
                        >
                            <span className="voice-dot" aria-hidden="true"></span>
                            <span>{voiceSupported ? (isListening ? 'Listening' : 'Voice Paused') : 'Voice Not Supported'}</span>
                        </div>
                    </div>

                    <div className="exam-support-actions">
                        <button type="button" className="btn btn-secondary" onClick={readAccessibilityHelp}>
                            <i className="fa-solid fa-circle-info" aria-hidden="true"></i> Read Help
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                if (!voiceSupported) {
                                    announce('Voice input is not supported in this browser.', { speakMessage: true, assertive: true });
                                    return;
                                }

                                toggleListening();
                                announce(isListening ? 'Microphone off.' : 'Microphone on.', { speakMessage: true, assertive: true });
                            }}
                        >
                            <i className="fa-solid fa-microphone-lines" aria-hidden="true"></i>
                            {isListening ? 'Pause Voice' : 'Resume Voice'}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={jumpToFirstUnanswered} disabled={!unansweredQuestions.length}>
                            <i className="fa-solid fa-list-check" aria-hidden="true"></i> Review Unanswered
                        </button>
                    </div>

                    <div className="exam-command-list" id="exam-command-help">
                        <p><strong>Voice:</strong> Next, Previous, Repeat Question, Save Answer, Finish, Review Unanswered, Yes, No.</p>
                        <p><strong>Keyboard:</strong> Alt + N, Alt + P, Alt + R, Alt + F, Alt + U, Alt + A-D, and Ctrl + Enter inside long answers.</p>
                        <p><strong>Status:</strong> Last heard command: {lastCommand || 'None yet'}.</p>
                    </div>
                </section>

                <section className="card exam-progress-card" aria-labelledby="exam-progress-title">
                    <div className="flex items-center justify-between gap-md">
                        <h2 id="exam-progress-title">Exam Progress</h2>
                        <span className="badge badge-info">{progressPercent}% complete</span>
                    </div>

                    <div className="exam-progress-stats">
                        <span className="exam-stat-pill">Question {currentIndex + 1} of {questions.length}</span>
                        <span className="exam-stat-pill">{answeredCount} answered</span>
                        <span className="exam-stat-pill">{unansweredQuestions.length} remaining</span>
                        {currentSectionName && <span className="exam-stat-pill">Section: {currentSectionName}</span>}
                    </div>

                    <div className="progress-bar" aria-hidden="true">
                        <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </section>

                {sections.length > 0 && (
                    <nav className="section-tabs exam-section-nav" aria-label="Exam sections">
                        {sections.map((section) => (
                            <button
                                key={section._id}
                                type="button"
                                className={`section-tab ${currentQuestion?.sectionId === section._id ? 'active' : ''}`}
                                onClick={() => {
                                    const sectionIndex = questions.findIndex((question) => question.sectionId === section._id);
                                    if (sectionIndex >= 0) {
                                        moveToQuestion(sectionIndex);
                                    }
                                }}
                                aria-current={currentQuestion?.sectionId === section._id ? 'true' : undefined}
                                aria-label={`Go to section ${section.name}`}
                            >
                                {section.name}
                            </button>
                        ))}
                    </nav>
                )}

                {currentQuestion && (
                    <section
                        className="question-card active"
                        aria-labelledby="current-question-heading"
                        aria-describedby="question-guidance"
                    >
                        <div className="question-number exam-question-meta">
                            <span>{currentSectionName || 'Exam'} - Question {currentQuestion.order}</span>
                            <span className="badge badge-info">
                                {getQuestionTypeLabel(currentQuestion.type)}
                            </span>
                            <span className="badge badge-warning">
                                {currentQuestion.points} pt{currentQuestion.points === 1 ? '' : 's'}
                            </span>
                        </div>

                        <h1
                            id="current-question-heading"
                            className="question-text"
                            tabIndex="-1"
                            ref={questionHeadingRef}
                        >
                            {currentQuestion.questionText}
                        </h1>

                        <p id="question-guidance" className="exam-guidance">
                            {questionGuidance}
                        </p>

                        {(currentQuestion.type === 'mcq' || currentQuestion.type === 'true-false') && (
                            <div className="option-list" role="radiogroup" aria-label="Answer choices" aria-describedby="question-guidance">
                                {currentQuestion.options.map((option) => {
                                    const isSelected = currentAnswer === option.label;

                                    return (
                                        <button
                                            key={option.label}
                                            type="button"
                                            className={`option-btn ${isSelected ? 'selected' : ''}`}
                                            role="radio"
                                            aria-checked={isSelected}
                                            aria-label={`Option ${option.label}. ${option.text}`}
                                            onClick={() => selectOption(option.label)}
                                        >
                                            <span className="option-label">{option.label}</span>
                                            <span>{option.text}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {currentQuestion.type === 'open-ended' && (
                            <div>
                                <label className="sr-only" htmlFor="open-ended-answer">Your answer</label>
                                <textarea
                                    id="open-ended-answer"
                                    ref={openEndedInputRef}
                                    className="input"
                                    value={openEndedText}
                                    onChange={handleOpenEndedChange}
                                    placeholder="Type your answer here, or use voice input."
                                    rows={8}
                                    aria-describedby="question-guidance open-ended-support"
                                />

                                <p id="open-ended-support" className="text-muted mt-sm">
                                    Speak your answer, then pause. The system will read it back and ask Yes or No. Say No to keep speaking, or say Yes to save it.
                                </p>

                                {transcript && (
                                    <div className="exam-transcript" aria-live="polite">
                                        <strong>Heard:</strong> {transcript}
                                    </div>
                                )}

                                <div className="exam-support-actions mt-md">
                                    <button type="button" className="btn btn-primary" onClick={handleOpenEndedSubmit}>
                                        <i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Answer
                                    </button>
                                    <button type="button" className="btn btn-secondary" onClick={clearOpenEndedAnswer}>
                                        <i className="fa-solid fa-eraser" aria-hidden="true"></i> Clear Answer
                                    </button>
                                    <button type="button" className="btn btn-secondary" onClick={() => requestHelp('Please explain the current question in simpler words.')}>
                                        <i className="fa-solid fa-life-ring" aria-hidden="true"></i> Explain Question
                                    </button>
                                </div>
                            </div>
                        )}

                        {currentQuestion.type === 'open-ended' && hasUnsavedOpenEndedDraft && (
                            <div className="exam-answer-state" aria-live="polite">
                                <div className="badge badge-warning" style={{ padding: 12 }}>
                                    <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i> Unsaved draft
                                </div>
                                <div className="exam-answer-preview">
                                    {openEndedDraft}
                                </div>
                            </div>
                        )}

                        {currentAnswer && (
                            <div className="exam-answer-state" aria-live="polite">
                                <div className="badge badge-success" style={{ padding: 12 }}>
                                    <i className="fa-solid fa-circle-check" aria-hidden="true"></i> {currentQuestion.type === 'open-ended' ? 'Saved answer' : 'Answer saved'}
                                </div>
                                <div className="exam-answer-preview">
                                    {getCurrentAnswerSummary(currentQuestion, currentAnswer)}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                <section className="exam-navigation" aria-label="Question navigation">
                    <div className="exam-nav-main">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={moveToPreviousQuestion}
                            disabled={currentIndex === 0}
                            aria-label="Previous question"
                        >
                            <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Previous
                        </button>

                        <div className="exam-nav-secondary">
                            <button type="button" className="btn btn-secondary" onClick={() => readCurrentQuestion()}>
                                <i className="fa-solid fa-volume-high" aria-hidden="true"></i> Repeat
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={jumpToFirstUnanswered} disabled={!unansweredQuestions.length}>
                                <i className="fa-solid fa-list-check" aria-hidden="true"></i> Unanswered
                            </button>
                            <button type="button" className="btn btn-danger" onClick={openFinishDialog}>
                                <i className="fa-solid fa-flag-checkered" aria-hidden="true"></i> Finish
                            </button>
                        </div>

                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={moveToNextQuestion}
                            disabled={currentIndex === questions.length - 1}
                            aria-label="Next question"
                        >
                            Next <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                        </button>
                    </div>

                    <div className="card">
                        <div className="exam-rate-control">
                            <span style={{ fontWeight: 600 }}>
                                <i className="fa-solid fa-volume-high" aria-hidden="true"></i> Speech Speed
                            </span>
                            <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.1"
                                value={rate}
                                onChange={(event) => setRate(parseFloat(event.target.value))}
                                aria-label="Speech rate"
                                style={{ flex: 1 }}
                            />
                            <span style={{ fontWeight: 700, minWidth: 40 }}>{rate}x</span>
                        </div>
                    </div>
                </section>
            </main>

            {showConfirm && (
                <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-answer-title" aria-describedby="confirm-answer-description">
                    <div className="modal">
                        <h2 id="confirm-answer-title">Confirm Answer</h2>
                        <p id="confirm-answer-description">
                            You selected <strong>{getCurrentAnswerSummary(currentQuestion, pendingAnswer)}</strong>. Do you want to save it?
                        </p>
                        <div className="modal-actions">
                            <button type="button" className="btn btn-secondary" onClick={cancelAnswer}>
                                <i className="fa-solid fa-circle-xmark" aria-hidden="true"></i> No
                            </button>
                            <button type="button" className="btn btn-primary" onClick={confirmAnswer} ref={confirmYesButtonRef}>
                                <i className="fa-solid fa-circle-check" aria-hidden="true"></i> Yes
                            </button>
                        </div>
                        <p className="exam-modal-note">Voice shortcut: say Yes to save or No to change.</p>
                    </div>
                </div>
            )}

            {showFinishModal && (
                <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="finish-exam-title" aria-describedby="finish-exam-description">
                    <div className="modal">
                        <h2 id="finish-exam-title">
                            <i className="fa-solid fa-flag-checkered" aria-hidden="true"></i> Finish Exam
                        </h2>
                        <p id="finish-exam-description">
                            {unansweredQuestions.length > 0
                                ? `You still have ${unansweredQuestions.length} unanswered question${unansweredQuestions.length === 1 ? '' : 's'}.`
                                : 'All questions currently have answers.'}
                        </p>
                        <p>Submitting the exam cannot be undone.</p>
                        <div className="modal-actions">
                            <button type="button" className="btn btn-secondary" onClick={closeFinishDialog} ref={finishContinueButtonRef}>
                                <i className="fa-solid fa-circle-xmark" aria-hidden="true"></i> Continue Exam
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={jumpToFirstUnanswered} disabled={!unansweredQuestions.length}>
                                <i className="fa-solid fa-list-check" aria-hidden="true"></i> Review Unanswered
                            </button>
                            <button type="button" className="btn btn-danger" onClick={handleFinish}>
                                <i className="fa-solid fa-circle-check" aria-hidden="true"></i> Submit Exam
                            </button>
                        </div>
                        <p className="exam-modal-note">Voice shortcut: say &quot;Review Unanswered&quot;, &quot;Submit Exam&quot;, or &quot;No&quot; to continue.</p>
                    </div>
                </div>
            )}

            <VoiceFeedback message={feedbackMsg} />
        </div>
    );
}

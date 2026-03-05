import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { useTTS } from '../hooks/useTTS';
import VoiceFeedback from '../components/VoiceFeedback';
import api from '../api/axios';

export default function ExamPage() {
    const { user } = useAuth();
    const {
        exam, sections, questions, currentIndex, currentQuestion,
        answers, answeredCount, unansweredQuestions,
        nextQuestion, prevQuestion, goToQuestion, goToFirstUnanswered,
        setAnswer, saveAnswer, getCurrentSectionName, getTimeTaken, finishExam
    } = useExam();
    const { speak, speakQuestion, stop: stopTTS, isSpeaking, rate, setRate } = useTTS();
    const navigate = useNavigate();

    const [feedbackMsg, setFeedbackMsg] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingAnswer, setPendingAnswer] = useState(null);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [openEndedText, setOpenEndedText] = useState('');
    const [pendingDictation, setPendingDictation] = useState('');
    const [waitingAnswerConfirm, setWaitingAnswerConfirm] = useState(false);
    const [waitingNextConfirm, setWaitingNextConfirm] = useState(false);
    const [waitingFinishConfirm, setWaitingFinishConfirm] = useState(false);
    const [waitingUnansweredDecision, setWaitingUnansweredDecision] = useState(false);
    // waiting for yes/no continue prompt
    const [waitingForContinue, setWaitingForContinue] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const autoSaveRef = useRef(null);
    const dictationSaveTimer = useRef(null);
    const dictationTimeoutRef = useRef(null);

    const showFeedback = (msg) => {
        setFeedbackMsg(msg);
        setTimeout(() => setFeedbackMsg(''), 3500);
    };

    // ----- New: Help integration -----
    const requestHelp = useCallback(async (studentText) => {
        if (!currentQuestion) {
            speak('No question is active.');
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
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            const text = data.response || 'Sorry, I could not generate a help message.';
            speak(text);
            setFeedbackMsg(text);
        } catch (e) {
            console.error('Help request failed', e);
            speak('Sorry, I could not get help right now.');
        }
    }, [currentQuestion, speak]);

        // Timer
    useEffect(() => {
        if (!exam) return;
        const totalSecs = exam.timeLimit * 60;
        const interval = setInterval(() => {
            const elapsed = getTimeTaken();
            const remaining = totalSecs - elapsed;
            setTimeRemaining(remaining);
            if (remaining <= 0) {
                clearInterval(interval);
                handleFinish();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [exam]);

    // Auto-save every 15 seconds
    useEffect(() => {
        autoSaveRef.current = setInterval(() => {
            if (currentQuestion && answers[currentQuestion.id]) {
                saveAnswer(currentQuestion.id, answers[currentQuestion.id]);
            }
        }, 15000);
        return () => clearInterval(autoSaveRef.current);
    }, [currentQuestion, answers, saveAnswer]);


    // Security: prevent copy/paste
    useEffect(() => {
        const prevent = (e) => e.preventDefault();
        document.addEventListener('copy', prevent);
        document.addEventListener('paste', prevent);
        document.addEventListener('cut', prevent);

        // Tab switch detection
        const handleVisibility = () => {
            if (document.hidden) {
                api.post('/logs', {
                    examId: exam?.id,
                    action: 'tab_switch_attempt',
                    details: 'User switched tabs'
                }).catch(() => { });
                speak('Warning! Please do not switch tabs during the exam.');
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            document.removeEventListener('copy', prevent);
            document.removeEventListener('paste', prevent);
            document.removeEventListener('cut', prevent);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [exam]);

    const selectOption = useCallback((letter) => {
        if (!currentQuestion) return;
        if (currentQuestion.type === 'open-ended') return;

        setPendingAnswer(letter);
        speak(`${letter}? Yes or no?`);
        showFeedback(`Confirm ${letter}`);
        setShowConfirm(true);
    }, [currentQuestion, speak]);

    const confirmAnswer = useCallback(async () => {
        if (!pendingAnswer || !currentQuestion) return;
        setAnswer(currentQuestion.id, pendingAnswer);
        saveAnswer(currentQuestion.id, pendingAnswer); // Non-blocking for speed
        // More descriptive confirmation for a blind user
        speak('Answer recorded. Say Yes to continue or No to stay here.');
        showFeedback(`<i className="fa-solid fa-circle-check" aria-hidden="true"></i> Answered ${pendingAnswer}`);
        setShowConfirm(false);
        setPendingAnswer(null);
        setWaitingForContinue(true);
    }, [pendingAnswer, currentQuestion, setAnswer, saveAnswer, speak]);

    const cancelAnswer = useCallback(() => {
        setPendingAnswer(null);
        setShowConfirm(false);
        speak('Cancelled.');
    }, [speak]);


    const handleOpenEndedSubmit = async () => {
        if (!currentQuestion || !openEndedText.trim()) return;
        const text = openEndedText;
        setAnswer(currentQuestion.id, text);
        await saveAnswer(currentQuestion.id, text);
        speak('Answer recorded, please wait for teacher review.');
        showFeedback('<i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Waiting for teacher...');
        setOpenEndedText('');
        // advance after short delay
        setTimeout(() => nextQuestion(), 1000);
    };




    const handleFinish = async () => {
        try {
            // Save any pending answer
            if (currentQuestion && answers[currentQuestion.id]) {
                await saveAnswer(currentQuestion.id, answers[currentQuestion.id]);
            }

            const result = await finishExam();
            speak(`Exam submitted. Your score is ${result.score} out of ${result.totalPoints}. ${result.percentage} percent.`);
            navigate('/student/result');
        } catch (err) {
            speak('Error finishing exam. Please try again.');
        }
    };



    // auto-save typed open-ended answers after user pauses
    useEffect(() => {
        if (currentQuestion && currentQuestion.type === 'open-ended' && openEndedText.trim()) {
            // schedule save 1.5s after typing stops
            if (dictationSaveTimer.current) clearTimeout(dictationSaveTimer.current);
            dictationSaveTimer.current = setTimeout(async () => {
                const text = openEndedText;
                setAnswer(currentQuestion.id, text);
                await saveAnswer(currentQuestion.id, text);
                speak('Answer recorded, please wait for teacher review.');
                showFeedback('<i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Waiting for teacher...');
                setOpenEndedText('');
                setTimeout(() => nextQuestion(), 1000);
            }, 1500);
        }
        // cleanup on unmount or when question changes
        return () => {
            if (dictationSaveTimer.current) clearTimeout(dictationSaveTimer.current);
        };
    }, [openEndedText, currentQuestion, saveAnswer, setAnswer, speak, showFeedback, nextQuestion]);

    const handleVoiceDictation = useCallback((text) => {
        const cleaned = text.trim();

        // quick help keywords
        const lower = cleaned.toLowerCase();
        if (/\b(understand|help|nervous|anxious|what does)\b/.test(lower)) {
            requestHelp(cleaned);
            return;
        }

        if (!currentQuestion || currentQuestion.type !== 'open-ended') return;

        // accumulate transcript for 60s window
        setOpenEndedText(prev => (prev ? `${prev} ${cleaned}` : cleaned));
        setPendingDictation(prev => (prev ? `${prev} ${cleaned}` : cleaned));

        // start 60s capture window once
        if (!dictationTimeoutRef.current) {
            dictationTimeoutRef.current = setTimeout(() => {
                dictationTimeoutRef.current = null;
                setWaitingAnswerConfirm(true);
                speak('I captured your answer. Is it correct? Say Yes or No.');
            }, 60000);
        }
    }, [currentQuestion, requestHelp, speak]);

    const commandMap = {
        // navigation
        'next': () => {
            setWaitingNextConfirm(false);
            nextQuestion();
        },
        'previous': () => prevQuestion(),
        'back': () => prevQuestion(),
        'again': () => { if (currentQuestion) speakQuestion(currentQuestion); },
        'repeat question': () => { if (currentQuestion) speakQuestion(currentQuestion); },

        // option selection (handled by useVoiceCommands internal 'option' regex)
        'option': (letter) => selectOption(letter),

        // yes/no handlers for confirmations
        'yes': () => {
            if (waitingAnswerConfirm && currentQuestion?.type === 'open-ended') {
                setWaitingAnswerConfirm(false);
                if (dictationTimeoutRef.current) {
                    clearTimeout(dictationTimeoutRef.current);
                    dictationTimeoutRef.current = null;
                }
                setAnswer(currentQuestion.id, pendingDictation);
                saveAnswer(currentQuestion.id, pendingDictation);
                // if last question, prompt finish; else go next
                if (currentIndex === questions.length - 1) {
                    setWaitingFinishConfirm(true);
                    speak('Answer saved. This was the last question. Finish exam now? Say Yes or No.');
                } else {
                    speak('Answer saved. Go to next question? Say Yes or No.');
                    setWaitingNextConfirm(true);
                }
                return;
            }
            if (showConfirm && pendingAnswer) {
                confirmAnswer();
                setWaitingNextConfirm(true);
                speak('Answer recorded. Go to next question? Say Yes or No.');
                return;
            }
            if (waitingNextConfirm) {
                setWaitingNextConfirm(false);
                nextQuestion();
                return;
            }
            if (waitingFinishConfirm) {
                setWaitingFinishConfirm(false);
                handleFinish();
                return;
            }
            if (waitingUnansweredDecision) {
                setWaitingUnansweredDecision(false);
                goToFirstUnanswered();
                return;
            }
        },
        'no': () => {
            if (waitingAnswerConfirm) {
                setWaitingAnswerConfirm(false);
                speak('Okay, please say your answer again.');
                setOpenEndedText('');
                return;
            }
            if (waitingNextConfirm) {
                setWaitingNextConfirm(false);
                speak('Staying on this question.');
                return;
            }
            if (waitingFinishConfirm) {
                setWaitingFinishConfirm(false);
                speak('Submission cancelled.');
                return;
            }
            if (waitingUnansweredDecision) {
                setWaitingUnansweredDecision(false);
                speak('Please answer the remaining questions before finishing.');
                return;
            }
        },

        // finish
        'finish': () => {
            if (unansweredQuestions.length > 0) {
                setWaitingUnansweredDecision(true);
                speak(`You still have ${unansweredQuestions.length} unanswered questions. Should I take you to the first one? Say Yes or No.`);
            } else {
                setWaitingFinishConfirm(true);
                speak('Finish the exam now? Say Yes or No.');
            }
        }
    };

    const { isListening, transcript, lastCommand, startListening, stopListening, toggleListening } = useVoiceCommands(commandMap, true, handleVoiceDictation);

    // Read question aloud when it changes
    useEffect(() => {
        if (currentQuestion) {
            const text = currentQuestion.questionText +
                (currentQuestion.options && currentQuestion.options.length
                    ? '. Options: ' + currentQuestion.options.map(o => `${o.label}, ${o.text}`).join('. ') + '.'
                    : '');
            speak(text);
        }
    }, [currentQuestion, speak]);

    // Start voice listening on load
    useEffect(() => {
        startListening();
        return () => stopListening();
    }, []);

    // Format timer
    const formatTime = (secs) => {
        if (secs < 0) secs = 0;
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const timerClass = timeRemaining <= 60 ? 'danger' : timeRemaining <= 300 ? 'warning' : '';

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
            {/* Top bar */}
            <div className="navbar">
                <div className="navbar-brand">
                    <span className="icon" aria-hidden="true"><i className="fa-solid fa-clipboard-list"></i></span>
                    {exam.title}
                </div>
                <div className="navbar-actions">
                    <div className={`timer ${timerClass}`}>
                        <i className="fa-solid fa-stopwatch" aria-hidden="true"></i> {formatTime(timeRemaining)}
                    </div>
                </div>
            </div>

            {/* Voice commands active; instructions removed for brevity */}

            <div className="app-container" style={{ paddingTop: 24 }}>
                {/* Progress */}
                <div className="flex items-center justify-between mb-md">
                    <span style={{ fontWeight: 600 }}>
                        Question {currentIndex + 1} of {questions.length}
                    </span>
                    <span className="text-muted">
                        {answeredCount} answered · {unansweredQuestions.length} remaining
                    </span>
                </div>
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(answeredCount / questions.length) * 100}%` }}></div>
                </div>

                {/* Section tabs */}
                <div className="section-tabs mt-md">
                    {sections.map((sec, i) => (
                        <button
                            key={sec._id}
                            className={`section-tab ${currentQuestion?.sectionId === sec._id ? 'active' : ''}`}
                            onClick={() => {
                                const idx = questions.findIndex(q => q.sectionId === sec._id);
                                if (idx >= 0) goToQuestion(idx);
                            }}
                            aria-label={`Go to ${sec.name}`}
                        >
                            {sec.name}
                        </button>
                    ))}
                </div>

                {/* Question Card */}
                {currentQuestion && (
                    <div className="question-card active" role="main" aria-live="polite">
                        <div className="question-number">
                            {getCurrentSectionName()} · Question {currentQuestion.order}
                            <span className="badge badge-info" style={{ marginLeft: 12 }}>
                                {currentQuestion.type === 'mcq' ? 'Multiple Choice' : currentQuestion.type === 'true-false' ? 'True/False' : 'Open-Ended'}
                            </span>
                            <span className="badge badge-warning" style={{ marginLeft: 8 }}>
                                {currentQuestion.points} pt{currentQuestion.points !== 1 ? 's' : ''}
                            </span>
                        </div>

                        <div className="question-text">
                            {currentQuestion.questionText}
                        </div>

                        {/* MCQ / True-False Options */}
                        {(currentQuestion.type === 'mcq' || currentQuestion.type === 'true-false') && (
                            <div className="option-list">
                                {currentQuestion.options.map((opt) => (
                                    <button
                                        key={opt.label}
                                        className={`option-btn ${answers[currentQuestion.id] === opt.label ? 'selected' : ''}`}
                                        onClick={() => selectOption(opt.label)}
                                        aria-label={`Option ${opt.label}: ${opt.text}`}
                                        aria-pressed={answers[currentQuestion.id] === opt.label}
                                    >
                                        <span className="option-label">{opt.label}</span>
                                        <span>{opt.text}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Open-Ended */}
                        {currentQuestion.type === 'open-ended' && (
                            <div>
                                <textarea
                                    className="input"
                                    value={openEndedText || answers[currentQuestion.id] || ''}
                                    onChange={(e) => setOpenEndedText(e.target.value)}
                                    placeholder="Type your answer here, or use voice input..."
                                    rows={6}
                                    aria-label="Your answer"
                                />
                        {/* realtime transcript display */}
                        {transcript && currentQuestion.type === 'open-ended' && (
                            <div style={{ marginTop: 8, fontSize: 'var(--font-size-sm)', color: '#555' }}>
                                Heard: {transcript}
                            </div>
                        )}
                                <div className="flex gap-sm mt-md">
                                    <button className="btn btn-primary" onClick={handleOpenEndedSubmit}>
                                        <i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Answer
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => speak('You can type your answer or speak it. The answer will save automatically when you pause.')}>
                                        <i className="fa-solid fa-microphone-lines" aria-hidden="true"></i> Voice Hint
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Answer confirmation */}
                        {answers[currentQuestion.id] && (
                            <div>
                                <div className="badge badge-success mt-md" style={{ padding: 12 }}>
                                    <i className="fa-solid fa-circle-check" aria-hidden="true"></i> Current answer: {answers[currentQuestion.id]}
                                </div>
                                {currentQuestion.type === 'open-ended' && (
                                    <div className="badge badge-warning mt-sm" style={{ padding: 8 }}>
                                        <i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Waiting for teacher review...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation buttons */}
                <div className="flex justify-between mt-lg">
                    <button
                        className="btn btn-secondary"
                        onClick={prevQuestion}
                        disabled={currentIndex === 0}
                        aria-label="Previous Question"
                    >
                        <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Previous
                    </button>
                    <div className="flex gap-sm">
                        <button className="btn btn-secondary" onClick={() => { if (currentQuestion) speakQuestion(currentQuestion); }}>
                            <i className="fa-solid fa-volume-high" aria-hidden="true"></i> Repeat
                        </button>
                        <button className="btn btn-danger" onClick={() => {
                            if (unansweredQuestions.length > 0) {
                                speak(`You have ${unansweredQuestions.length} unanswered questions. Say Yes to submit, or No to cancel.`);
                            }
                            setShowFinishModal(true);
                        }}>
                            <i className="fa-solid fa-flag-checkered" aria-hidden="true"></i> Finish
                        </button>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={nextQuestion}
                        disabled={currentIndex === questions.length - 1}
                        aria-label="Next Question"
                    >
                        Next <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                    </button>
                </div>

                {/* TTS Speed Control */}
                <div className="card mt-lg" style={{ padding: 16 }}>
                    <div className="flex items-center gap-md">
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}><i className="fa-solid fa-volume-high" aria-hidden="true"></i> Speech Speed:</span>
                        <input
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.1"
                            value={rate}
                            onChange={(e) => setRate(parseFloat(e.target.value))}
                            aria-label="Speech rate"
                            style={{ flex: 1 }}
                        />
                        <span style={{ fontWeight: 700, minWidth: 40 }}>{rate}x</span>
                    </div>
                </div>
            </div>

            {/* Confirm answer modal */}
            {showConfirm && (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal">
                        <h2>Confirm Answer</h2>
                        <p>You selected <strong>Option {pendingAnswer}</strong>. Confirm?</p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={cancelAnswer}><i className="fa-solid fa-circle-xmark" aria-hidden="true"></i> No</button>
                            <button className="btn btn-primary" onClick={confirmAnswer}><i className="fa-solid fa-circle-check" aria-hidden="true"></i> Yes</button>
                        </div>
                        <p className="text-muted mt-md" style={{ fontSize: 'var(--font-size-sm)' }}>
                            Say &quot;Yes&quot; or &quot;No&quot;
                        </p>
                    </div>
                </div>
            )}

            {/* Finish modal */}
            {showFinishModal && (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal">
                        <h2><i className="fa-solid fa-flag-checkered" aria-hidden="true"></i> Finish Exam?</h2>
                        {unansweredQuestions.length > 0 && (
                            <p style={{ color: 'var(--warning)', fontWeight: 600, marginBottom: 12 }}>
                                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> You have {unansweredQuestions.length} unanswered question{unansweredQuestions.length !== 1 ? 's' : ''}.
                            </p>
                        )}
                        <p>Are you sure you want to submit? This cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => { setShowFinishModal(false); speak('Continuing exam.'); }}>
                                <i className="fa-solid fa-circle-xmark" aria-hidden="true"></i> No, Continue
                            </button>
                            <button className="btn btn-secondary" onClick={() => { setShowFinishModal(false); goToFirstUnanswered(); speak('Going to unanswered questions.'); }}>
                                <i className="fa-solid fa-list-check" aria-hidden="true"></i> Review Unanswered
                            </button>
                            <button className="btn btn-danger" onClick={() => { setShowFinishModal(false); handleFinish(); }}>
                                <i className="fa-solid fa-circle-check" aria-hidden="true"></i> Yes, Submit
                            </button>
                        </div>
                        <p className="text-muted mt-md" style={{ fontSize: 'var(--font-size-sm)' }}>
                            Say &quot;Yes&quot; to submit or &quot;No&quot; to continue
                        </p>
                    </div>
                </div>
            )}

            <VoiceFeedback message={feedbackMsg} />
        </div>
    );
}


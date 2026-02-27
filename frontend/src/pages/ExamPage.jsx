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
    const [timeRemaining, setTimeRemaining] = useState(0);
    const autoSaveRef = useRef(null);

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

    // Read question on change
    useEffect(() => {
        if (currentQuestion) {
            speakQuestion(currentQuestion);
            // Log activity
            api.post('/logs', {
                examId: exam.id,
                action: 'question_opened',
                questionId: currentQuestion.id,
                details: `Question ${currentIndex + 1}`
            }).catch(() => { });
        }
    }, [currentIndex]);

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

    const showFeedback = (msg) => {
        setFeedbackMsg(msg);
        setTimeout(() => setFeedbackMsg(''), 3500);
    };

    const selectOption = useCallback((letter) => {
        if (!currentQuestion) return;
        if (currentQuestion.type === 'open-ended') return;

        setPendingAnswer(letter);
        speak(`${letter}? Yes or no?`);
        showFeedback(`❓ Confirm ${letter}`);
        setShowConfirm(true);
    }, [currentQuestion, speak]);

    const confirmAnswer = useCallback(async () => {
        if (!pendingAnswer || !currentQuestion) return;
        setAnswer(currentQuestion.id, pendingAnswer);
        saveAnswer(currentQuestion.id, pendingAnswer); // Non-blocking for speed
        speak('Confirmed.');
        showFeedback(`✅ Answered ${pendingAnswer}`);
        setShowConfirm(false);
        setPendingAnswer(null);
        // Wait 1 second before moving to next question as requested
        setTimeout(() => {
            nextQuestion();
        }, 1000);
    }, [pendingAnswer, currentQuestion, setAnswer, saveAnswer, speak, nextQuestion]);

    const cancelAnswer = useCallback(() => {
        setPendingAnswer(null);
        setShowConfirm(false);
        speak('Cancelled.');
    }, [speak]);

    const [isConfirmingOpenEnded, setIsConfirmingOpenEnded] = useState(false);

    const handleOpenEndedSubmit = async () => {
        if (!currentQuestion || !openEndedText.trim()) return;
        setIsConfirmingOpenEnded(true);
        speak(`Your answer is recorded as: ${openEndedText}. Do you want to submit this answer?`);
        showFeedback('❓ Reviewing Answer');
    };

    const confirmOpenEnded = useCallback(async () => {
        if (!currentQuestion || !openEndedText) return;
        setAnswer(currentQuestion.id, openEndedText);
        await saveAnswer(currentQuestion.id, openEndedText);
        speak('Answer saved.');
        showFeedback('✅ Answer saved');
        setOpenEndedText('');
        setIsConfirmingOpenEnded(false);
        // Wait 1 second before moving to next question as requested
        setTimeout(() => {
            nextQuestion();
        }, 1000);
    }, [currentQuestion, openEndedText, setAnswer, saveAnswer, speak, nextQuestion]);

    const cancelOpenEnded = useCallback(() => {
        setIsConfirmingOpenEnded(false);
        speak('Answer not saved. You can speak to correct your answer now.');
        showFeedback('✏️ Editing');
    }, [speak]);

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

    const handleVoiceDictation = useCallback((text) => {
        if (currentQuestion && currentQuestion.type === 'open-ended') {
            setOpenEndedText(prev => (prev ? prev + ' ' + text : text));
            showFeedback('🎤 Dictating...');
        }
    }, [currentQuestion]);

    // Voice command map
    const commandMap = {
        // --- Navigation ---
        'next': () => nextQuestion(),
        'go next': () => nextQuestion(),
        'go to next': () => nextQuestion(),
        'next question': () => nextQuestion(),
        'go forward': () => nextQuestion(),
        'move next': () => nextQuestion(),
        'continue': () => nextQuestion(),

        'back': () => {
            if (currentIndex > 0) {
                speak('Going back.', { rate: 1.3 });
                prevQuestion();
            } else {
                speak('This is the first question.');
            }
        },
        'go back': () => {
            if (currentIndex > 0) {
                speak('Going back.', { rate: 1.3 });
                prevQuestion();
            }
        },
        'previous': () => {
            if (currentIndex > 0) {
                speak('Previous question.', { rate: 1.3 });
                prevQuestion();
            }
        },
        'previous question': () => {
            if (currentIndex > 0) {
                speak('Previous question.', { rate: 1.3 });
                prevQuestion();
            }
        },
        'take me back': () => prevQuestion(),
        'move back': () => prevQuestion(),

        'repeat': () => speakQuestion(currentQuestion),
        'repeat question': () => speakQuestion(currentQuestion),
        'what is the question': () => speakQuestion(currentQuestion),
        'read again': () => speakQuestion(currentQuestion),
        'again': () => speakQuestion(currentQuestion),
        'say again': () => speakQuestion(currentQuestion),

        'skip': () => nextQuestion(),
        'skip question': () => nextQuestion(),
        'skip this': () => nextQuestion(),

        'where am i': () => {
            const part = currentQuestion?.sectionId === sections[0]?._id ? '1' : currentQuestion?.sectionId === sections[1]?._id ? '2' : '3';
            speak(`You are in Part ${part}, question ${currentQuestionIndex + 1}.`);
        },
        'what question am i on': () => speak(`You are on question ${currentQuestionIndex + 1}.`),

        'go to part 1': () => {
            const idx = questions.findIndex(q => q.sectionId === sections[0]?._id);
            if (idx >= 0) { goToQuestion(idx); speak('Opening Part 1.'); }
        },
        'go to part 2': () => {
            const idx = questions.findIndex(q => q.sectionId === sections[1]?._id);
            if (idx >= 0) { goToQuestion(idx); speak('Opening Part 2.'); }
        },
        'go to part 3': () => {
            const idx = questions.findIndex(q => q.sectionId === sections[2]?._id);
            if (idx >= 0) { goToQuestion(idx); speak('Opening Part 3.'); }
        },
        'unanswered questions': () => goToFirstUnanswered(),

        // --- Answering ---
        'save': () => handleOpenEndedSubmit(),
        'save answer': () => handleOpenEndedSubmit(),
        'save answers': () => handleOpenEndedSubmit(),
        'submit my answer': () => handleOpenEndedSubmit(),

        'clear': () => {
            if (currentQuestion?.type === 'open-ended') {
                setOpenEndedText('');
                speak('Answer cleared. Speak again.');
            }
        },
        'clear answer': () => {
            if (currentQuestion?.type === 'open-ended') {
                setOpenEndedText('');
                speak('Answer cleared. Speak again.');
            }
        },

        'how many remaining': () => {
            const rem = unansweredQuestions.length;
            speak(rem === 0 ? 'All questions answered.' : `You have ${rem} unanswered questions.`);
        },

        'finish': () => {
            setShowFinishModal(true); // Show immediately
            const rem = unansweredQuestions.length;
            if (rem > 0) {
                // Concise warning
                speak(`${rem} unanswered. Submit? Yes or No?`, { rate: 1.3 });
            } else {
                // Fast confirmation
                speak('Submit exam? Yes or No?', { rate: 1.3 });
            }
        },
        'finish exam': () => {
            setShowFinishModal(true);
            speak('Submit? Yes or No?', { rate: 1.3 });
        },
        'submit exam': () => {
            setShowFinishModal(true);
            speak('Submit? Yes or No?', { rate: 1.3 });
        },
        'submit my answers': () => {
            setShowFinishModal(true);
            speak('Submit? Yes or No?', { rate: 1.3 });
        },

        'option': (letter) => selectOption(letter),

        // Explicit single letter commands for speed
        'a': () => selectOption('A'),
        'b': () => selectOption('B'),
        'c': () => selectOption('C'),
        'd': () => selectOption('D'),

        'answer a': () => selectOption('A'),
        'answer b': () => selectOption('B'),
        'answer c': () => selectOption('C'),
        'answer d': () => selectOption('D'),

        'select a': () => selectOption('A'),
        'select b': () => selectOption('B'),
        'select c': () => selectOption('C'),
        'select d': () => selectOption('D'),
        'yes': () => {
            if (showFinishModal) { setShowFinishModal(false); handleFinish(); }
            else if (isConfirmingOpenEnded) confirmOpenEnded();
            else if (showConfirm) confirmAnswer();
            else if (currentQuestion && answers[currentQuestion.id]) {
                nextQuestion();
            }
        },
        'confirm': () => {
            if (showFinishModal) { setShowFinishModal(false); handleFinish(); }
            else if (isConfirmingOpenEnded) confirmOpenEnded();
            else if (showConfirm) confirmAnswer();
            else if (currentQuestion && answers[currentQuestion.id]) {
                nextQuestion();
            }
        },
        'no': () => {
            if (showFinishModal) { setShowFinishModal(false); speak('Continuing.'); }
            else if (isConfirmingOpenEnded) cancelOpenEnded();
            else if (showConfirm) cancelAnswer();
            else if (currentQuestion && answers[currentQuestion.id]) {
                speak('Answer cancelled. Choose another option.');
            }
        },
        'cancel': () => {
            if (showFinishModal) { setShowFinishModal(false); speak('Continuing.'); }
            else if (isConfirmingOpenEnded) cancelOpenEnded();
            else if (showConfirm) cancelAnswer();
        },
        'i don’t understand': () => speak('This question asks ' + currentQuestion?.questionText + '. Simply pick an option or speak your answer.'),
        'explain': () => speak('This question asks ' + currentQuestion?.questionText + '. Simply pick an option or speak your answer.')
    };

    const { isListening, lastCommand, startListening, stopListening, toggleListening } = useVoiceCommands(commandMap, true, handleVoiceDictation);

    useEffect(() => {
        if (isConfirmingOpenEnded) {
            // We are confirming, so we should probably stop theRecognition from picking up dictation
            // but useVoiceCommands already handles it since processCommand is called first.
        }
    }, [isConfirmingOpenEnded]);

    // Start listening when page loads
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
                    <span className="icon">📝</span>
                    {exam.title}
                </div>
                <div className="navbar-actions">
                    <div className={`voice-indicator ${isListening ? 'listening' : ''}`}>
                        <div className="voice-dot"></div>
                        {isListening ? 'Listening...' : 'Mic Off'}
                    </div>
                    <button className="btn btn-sm btn-secondary" onClick={toggleListening}>
                        {isListening ? '🔇 Mute' : '🎤 Listen'}
                    </button>
                    <div className={`timer ${timerClass}`}>
                        ⏱️ {formatTime(timeRemaining)}
                    </div>
                </div>
            </div>

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
                                <div className="flex gap-sm mt-md">
                                    <button className="btn btn-primary" onClick={handleOpenEndedSubmit}>
                                        💾 Save Answer
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => speak('You can type your answer or speak it. Click save when done.')}>
                                        🎤 Voice Hint
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Answer confirmation */}
                        {answers[currentQuestion.id] && (
                            <div className="badge badge-success mt-md" style={{ padding: 12 }}>
                                ✅ Current answer: {answers[currentQuestion.id]}
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
                        ⬅️ Previous
                    </button>
                    <div className="flex gap-sm">
                        <button className="btn btn-secondary" onClick={() => { if (currentQuestion) speakQuestion(currentQuestion); }}>
                            🔊 Repeat
                        </button>
                        <button className="btn btn-danger" onClick={() => {
                            if (unansweredQuestions.length > 0) {
                                speak(`You have ${unansweredQuestions.length} unanswered questions. Say Yes to submit, or No to cancel.`);
                            }
                            setShowFinishModal(true);
                        }}>
                            🏁 Finish
                        </button>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={nextQuestion}
                        disabled={currentIndex === questions.length - 1}
                        aria-label="Next Question"
                    >
                        Next ➡️
                    </button>
                </div>

                {/* TTS Speed Control */}
                <div className="card mt-lg" style={{ padding: 16 }}>
                    <div className="flex items-center gap-md">
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>🔊 Speech Speed:</span>
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
                            <button className="btn btn-secondary" onClick={cancelAnswer}>❌ No</button>
                            <button className="btn btn-primary" onClick={confirmAnswer}>✅ Yes</button>
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
                        <h2>🏁 Finish Exam?</h2>
                        {unansweredQuestions.length > 0 && (
                            <p style={{ color: 'var(--warning)', fontWeight: 600, marginBottom: 12 }}>
                                ⚠️ You have {unansweredQuestions.length} unanswered question{unansweredQuestions.length !== 1 ? 's' : ''}.
                            </p>
                        )}
                        <p>Are you sure you want to submit? This cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => { setShowFinishModal(false); speak('Continuing exam.'); }}>
                                ❌ No, Continue
                            </button>
                            <button className="btn btn-secondary" onClick={() => { setShowFinishModal(false); goToFirstUnanswered(); speak('Going to unanswered questions.'); }}>
                                🔄 Review Unanswered
                            </button>
                            <button className="btn btn-danger" onClick={() => { setShowFinishModal(false); handleFinish(); }}>
                                ✅ Yes, Submit
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

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import api from '../api/axios';

const ExamContext = createContext(null);

export function ExamProvider({ children }) {
    const [exam, setExam] = useState(null);
    const [sections, setSections] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [startTime, setStartTime] = useState(null);
    const [isFinished, setIsFinished] = useState(false);
    const [result, setResult] = useState(null);

    const autoSaveTimer = useRef(null);

    const resetExamSession = useCallback(() => {
        setExam(null);
        setSections([]);
        setQuestions([]);
        setCurrentIndex(0);
        setAnswers({});
        setStartTime(null);
        setIsFinished(false);
        setResult(null);
    }, []);

    const startExam = useCallback((examData, sectionsData, questionsData) => {
        setExam(examData);
        setSections(sectionsData);
        setQuestions(questionsData);
        setCurrentIndex(0);
        setAnswers({});
        setStartTime(Date.now());
        setIsFinished(false);
        setResult(null);
    }, []);

    const currentQuestion = questions[currentIndex] || null;

    const goToQuestion = useCallback((index) => {
        if (index >= 0 && index < questions.length) {
            setCurrentIndex(index);
        }
    }, [questions.length]);

    const nextQuestion = useCallback(() => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, questions.length]);

    const prevQuestion = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex]);

    const setAnswer = useCallback((questionId, answer) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
    }, []);

    const unansweredQuestions = questions.filter(q => !answers[q.id]);
    const answeredCount = questions.length - unansweredQuestions.length;

    const goToFirstUnanswered = useCallback(() => {
        const idx = questions.findIndex(q => !answers[q.id]);
        if (idx !== -1) setCurrentIndex(idx);
    }, [questions, answers]);

    const getTimeTaken = useCallback(() => {
        if (!startTime) return 0;
        return Math.floor((Date.now() - startTime) / 1000);
    }, [startTime]);

    const getCurrentSectionName = useCallback(() => {
        if (!currentQuestion || !sections.length) return '';
        const section = sections.find(s => s._id === currentQuestion.sectionId);
        return section ? section.name : '';
    }, [currentQuestion, sections]);

    // Auto-save answer to backend
    const saveAnswer = useCallback(async (questionId, answer) => {
        if (!exam) return;
        try {
            await api.post(`/exams/${exam.id}/answer`, {
                questionId,
                selectedAnswer: answer
            });
        } catch (err) {
            console.error('Auto-save error:', err);
        }
    }, [exam]);

    const finishExam = useCallback(async () => {
        if (!exam) return null;
        try {
            const res = await api.post(`/exams/${exam.id}/finish`, {
                timeTaken: getTimeTaken()
            });
            setIsFinished(true);
            setResult(res.data.result);
            return res.data.result;
        } catch (err) {
            console.error('Finish exam error:', err);
            throw err;
        }
    }, [exam, getTimeTaken]);

    const value = {
        exam,
        sections,
        questions,
        currentIndex,
        currentQuestion,
        answers,
        startTime,
        isFinished,
        result,
        answeredCount,
        unansweredQuestions,
        resetExamSession,
        startExam,
        goToQuestion,
        nextQuestion,
        prevQuestion,
        setAnswer,
        saveAnswer,
        goToFirstUnanswered,
        getTimeTaken,
        getCurrentSectionName,
        finishExam
    };

    return (
        <ExamContext.Provider value={value}>
            {children}
        </ExamContext.Provider>
    );
}

export function useExam() {
    const context = useContext(ExamContext);
    if (!context) throw new Error('useExam must be used within ExamProvider');
    return context;
}

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import api from '../api/axios';

const ExamContext = createContext(null);

const RECORDING_MIME_CANDIDATES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4'
];

function browserSupportsRecording() {
    return typeof window !== 'undefined'
        && typeof window.MediaRecorder !== 'undefined'
        && typeof navigator !== 'undefined'
        && !!navigator.mediaDevices?.getUserMedia;
}

function getSupportedRecordingMimeType() {
    if (!browserSupportsRecording() || typeof window.MediaRecorder.isTypeSupported !== 'function') {
        return '';
    }

    return RECORDING_MIME_CANDIDATES.find((mimeType) => window.MediaRecorder.isTypeSupported(mimeType)) || '';
}

export function ExamProvider({ children }) {
    const [exam, setExam] = useState(null);
    const [sections, setSections] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [startTime, setStartTime] = useState(null);
    const [isFinished, setIsFinished] = useState(false);
    const [result, setResult] = useState(null);
    const [recordingState, setRecordingState] = useState({
        supported: browserSupportsRecording(),
        status: 'idle',
        currentExamId: null,
        currentExamTitle: '',
        error: '',
        lastUploadedAt: null
    });

    const autoSaveTimer = useRef(null);
    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const recordingChunksRef = useRef([]);
    const recordingMetaRef = useRef(null);

    const stopMediaTracks = useCallback(() => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }
    }, []);

    const clearRecordingRefs = useCallback(() => {
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
        recordingMetaRef.current = null;
        stopMediaTracks();
    }, [stopMediaTracks]);

    const uploadRecordingBlob = useCallback(async (blob, meta, status) => {
        if (!blob || !meta?.examId) return null;

        const startedAt = meta.startedAt ? new Date(meta.startedAt) : new Date();
        const endedAt = new Date();
        const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

        const headerMeta = {
            ...meta,
            status,
            startedAt: startedAt.toISOString(),
            endedAt: endedAt.toISOString(),
            durationSeconds
        };

        await api.post(`/recordings/exams/${meta.examId}/upload`, blob, {
            headers: {
                'Content-Type': meta.mimeType || 'application/octet-stream',
                'X-Recording-Meta': JSON.stringify(headerMeta)
            }
        });

        return {
            uploadedAt: endedAt.toISOString(),
            durationSeconds
        };
    }, []);

    const stopExamRecording = useCallback(async ({ status = 'completed', upload = true } = {}) => {
        const meta = recordingMetaRef.current;
        const recorder = mediaRecorderRef.current;

        if (!meta) {
            clearRecordingRefs();
            setRecordingState((prev) => ({
                ...prev,
                supported: browserSupportsRecording(),
                status: 'idle',
                currentExamId: null,
                currentExamTitle: ''
            }));
            return null;
        }

        setRecordingState((prev) => ({
            ...prev,
            status: upload ? 'uploading' : 'stopping',
            error: ''
        }));

        try {
            let blob = null;

            if (recorder && recorder.state !== 'inactive') {
                blob = await new Promise((resolve, reject) => {
                    const handleStop = () => {
                        recorder.removeEventListener('error', handleError);
                        const nextBlob = recordingChunksRef.current.length
                            ? new Blob(recordingChunksRef.current, { type: meta.mimeType || recorder.mimeType || 'audio/webm' })
                            : null;
                        resolve(nextBlob);
                    };

                    const handleError = (event) => {
                        recorder.removeEventListener('stop', handleStop);
                        reject(event?.error || new Error('Recording failed.'));
                    };

                    recorder.addEventListener('stop', handleStop, { once: true });
                    recorder.addEventListener('error', handleError, { once: true });

                    try {
                        if (recorder.state === 'recording') {
                            recorder.requestData();
                        }
                        recorder.stop();
                    } catch (error) {
                        recorder.removeEventListener('stop', handleStop);
                        recorder.removeEventListener('error', handleError);
                        reject(error);
                    }
                });
            } else if (recordingChunksRef.current.length) {
                blob = new Blob(recordingChunksRef.current, { type: meta.mimeType || 'audio/webm' });
            }

            stopMediaTracks();

            let uploadInfo = null;
            if (upload && blob?.size) {
                uploadInfo = await uploadRecordingBlob(blob, meta, status);
            }

            clearRecordingRefs();
            setRecordingState((prev) => ({
                ...prev,
                supported: browserSupportsRecording(),
                status: 'idle',
                currentExamId: null,
                currentExamTitle: '',
                error: '',
                lastUploadedAt: uploadInfo?.uploadedAt || prev.lastUploadedAt
            }));

            return uploadInfo;
        } catch (error) {
            console.error('Stop recording error:', error);
            clearRecordingRefs();
            setRecordingState((prev) => ({
                ...prev,
                supported: browserSupportsRecording(),
                status: 'error',
                currentExamId: null,
                currentExamTitle: '',
                error: error?.message || 'Could not save the audio recording.'
            }));
            return null;
        }
    }, [clearRecordingRefs, stopMediaTracks, uploadRecordingBlob]);

    const ensureExamRecording = useCallback(async (sessionMeta) => {
        if (!sessionMeta?.examId) return false;

        if (!browserSupportsRecording()) {
            setRecordingState((prev) => ({
                ...prev,
                supported: false,
                status: 'unsupported',
                currentExamId: null,
                currentExamTitle: '',
                error: 'This browser does not support audio recording.'
            }));
            return false;
        }

        const activeMeta = recordingMetaRef.current;
        if (activeMeta?.examId === sessionMeta.examId && mediaRecorderRef.current?.state === 'recording') {
            return true;
        }

        if (activeMeta?.examId && activeMeta.examId !== sessionMeta.examId) {
            await stopExamRecording({ status: 'stopped', upload: true });
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = getSupportedRecordingMimeType();
            const recorder = mimeType
                ? new window.MediaRecorder(stream, { mimeType })
                : new window.MediaRecorder(stream);

            recordingChunksRef.current = [];
            mediaStreamRef.current = stream;
            mediaRecorderRef.current = recorder;
            recordingMetaRef.current = {
                ...sessionMeta,
                mimeType: mimeType || recorder.mimeType || 'audio/webm',
                startedAt: new Date().toISOString()
            };

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordingChunksRef.current.push(event.data);
                }
            };

            recorder.onerror = (event) => {
                console.error('Recording error:', event?.error || event);
                setRecordingState((prev) => ({
                    ...prev,
                    status: 'error',
                    error: event?.error?.message || 'Audio recording failed.'
                }));
            };

            recorder.start(10000);
            setRecordingState((prev) => ({
                ...prev,
                supported: true,
                status: 'recording',
                currentExamId: sessionMeta.examId,
                currentExamTitle: sessionMeta.subjectName || sessionMeta.examTitle || '',
                error: ''
            }));

            return true;
        } catch (error) {
            console.error('Start recording error:', error);
            clearRecordingRefs();
            setRecordingState((prev) => ({
                ...prev,
                supported: browserSupportsRecording(),
                status: 'error',
                currentExamId: null,
                currentExamTitle: '',
                error: error?.message || 'Could not access the microphone for recording.'
            }));
            return false;
        }
    }, [clearRecordingRefs, stopExamRecording]);

    const resetExamSession = useCallback(async ({ recordingStatus = 'stopped', preserveRecording = false } = {}) => {
        if (!preserveRecording) {
            await stopExamRecording({ status: recordingStatus, upload: true });
        }

        setExam(null);
        setSections([]);
        setQuestions([]);
        setCurrentIndex(0);
        setAnswers({});
        setStartTime(null);
        setIsFinished(false);
        setResult(null);
    }, [stopExamRecording]);

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
            setCurrentIndex((prev) => prev + 1);
        }
    }, [currentIndex, questions.length]);

    const prevQuestion = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
        }
    }, [currentIndex]);

    const setAnswer = useCallback((questionId, answer) => {
        setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    }, []);

    const unansweredQuestions = questions.filter((q) => !answers[q.id]);
    const answeredCount = questions.length - unansweredQuestions.length;

    const goToFirstUnanswered = useCallback(() => {
        const idx = questions.findIndex((q) => !answers[q.id]);
        if (idx !== -1) setCurrentIndex(idx);
    }, [questions, answers]);

    const getTimeTaken = useCallback(() => {
        if (!startTime) return 0;
        return Math.floor((Date.now() - startTime) / 1000);
    }, [startTime]);

    const getCurrentSectionName = useCallback(() => {
        if (!currentQuestion || !sections.length) return '';
        const section = sections.find((s) => s._id === currentQuestion.sectionId);
        return section ? section.name : '';
    }, [currentQuestion, sections]);

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
            await stopExamRecording({ status: 'completed', upload: true });
            setIsFinished(true);
            setResult(res.data.result);
            return res.data.result;
        } catch (err) {
            console.error('Finish exam error:', err);
            throw err;
        }
    }, [exam, getTimeTaken, stopExamRecording]);

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
        recordingState,
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
        ensureExamRecording,
        stopExamRecording,
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

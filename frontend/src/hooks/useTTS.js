import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for Text-to-Speech using Web Speech API
 * Supports speak, pause, resume, adjustable rate/voice
 */
export function useTTS() {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [voices, setVoices] = useState([]);
    const [rate, setRate] = useState(1.1);
    const [selectedVoice, setSelectedVoice] = useState(null);
    const utteranceRef = useRef(null);

    // Load available voices
    useEffect(() => {
        const synth = window.speechSynthesis;

        const loadVoices = () => {
            const allVoices = synth.getVoices();
            const englishVoices = allVoices.filter(v => v.lang.startsWith('en'));
            setVoices(englishVoices);

            if (englishVoices.length > 0) {
                // Prefer female voices — look for common female voice names
                const femaleKeywords = ['female', 'zira', 'hazel', 'susan', 'jenny', 'aria', 'sara', 'libby', 'sonia', 'emma', 'amy', 'joanna', 'samantha', 'karen', 'moira', 'tessa', 'flo'];
                
                const femaleVoice = englishVoices.find(v => {
                    const name = v.name.toLowerCase();
                    return femaleKeywords.some(k => name.includes(k));
                });

                // Fallback: prefer Google/Microsoft Natural female voices
                const naturalFemale = englishVoices.find(v => {
                    const name = v.name.toLowerCase();
                    return (name.includes('google') || name.includes('natural')) && 
                           !name.includes('male') && !name.includes('guy') && !name.includes('david') && !name.includes('mark') && !name.includes('james') && !name.includes('ryan');
                });

                setSelectedVoice(femaleVoice || naturalFemale || englishVoices[0]);
            }
        };

        loadVoices();
        synth.onvoiceschanged = loadVoices;

        return () => {
            synth.cancel();
        };
    }, []);

    const speak = useCallback((text, options = {}) => {
        const synth = window.speechSynthesis;
        synth.cancel(); // Stop any current speech

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = options.rate || rate;
        utterance.pitch = options.pitch || 1.3;
        utterance.volume = options.volume || 1;

        if (options.voice || selectedVoice) {
            utterance.voice = options.voice || selectedVoice;
        }

        utterance.onstart = () => {
            setIsSpeaking(true);
            setIsPaused(false);
        };

        utterance.onend = () => {
            setIsSpeaking(false);
            setIsPaused(false);
            if (options.onEnd) options.onEnd();
        };

        utterance.onerror = () => {
            setIsSpeaking(false);
            setIsPaused(false);
        };

        utteranceRef.current = utterance;
        synth.speak(utterance);
    }, [rate, selectedVoice]);

    const pause = useCallback(() => {
        window.speechSynthesis.pause();
        setIsPaused(true);
    }, []);

    const resume = useCallback(() => {
        window.speechSynthesis.resume();
        setIsPaused(false);
    }, []);

    const stop = useCallback(() => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsPaused(false);
    }, []);

    const speakQuestion = useCallback((question) => {
        let text = question.questionText;
        if (question.options && question.options.length > 0) {
            text += '. Options: ';
            question.options.forEach((opt) => {
                text += `${opt.label}, ${opt.text}. `;
            });
        }
        speak(text);
    }, [speak]);

    return {
        speak,
        speakQuestion,
        pause,
        resume,
        stop,
        isSpeaking,
        isPaused,
        voices,
        rate,
        setRate,
        selectedVoice,
        setSelectedVoice
    };
}

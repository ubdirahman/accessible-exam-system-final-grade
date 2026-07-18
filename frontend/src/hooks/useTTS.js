import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for Text-to-Speech using Web Speech API
 * Supports speak, pause, resume, adjustable rate/voice
 */
export function useTTS() {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [voices, setVoices] = useState([]);
    const [rate, setRate] = useState(1.0);
    const [selectedVoice, setSelectedVoice] = useState(null);
    const utteranceRef = useRef(null);

    // Load available voices
    useEffect(() => {
        const synth = window.speechSynthesis;

        const loadVoices = () => {
            const allVoices = synth.getVoices();
            setVoices(allVoices);

            const englishVoices = allVoices.filter(v => v.lang.startsWith('en'));

            if (englishVoices.length > 0) {
                // Use a single MALE AI voice everywhere for consistency
                const maleKeywords = ['guy', 'ryan', 'david', 'mark', 'james', 'roger', 'christopher', 'eric', 'brian', 'andrew', 'male', 'man'];

                // 1st priority: High-quality natural/online male voices
                const highQualityMale = englishVoices.find(v => {
                    const name = v.name.toLowerCase();
                    const isNatural = name.includes('natural') || name.includes('google') || name.includes('online') || name.includes('neural');
                    const isMale = maleKeywords.some(k => name.includes(k));
                    return isNatural && isMale;
                });

                // 2nd priority: Any high-quality natural voice that is male
                const anyNaturalMale = englishVoices.find(v => {
                    const name = v.name.toLowerCase();
                    return (name.includes('natural') || name.includes('online') || name.includes('neural')) && maleKeywords.some(k => name.includes(k));
                });

                // 3rd priority: Offline male voices (David, Mark, etc.)
                const offlineMale = englishVoices.find(v => {
                    const name = v.name.toLowerCase();
                    return maleKeywords.some(k => name.includes(k));
                });

                // 4th priority: Any English voice with deeper pitch (we'll set pitch lower)
                setSelectedVoice(highQualityMale || anyNaturalMale || offlineMale || englishVoices[0]);
            }
        };

        loadVoices();
        synth.onvoiceschanged = loadVoices;

        return () => {
            synth.cancel();
        };
    }, []);

    const speak = useCallback((textInput, options = {}) => {
        const synth = window.speechSynthesis;
        synth.cancel(); // Stop any current speech

        const parts = Array.isArray(textInput)
            ? textInput
            : typeof textInput === 'string' && textInput.trim()
                ? [textInput]
                : [];

        if (parts.length === 0) return;

        let completedCount = 0;
        setIsSpeaking(true);
        setIsPaused(false);

        parts.forEach((partText, index) => {
            const utterance = new SpeechSynthesisUtterance(partText);
            utterance.rate = options.rate !== undefined ? options.rate : rate;
            const isSelectedMale = selectedVoice && ['guy', 'ryan', 'david', 'mark', 'james', 'roger', 'christopher', 'eric', 'brian', 'andrew', 'male', 'man'].some(k => selectedVoice.name.toLowerCase().includes(k));
            utterance.pitch = options.pitch !== undefined ? options.pitch : (isSelectedMale ? 1.0 : 0.8);
            utterance.volume = options.volume || 1;

            if (options.lang) {
                utterance.lang = options.lang;
                // Always use the same selected male voice for consistency
                // Try to find a male voice for the specific language first
                const maleKeywords = ['guy', 'ryan', 'david', 'mark', 'james', 'roger', 'christopher', 'eric', 'brian', 'andrew', 'male', 'man'];
                const langVoices = voices.filter(v => v.lang.startsWith(options.lang) || v.lang.startsWith(options.lang.split('-')[0]));
                const langMaleVoice = langVoices.find(v => {
                    const name = v.name.toLowerCase();
                    return maleKeywords.some(k => name.includes(k));
                });
                // Use language-specific male voice if available, otherwise use the default selected male voice
                const chosenVoice = langMaleVoice || selectedVoice;
                utterance.voice = chosenVoice;
                
                // If the chosen voice is not male, lower the pitch to make it sound male
                const isChosenMale = chosenVoice && maleKeywords.some(k => chosenVoice.name.toLowerCase().includes(k));
                if (!isChosenMale && options.pitch === undefined) {
                    utterance.pitch = 0.8;
                }
            } else if (options.voice || selectedVoice) {
                utterance.voice = options.voice || selectedVoice;
            }

            if (index === 0) {
                utterance.onstart = () => {
                    setIsSpeaking(true);
                    setIsPaused(false);
                };
            }

            utterance.onend = () => {
                completedCount++;
                if (completedCount === parts.length) {
                    setIsSpeaking(false);
                    setIsPaused(false);
                    if (options.onEnd) options.onEnd();
                }
            };

            utterance.onerror = () => {
                completedCount++;
                if (completedCount === parts.length) {
                    setIsSpeaking(false);
                    setIsPaused(false);
                    if (options.onEnd) options.onEnd();
                }
            };

            if (index === parts.length - 1) {
                utteranceRef.current = utterance;
            }

            synth.speak(utterance);
        });
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

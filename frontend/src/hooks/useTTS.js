import { useState, useCallback, useRef, useEffect } from 'react';
import { SOMALI_LANG, SOMALI_TTS_DEFAULTS } from '../utils/somaliSpeech';

const MALE_VOICE_KEYWORDS = ['guy', 'ryan', 'david', 'mark', 'james', 'roger', 'christopher', 'eric', 'brian', 'andrew', 'male', 'man'];
const NATURAL_VOICE_KEYWORDS = ['somali', 'natural', 'online', 'neural', 'google', 'microsoft', 'multilingual'];
const SOMALI_FALLBACK_LANGS = ['so', 'sw', 'ar'];

function startsWithLang(voiceLang = '', requestedLang = '') {
    const voice = voiceLang.toLowerCase();
    const requested = requestedLang.toLowerCase();
    const base = requested.split('-')[0];

    return voice === requested || voice.startsWith(`${base}-`) || voice.startsWith(base);
}

function isSomaliRequest(lang = '') {
    return lang.toLowerCase().startsWith(SOMALI_LANG.toLowerCase().split('-')[0]);
}

function voiceHasKeyword(voice, keywords) {
    const name = voice.name.toLowerCase();
    return keywords.some((keyword) => name.includes(keyword));
}

function findBestLanguageVoice(allVoices = [], requestedLang = '') {
    if (!requestedLang) return null;

    const exactLanguageVoices = allVoices.filter((voice) => startsWithLang(voice.lang, requestedLang));
    if (exactLanguageVoices.length) {
        return exactLanguageVoices.find((voice) => voiceHasKeyword(voice, NATURAL_VOICE_KEYWORDS))
            || exactLanguageVoices[0];
    }

    if (isSomaliRequest(requestedLang)) {
        const byName = allVoices.find((voice) => voiceHasKeyword(voice, ['somali', 'so-so']));
        if (byName) return byName;

        const regionalFallback = allVoices.find((voice) => (
            SOMALI_FALLBACK_LANGS.some((lang) => startsWithLang(voice.lang, lang))
            && voiceHasKeyword(voice, NATURAL_VOICE_KEYWORDS)
        ));
        if (regionalFallback) return regionalFallback;

        const multilingualVoice = allVoices.find((voice) => voiceHasKeyword(voice, ['multilingual', 'natural', 'neural', 'online']));
        if (multilingualVoice) return multilingualVoice;
    }

    return null;
}

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

            const somaliVoice = findBestLanguageVoice(allVoices, SOMALI_LANG);
            if (somaliVoice) {
                setSelectedVoice(somaliVoice);
                return;
            }

            const englishVoices = allVoices.filter(v => v.lang.startsWith('en'));

            if (englishVoices.length > 0) {
                // Use a single MALE AI voice everywhere for consistency

                // 1st priority: High-quality natural/online male voices
                const highQualityMale = englishVoices.find(v => {
                    const name = v.name.toLowerCase();
                    const isNatural = name.includes('natural') || name.includes('google') || name.includes('online') || name.includes('neural');
                    const isMale = MALE_VOICE_KEYWORDS.some(k => name.includes(k));
                    return isNatural && isMale;
                });

                // 2nd priority: Any high-quality natural voice that is male
                const anyNaturalMale = englishVoices.find(v => {
                    const name = v.name.toLowerCase();
                    return (name.includes('natural') || name.includes('online') || name.includes('neural')) && MALE_VOICE_KEYWORDS.some(k => name.includes(k));
                });

                // 3rd priority: Offline male voices (David, Mark, etc.)
                const offlineMale = englishVoices.find(v => {
                    const name = v.name.toLowerCase();
                    return MALE_VOICE_KEYWORDS.some(k => name.includes(k));
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

        const normalizePart = (part) => {
            if (typeof part === 'string') {
                return part.trim() ? { text: part, options: {} } : null;
            }

            if (part && typeof part === 'object') {
                const text = String(part.text || '').trim();
                if (!text) return null;
                return { text, options: part.options || {} };
            }

            return null;
        };

        const parts = (Array.isArray(textInput) ? textInput : [textInput])
            .map(normalizePart)
            .filter(Boolean);

        if (parts.length === 0) return;

        let completedCount = 0;
        setIsSpeaking(true);
        setIsPaused(false);

        parts.forEach((part, index) => {
            const partText = part.text;
            const speechOptions = { ...options, ...part.options };
            const utterance = new SpeechSynthesisUtterance(partText);
            const requestedLang = speechOptions.lang || '';
            const usesSomaliDefaults = isSomaliRequest(requestedLang);
            utterance.rate = speechOptions.rate !== undefined
                ? speechOptions.rate
                : usesSomaliDefaults
                    ? SOMALI_TTS_DEFAULTS.rate
                    : rate;
            const isSelectedMale = selectedVoice && MALE_VOICE_KEYWORDS.some(k => selectedVoice.name.toLowerCase().includes(k));
            utterance.pitch = speechOptions.pitch !== undefined ? speechOptions.pitch : (isSelectedMale ? 1.0 : 0.8);
            utterance.volume = speechOptions.volume || 1;

            if (speechOptions.lang) {
                utterance.lang = speechOptions.lang;
                const languageVoice = findBestLanguageVoice(voices, speechOptions.lang);
                const chosenVoice = speechOptions.voice || languageVoice || (usesSomaliDefaults ? null : selectedVoice);

                if (chosenVoice) {
                    utterance.voice = chosenVoice;

                    const isChosenMale = MALE_VOICE_KEYWORDS.some(k => chosenVoice.name.toLowerCase().includes(k));
                    if (!isChosenMale && speechOptions.pitch === undefined) {
                        utterance.pitch = usesSomaliDefaults ? SOMALI_TTS_DEFAULTS.pitch : 0.8;
                    }
                } else if (usesSomaliDefaults && speechOptions.pitch === undefined) {
                    utterance.pitch = SOMALI_TTS_DEFAULTS.pitch;
                }
            } else if (speechOptions.voice || selectedVoice) {
                utterance.voice = speechOptions.voice || selectedVoice;
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
    }, [rate, selectedVoice, voices]);
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
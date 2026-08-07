import { useState, useCallback, useRef, useEffect } from 'react';
import { SOMALI_LANG, SOMALI_TTS_DEFAULTS } from '../utils/somaliSpeech';

const MALE_VOICE_KEYWORDS = ['guy', 'ryan', 'david', 'mark', 'james', 'roger', 'christopher', 'eric', 'brian', 'andrew', 'male', 'man', 'george', 'stefan', 'richard', 'alex', 'fred'];
const FEMALE_VOICE_KEYWORDS = ['zira', 'hazel', 'susan', 'catherine', 'jenny', 'aria', 'female', 'woman', 'samantha', 'victoria', 'karen', 'fiona', 'monika', 'hedda', 'helena', 'linda', 'hoda'];
const NATURAL_VOICE_KEYWORDS = ['somali', 'natural', 'online', 'neural', 'google', 'microsoft', 'multilingual'];
const SOMALI_FALLBACK_LANGS = ['so', 'sw', 'ar'];

function isFemaleVoice(voice) {
    if (!voice || !voice.name) return false;
    const name = voice.name.toLowerCase();
    return FEMALE_VOICE_KEYWORDS.some((kw) => name.includes(kw));
}

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

function findBestMaleVoice(allVoices = [], requestedLang = 'en-US') {
    if (!allVoices || !allVoices.length) return null;

    const baseLang = (requestedLang || 'en').split('-')[0].toLowerCase();
    const langVoices = allVoices.filter(v => v.lang.toLowerCase().startsWith(baseLang));
    const pool = langVoices.length ? langVoices : allVoices.filter(v => v.lang.toLowerCase().startsWith('en'));
    const finalPool = pool.length ? pool : allVoices;

    // 1st Priority: Offline Local Male voice
    const localMale = finalPool.find(v => v.localService === true && !isFemaleVoice(v) && MALE_VOICE_KEYWORDS.some(k => v.name.toLowerCase().includes(k)));
    if (localMale) return localMale;

    // 2nd Priority: Explicit Male named voice that is NOT female
    const explicitMale = finalPool.find(v => !isFemaleVoice(v) && MALE_VOICE_KEYWORDS.some(k => v.name.toLowerCase().includes(k)));
    if (explicitMale) return explicitMale;

    // 3rd Priority: Any offline local voice
    const anyLocal = finalPool.find(v => v.localService === true && !isFemaleVoice(v));
    if (anyLocal) return anyLocal;

    // Fallback
    return finalPool[0] || null;
}

function findBestLanguageVoice(allVoices = [], requestedLang = '') {
    if (!requestedLang) return null;

    const exactLanguageVoices = allVoices.filter((voice) => startsWithLang(voice.lang, requestedLang));
    if (exactLanguageVoices.length) {
        const maleLanguageVoice = exactLanguageVoices.find((v) => !isFemaleVoice(v));
        if (maleLanguageVoice) return maleLanguageVoice;
        return exactLanguageVoices[0];
    }

    if (isSomaliRequest(requestedLang)) {
        const byName = allVoices.find((voice) => voiceHasKeyword(voice, ['somali', 'so-so']) && !isFemaleVoice(voice));
        if (byName) return byName;
    }

    return findBestMaleVoice(allVoices, requestedLang);
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

            const maleVoice = findBestMaleVoice(allVoices, 'en-US');
            if (maleVoice) {
                setSelectedVoice(maleVoice);
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
            const targetLang = speechOptions.lang || 'en-US';
            const maleVoice = speechOptions.voice || findBestMaleVoice(voices, targetLang) || selectedVoice;
            if (maleVoice) {
                utterance.voice = maleVoice;
            }
            utterance.lang = targetLang;
            utterance.pitch = speechOptions.pitch !== undefined ? speechOptions.pitch : 0.82;
            utterance.volume = speechOptions.volume || 1;

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
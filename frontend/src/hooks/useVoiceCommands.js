import { useState, useEffect, useCallback, useRef } from 'react';

function normalizeTranscript(value = '') {
    return String(value || '')
        .toLowerCase()
        .replace(/[']/g, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getResultAlternatives(result, maxAlternatives = 1) {
    const limit = Math.max(1, Math.min(Number(maxAlternatives) || 1, result.length || 1));
    const alternatives = [];

    for (let index = 0; index < limit; index++) {
        const transcript = result[index]?.transcript;
        if (transcript) alternatives.push(transcript);
    }

    return alternatives.length ? alternatives : [result[0]?.transcript || ''];
}

/**
 * Custom hook for Web Speech API voice recognition
 * Supports mapping spoken commands to callback functions
 */
export function useVoiceCommands(commandMap = {}, enabled = true, fallbackHandler = null, options = undefined) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [lastCommand, setLastCommand] = useState('');
    const recognitionRef = useRef(null);
    const commandMapRef = useRef(commandMap);
    const fallbackRef = useRef(fallbackHandler);
    const optionsRef = useRef(options || {});
    const lastExecutedRef = useRef(0);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsListening(false);
    }, []);

    const processCommand = useCallback((spoken, isFinal = true) => {
        const text = normalizeTranscript(spoken);
        setTranscript(text);

        if (!text) return false;

        const commands = commandMapRef.current || {};
        const isWaitingConfirmation = typeof commands.__isWaitingConfirmation__ === 'function'
            ? commands.__isWaitingConfirmation__()
            : false;

        const commandOptions = optionsRef.current || {};

        // Allow interim results to trigger confirmation immediately when waiting for Yes/No
        if (!isFinal && commandOptions.processInterimCommands !== true && !isWaitingConfirmation) {
            return false;
        }

        const checkConfirmation = () => {
            const yesPatterns = /(?:^|\b)(?:haa*|haah*|haye*h*|haya|hiya|yah|yea|yeah|yep|yup|yes|sure|confirm|do\s*it|okay|ok|o\.?k|diyaar|waan\s*diyaar\s*ahay|sax|saxan|waa\s*sax|sax\s*weeye|haa\s*sax|haa\s*waa\s*sax|geli|haa\s*geli|ingeli|hubaa|haa\s*hubaa)(?:$|\b)/i;
            const noPatterns = /(?:^|\b)(?:maya*|ma\s*ya|maaya*|mya*|mayya|mayo|mayoo|no|nah|nope|naah|cancel|stop|ha\s*bilaabin|ma\s*diyaar\s*ihi|ma\s*diyaar\s*ahi|nay|noo+|never|tirtir|iga\s*tirtir|ma\s*saxan|maaha|ma\s*ahan|maaha\s*sax)(?:$|\b)/i;
            if (noPatterns.test(text) && commands['no']) {
                setLastCommand('No');
                commands['no']();
                return true;
            }
            if (yesPatterns.test(text) && commands['yes']) {
                setLastCommand('Yes');
                commands['yes']();
                return true;
            }
            return false;
        };

        // 0. If actively waiting for confirmation modal/prompt, check Yes/No FIRST.
        if (isWaitingConfirmation) {
            if (checkConfirmation()) return true;
        }

        const allowFastOptionMatch = typeof commands.__shouldMatchOption__ === 'function'
            ? commands.__shouldMatchOption__(text)
            : true;

        if (isFinal && allowFastOptionMatch && commands['option']) {
            const words = text.toLowerCase().split(/\s+/);
            const aPatterns = /^(a|hey|ay|eight|8|eh|ate|eye|alpha|alif)$/i;
            const bPatterns = /^(b|be|bee|beat|busy|bravo|baa)$/i;
            const cPatterns = /^(c|see|sea|she|si|say|charlie|ceel)$/i;
            const dPatterns = /^(d|dee|the|day|do|d\.|delta|dowlad)$/i;

            const truePatterns = /\b(true|truth|tru|correct|right|is true|it is true|statement is true)\b/i;
            const falsePatterns = /\b(false|fals|falls|fault|incorrect|wrong|fake|not true|is false|it is false|statement is false)\b/i;

            let letter = null;

            if (truePatterns.test(text)) {
                letter = 'A';
            } else if (falsePatterns.test(text)) {
                letter = 'B';
            }

            if (!letter && words.length === 1) {
                const word = words[0];
                if (aPatterns.test(word)) letter = 'A';
                else if (bPatterns.test(word)) letter = 'B';
                else if (cPatterns.test(word)) letter = 'C';
                else if (dPatterns.test(word)) letter = 'D';
            }

            if (!letter) {
                const prefixMatch = text.match(/^(?:answer|option|choice|letter|select|choose|pick|dooro|jawaab)\s+([a-d])$/i);
                if (prefixMatch) {
                    letter = prefixMatch[1].toUpperCase();
                }
            }

            if (letter) {
                const handled = commands['option'](letter);
                if (handled !== false) {
                    setLastCommand(`Option ${letter}`);
                    return true;
                }
            }

            // Fallback: Pass spoken text to commands['option'] to match option answer content
            const handledByText = commands['option'](text);
            if (handledByText) {
                setLastCommand(`Option: ${text}`);
                return true;
            }
        }

        // Check confirmation after options if not already checked
        if (!isWaitingConfirmation) {
            if (checkConfirmation()) return true;
        }

        // 1. Data Extraction Patterns (Student ID, Exam Code)
        const idMatch = text.match(
            /(?:my\s+student\s+id|student\s+id|my\s+id|my\s+i\s*d|i\s*d|id|aqoonsi(?:ga(?:ygu|yga|ga)?)?|nambark(?:a|ayga|eyga|aygu|aaga)?(?:\s+ardayga)?|lambark(?:a|ayga|eyga|aygu|aaga)?(?:\s+ardayga)?|numberk(?:a|ayga|eyga|aygu|aaga)?)(?:\s+(?:is|waa|yahay))?\s+(.+)/i
        );
        if (idMatch) {
            const id = idMatch[1].trim();
            if (id && commands['set student id']) {
                commands['set student id'](id);
                setLastCommand(`ID: ${id.toUpperCase().replace(/\s+/g, '')}`);
                return true;
            }
        }

        if (text.includes('my exam code is') || text.includes('my code is')) {
            const parts = text.split(/is\s+/);
            const code = parts[parts.length - 1].trim().replace(/\s/g, '').toUpperCase();
            if (commands['set exam code']) {
                commands['set exam code'](code);
                setLastCommand(`Code: ${code}`);
                return true;
            }
        }

        // 2. Intent-Based Matching (Variations)
        for (const [pattern, handler] of Object.entries(commands)) {
            if (pattern.startsWith('__')) continue;
            const patternLower = normalizeTranscript(pattern);

            // Safety: Short commands (like 'a', 'no') must be exact matches to avoid false positives in longer sentences
            const isMatch = patternLower.length <= 2
                ? text === patternLower
                : text.includes(patternLower);

            if (isMatch) {
                setLastCommand(pattern);
                handler(text);
                return true;
            }
        }

        // 3. Fallback for Dictation
        // Fallback may return true (handled, ok to stop) or 'continue' (handled, keep listening)
        if (fallbackRef.current) {
            const fallbackResult = fallbackRef.current(text, isFinal);
            if (fallbackResult) return fallbackResult;
        }

        return false;
    }, []);

    const startListening = useCallback((languageOverride = '') => {
        if (!enabled) return;
        if (recognitionRef.current) return; // already listening
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech Recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        const recognitionOptions = optionsRef.current || {};
        recognition.continuous = recognitionOptions.continuous ?? true;
        recognition.interimResults = recognitionOptions.interimResults ?? true;
        recognition.maxAlternatives = recognitionOptions.maxAlternatives || 1;
        recognition.lang = languageOverride || recognitionOptions.lang || 'en-US';

        recognition.onresult = (event) => {
            const now = Date.now();
            // Reduced cooldown to 150ms to allow faster command chaining (e.g., "Yes... Next")
            if (now - lastExecutedRef.current < 150) return;

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const result = event.results[i];
                const alternatives = getResultAlternatives(result, recognition.maxAlternatives);
                let handled = false;

                for (const spoken of alternatives) {
                    if (result.isFinal) {
                        handled = processCommand(spoken, true);
                    } else {
                        handled = processCommand(spoken, false);
                    }

                    if (handled) {
                        lastExecutedRef.current = now;
                        // Only stop recognition on interim if the handler says so.
                        // Fallback handlers return 'continue' to keep listening
                        // (e.g. during student ID dictation).
                        if (!result.isFinal && handled !== 'continue') {
                            recognition.stop();
                        }
                        break;
                    }
                }
            }
        };

        recognition.onerror = (event) => {
            const fallbackLang = optionsRef.current?.fallbackLang;
            if (event.error === 'language-not-supported' && fallbackLang && recognition.lang !== fallbackLang) {
                recognition.onend = null;
                recognitionRef.current = null;
                setIsListening(false);
                try {
                    recognition.stop();
                } catch (error) {
                    // Ignore stop errors while switching language.
                }
                window.setTimeout(() => startListening(fallbackLang), 250);
                return;
            }

            if (event.error !== 'no-speech') {
                console.error('Speech recognition error:', event.error);
            }
        };

        recognition.onend = () => {
            // Auto-restart if still supposed to be listening
            if (recognitionRef.current === recognition) {
                try {
                    recognition.start();
                    setIsListening(true);
                } catch (e) {
                    window.setTimeout(() => {
                        if (recognitionRef.current === recognition) {
                            try {
                                recognition.start();
                                setIsListening(true);
                            } catch (error) {
                                // Browser may still be releasing the microphone.
                            }
                        }
                    }, 250);
                }
            }
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
            setIsListening(true);
        } catch (error) {
            console.error('Speech recognition start error:', error);
        }
    }, [enabled, processCommand]);

    // Keep refs current & restart recognition if language changes dynamically
    useEffect(() => {
        commandMapRef.current = commandMap;
        fallbackRef.current = fallbackHandler;

        const prevLang = optionsRef.current?.lang;
        optionsRef.current = options || {};

        if (enabled && recognitionRef.current && options?.lang && prevLang && prevLang !== options.lang) {
            stopListening();
            window.setTimeout(() => {
                if (enabled) {
                    startListening(options.lang);
                }
            }, 100);
        }
    }, [commandMap, fallbackHandler, options, enabled, stopListening, startListening]);

    const toggleListening = useCallback(() => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }, [isListening, startListening, stopListening]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.onend = null;
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!enabled) {
            stopListening();
        }
    }, [enabled, stopListening]);

    return {
        isListening,
        transcript,
        lastCommand,
        startListening,
        stopListening,
        toggleListening
    };
}

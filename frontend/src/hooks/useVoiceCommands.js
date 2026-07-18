import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for Web Speech API voice recognition
 * Supports mapping spoken commands to callback functions
 */
export function useVoiceCommands(commandMap = {}, enabled = true, fallbackHandler = null) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [lastCommand, setLastCommand] = useState('');
    const recognitionRef = useRef(null);
    const commandMapRef = useRef(commandMap);
    const fallbackRef = useRef(fallbackHandler);

    // Keep refs current
    useEffect(() => {
        commandMapRef.current = commandMap;
        fallbackRef.current = fallbackHandler;
    }, [commandMap, fallbackHandler]);

    const processCommand = useCallback((spoken, isFinal = true) => {
        const text = spoken.toLowerCase().trim();
        setTranscript(text);

        const commands = commandMapRef.current;

        // 0. Confirmations FIRST (English + Somali) — must come before MCQ matching
        //    so that "haa" is not caught as option "A"
        //    Chrome en-US transcribes Somali "haa" as: ha, huh, hot, heart, hard, hah, etc.
        //    Chrome en-US transcribes Somali "maya" as: my, maya, my a, mya, my yeah, etc.
        const yesPatterns = /\b(yes|yeah|yep|yah|yup|sure|confirm|do it|h[auh]+|okay|ok|o\.?k|ha+h?|huh|hot|heart|hard|high|hi|höö|höh)\b/i;
        const noPatterns = /\b(no|nah|nope|cancel|stop|maya+|ma\s*ya|mya+|nay|maaya+|mayya|na+h|noo+|never)\b/i;
        if (yesPatterns.test(text) && commands['yes']) {
            setLastCommand('Yes');
            commands['yes']();
            return true;
        }
        if (noPatterns.test(text) && commands['no']) {
            setLastCommand('No');
            commands['no']();
            return true;
        }

        const allowFastOptionMatch = typeof commands.__shouldMatchOption__ === 'function'
            ? commands.__shouldMatchOption__(text)
            : true;

        if (allowFastOptionMatch && commands['option']) {
            const words = text.toLowerCase().split(/\s+/);
            const aPatterns = /^(a|hey|ay|eight|8|eh|ate|eye)$/i;
            const bPatterns = /^(b|be|bee|beat|busy)$/i;
            const cPatterns = /^(c|see|sea|she|si|say)$/i;
            const dPatterns = /^(d|dee|the|day|do|d\.)$/i;

            let letter = null;
            if (words.length === 1) {
                const word = words[0];
                if (aPatterns.test(word)) letter = 'A';
                else if (bPatterns.test(word)) letter = 'B';
                else if (cPatterns.test(word)) letter = 'C';
                else if (dPatterns.test(word)) letter = 'D';
            }

            if (!letter) {
                const optionMatchFast = text.match(/\b([a-d])\b/);
                if (optionMatchFast) {
                    letter = optionMatchFast[1].toUpperCase();
                }
            }

            if (letter) {
                setLastCommand(`Option ${letter}`);
                commands['option'](letter);
                return true;
            }
        }

        // 1. Data Extraction Patterns (Student ID, Exam Code)
        if (
            text.includes('my id is') ||
            text.includes('student id is') ||
            text.includes('i d is') ||
            text.includes('id waa') ||
            text.includes('aqoonsi waa')
        ) {
            const idMatch = text.match(
                /(?:my\s+student\s+id|student\s+id|my\s+id|i\s*d|id|aqoonsi(?:ga(?:ygu)?)?)\s*(?:is|waa)\s+(.+)/
            );
            const id = idMatch ? idMatch[1].trim() : '';
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
            const patternLower = pattern.toLowerCase();

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
        if (fallbackRef.current) {
            const handled = fallbackRef.current(text, isFinal);
            if (handled) return true;
        }

        return false;
    }, []);

    const lastExecutedRef = useRef(0);

    const startListening = useCallback(() => {
        if (!enabled) return;
        if (recognitionRef.current) return; // already listening
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech Recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true; // Enabled for speed
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const now = Date.now();
            // Reduced cooldown to 150ms to allow faster command chaining (e.g., "Yes... Next")
            if (now - lastExecutedRef.current < 150) return;

            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const result = event.results[i];
                const spoken = result[0].transcript.toLowerCase().trim();

                if (result.isFinal) {
                    if (processCommand(spoken, true)) {
                        lastExecutedRef.current = now;
                    }
                } else {
                    // Run processCommand on interim. If it returns true, we treat it as a finalized command.
                    if (processCommand(spoken, false)) {
                        lastExecutedRef.current = now;
                        // Stop recognition momentarily to "clear" the buffer if we found a match
                        recognition.stop();
                    }
                }
            }
        };

        recognition.onerror = (event) => {
            if (event.error !== 'no-speech') {
                console.error('Speech recognition error:', event.error);
            }
        };

        recognition.onend = () => {
            // Auto-restart if still supposed to be listening
            if (recognitionRef.current) {
                try {
                    recognition.start();
                } catch (e) {
                    // Already started
                }
            }
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsListening(true);
    }, [enabled, processCommand]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsListening(false);
    }, []);

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

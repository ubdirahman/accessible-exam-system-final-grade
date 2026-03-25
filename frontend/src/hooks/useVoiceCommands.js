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

        // Fast MCQ letter capture even inside longer phrases ("answer is b", "waa c")
        const optionMatchFast = text.match(/\b([a-d])\b/);
        if (optionMatchFast && commands['option']) {
            const letter = optionMatchFast[1].toUpperCase();
            setLastCommand(`Option ${letter}`);
            commands['option'](letter);
            return true;
        }

        // 1. Data Extraction Patterns (Student ID, Exam Code)
        if (text.includes('my id is')) {
            const id = text.split('my id is')[1].trim().replace(/\s/g, '').toUpperCase();
            if (commands['set student id']) {
                commands['set student id'](id);
                setLastCommand(`ID: ${id}`);
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

        // 3. Confirmations (English + Somali)
        if ((text === 'yes' || text === 'confirm' || text === 'do it' || text === 'haa') && commands['yes']) {
            setLastCommand('Yes');
            commands['yes']();
            return true;
        }
        if ((text === 'no' || text === 'cancel' || text === 'stop' || text === 'maya') && commands['no']) {
            setLastCommand('No');
            commands['no']();
            return true;
        }

        // 4. Fallback for Dictation (Only on final results to avoid duplicates)
        if (isFinal && fallbackRef.current) {
            fallbackRef.current(text);
            return true;
        }

        return false;
    }, []);

    const lastExecutedRef = useRef(0);

    const startListening = useCallback(() => {
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
                    // Check for short, urgent commands in interim results (A, B, C, D, Next, Save)
                    if (spoken.length <= 15 && processCommand(spoken, false)) {
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
    }, [processCommand]);

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

    return {
        isListening,
        transcript,
        lastCommand,
        startListening,
        stopListening,
        toggleListening
    };
}

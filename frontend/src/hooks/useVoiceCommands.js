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

    const processCommand = useCallback((spoken) => {
        const text = spoken.toLowerCase().trim();
        setTranscript(text);

        const commands = commandMapRef.current;

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
            // Exact match or includes for natural variations
            if (text === patternLower || text.includes(patternLower)) {
                setLastCommand(pattern);
                handler(text);
                return true;
            }
        }

        // 3. Smart Option Selection: "Option A", "Choose B", "Answer C", or just "A"
        const optionMatch = text.match(/(?:option|choose|answer|select)?\s*([a-d])\b/i);
        if (optionMatch && commands['option']) {
            const letter = optionMatch[1].toUpperCase();
            setLastCommand(`Option ${letter}`);
            commands['option'](letter);
            return true;
        }

        // 4. Confirmations
        if ((text === 'yes' || text === 'confirm' || text === 'do it') && commands['yes']) {
            setLastCommand('Yes');
            commands['yes']();
            return true;
        }
        if ((text === 'no' || text === 'cancel' || text === 'stop') && commands['no']) {
            setLastCommand('No');
            commands['no']();
            return true;
        }

        // 5. Fallback for Dictation
        if (fallbackRef.current) {
            fallbackRef.current(text);
            return true;
        }

        return false;
    }, []);

    const lastExecutedRef = useRef(0);

    const startListening = useCallback(() => {
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
            // Reduced cooldown to 300ms to allow faster command chaining (e.g., "Yes... Next")
            if (now - lastExecutedRef.current < 300) return;

            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const result = event.results[i];
                const spoken = result[0].transcript.toLowerCase().trim();

                if (result.isFinal) {
                    if (processCommand(spoken)) {
                        lastExecutedRef.current = now;
                    }
                } else {
                    // Check for short, urgent commands in interim results (A, B, C, D, Next, Save)
                    if (spoken.length <= 15 && processCommand(spoken)) {
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

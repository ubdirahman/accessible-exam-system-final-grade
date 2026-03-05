import { useState, useEffect } from 'react';

export default function VoiceFeedback({ message, duration = 3000 }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (message) {
            setVisible(true);
            const timer = setTimeout(() => setVisible(false), duration);
            return () => clearTimeout(timer);
        }
    }, [message, duration]);

    if (!visible || !message) return null;

    return (
        <div className="voice-toast" role="alert" aria-live="assertive">
            <i className="fa-solid fa-microphone-lines" aria-hidden="true"></i> {message}
        </div>
    );
}

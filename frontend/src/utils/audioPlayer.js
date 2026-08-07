/**
 * Native Audio Player Utility for Student Voice Guidance
 * Handles playing pre-recorded human Somali audio prompts seamlessly,
 * falling back to TTS when needed, and supporting chained audio sequences.
 */

const AUDIO_PROMPTS = {
    PLEASE_ENTER_ID: '/assets/audio/waxad-joogtaa-page-loginka-fadlan-geli-idgaag.mp4',
    ARE_YOU_SURE_ID: '/assets/audio/mahubta-id-ah.mp4',
    YES_NO_CONFIRM: '/assets/audio/haa-maya.mp4',
    WELCOME: '/assets/audio/waxad-joogtaa-dashboardkaaga-sodhawow.mp4',
    START_EXAM_QUESTION: '/assets/audio/waxan-rabaa-inaa-kubiilaabo-examka.mp4'
};

let currentAudioInstance = null;

/**
 * Stop any currently playing pre-recorded audio file.
 */
export function stopSomaliAudio() {
    if (currentAudioInstance) {
        try {
            currentAudioInstance.pause();
            currentAudioInstance.currentTime = 0;
        } catch (e) {
            // ignore cleanup error
        }
        currentAudioInstance = null;
    }
}

/**
 * Play a pre-recorded Somali audio file by key or path.
 * Returns a Promise that resolves when the audio playback completes.
 */
export function playSomaliAudioFile(audioKeyOrPath, onEndCallback = null) {
    stopSomaliAudio();

    const path = AUDIO_PROMPTS[audioKeyOrPath] || audioKeyOrPath;
    if (!path) {
        if (onEndCallback) onEndCallback();
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        const audio = new Audio(path);
        currentAudioInstance = audio;

        const handleEnded = () => {
            currentAudioInstance = null;
            if (onEndCallback) onEndCallback();
            resolve();
        };

        const handleError = (err) => {
            console.warn('Audio playback error for path:', path, err);
            currentAudioInstance = null;
            if (onEndCallback) onEndCallback();
            resolve();
        };

        audio.addEventListener('ended', handleEnded, { once: true });
        audio.addEventListener('error', handleError, { once: true });

        audio.play().catch((err) => {
            console.warn('Audio play auto-play policy or error:', err);
            handleError(err);
        });
    });
}

/**
 * Checks if pre-recorded audio is currently playing.
 */
export function isSomaliAudioPlaying() {
    return !!currentAudioInstance && !currentAudioInstance.paused;
}

export { AUDIO_PROMPTS };

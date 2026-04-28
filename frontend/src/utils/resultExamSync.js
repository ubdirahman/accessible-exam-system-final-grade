export const RESULT_EXAM_SYNC_EVENT = 'result-exam-updated';
export const RESULT_EXAM_SYNC_STORAGE_KEY = 'result-exam-last-updated';
const RESULT_EXAM_SYNC_CHANNEL = 'result-exam-sync-channel';

export function broadcastResultExamSync(payload = {}) {
    const detail = {
        ...payload,
        at: Date.now()
    };

    try {
        localStorage.setItem(RESULT_EXAM_SYNC_STORAGE_KEY, JSON.stringify(detail));
    } catch (error) {
        console.warn('Failed to persist result exam sync event', error);
    }

    try {
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel(RESULT_EXAM_SYNC_CHANNEL);
            channel.postMessage(detail);
            channel.close();
        }
    } catch (error) {
        console.warn('Failed to broadcast result exam sync event', error);
    }

    window.dispatchEvent(new CustomEvent(RESULT_EXAM_SYNC_EVENT, { detail }));
}

export function subscribeResultExamSync(handler) {
    const wrappedHandler = (detail) => handler(detail);

    const handleWindowEvent = (event) => wrappedHandler(event.detail || {});
    const handleStorageEvent = (event) => {
        if (event.key !== RESULT_EXAM_SYNC_STORAGE_KEY) return;

        try {
            wrappedHandler(event.newValue ? JSON.parse(event.newValue) : {});
        } catch (_error) {
            wrappedHandler({});
        }
    };

    let channel = null;
    let handleChannelMessage = null;

    try {
        if (typeof BroadcastChannel !== 'undefined') {
            channel = new BroadcastChannel(RESULT_EXAM_SYNC_CHANNEL);
            handleChannelMessage = (event) => wrappedHandler(event.data || {});
            channel.addEventListener('message', handleChannelMessage);
        }
    } catch (error) {
        console.warn('Failed to subscribe to result exam channel', error);
    }

    window.addEventListener(RESULT_EXAM_SYNC_EVENT, handleWindowEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
        window.removeEventListener(RESULT_EXAM_SYNC_EVENT, handleWindowEvent);
        window.removeEventListener('storage', handleStorageEvent);

        if (channel && handleChannelMessage) {
            channel.removeEventListener('message', handleChannelMessage);
            channel.close();
        }
    };
}

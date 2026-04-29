const fs = require('fs');
const path = require('path');

const RECORDINGS_ROOT = path.join(__dirname, '..', 'uploads', 'recordings');

function ensureRecordingsDir() {
    fs.mkdirSync(RECORDINGS_ROOT, { recursive: true });
    return RECORDINGS_ROOT;
}

function buildRecordingAbsolutePath(relativePath = '') {
    if (!relativePath) return '';
    return path.join(__dirname, '..', relativePath);
}

function deleteRecordingFile(relativePath = '') {
    const absolutePath = buildRecordingAbsolutePath(relativePath);
    if (!absolutePath) return;

    try {
        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
        }
    } catch (error) {
        console.error('Failed to delete recording file:', absolutePath, error.message);
    }
}

function getExtensionFromMimeType(mimeType = '') {
    const normalized = String(mimeType || '').toLowerCase();
    if (normalized.includes('ogg')) return 'ogg';
    if (normalized.includes('mp4') || normalized.includes('m4a')) return 'm4a';
    if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
    if (normalized.includes('wav')) return 'wav';
    return 'webm';
}

module.exports = {
    RECORDINGS_ROOT,
    ensureRecordingsDir,
    buildRecordingAbsolutePath,
    deleteRecordingFile,
    getExtensionFromMimeType
};

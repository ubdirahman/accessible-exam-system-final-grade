import { useEffect } from 'react';

/**
 * ConfirmDialog — A beautiful, animated confirmation modal
 * Replaces window.confirm() across all admin pages
 *
 * Props:
 *   isOpen      — boolean: show/hide the dialog
 *   title       — string: dialog title
 *   message     — string: dialog body message
 *   confirmText — string: confirm button label (default: "Delete")
 *   cancelText  — string: cancel button label (default: "Cancel")
 *   onConfirm   — function: called when user clicks confirm
 *   onCancel    — function: called when user clicks cancel or backdrop
 *   type        — 'danger' | 'warning' | 'info' (default: 'danger')
 */
export default function ConfirmDialog({
    isOpen,
    title = 'Are you sure?',
    message = 'This action cannot be undone.',
    confirmText = 'Delete',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    type = 'danger'
}) {
    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') onCancel?.();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onCancel]);

    // Prevent body scroll while open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    const icons = {
        danger: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
            </svg>
        ),
        warning: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        ),
        info: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        )
    };

    const confirmBtnClass = type === 'danger' ? 'btn btn-danger' : type === 'warning' ? 'btn btn-warning' : 'btn btn-primary';

    return (
        <div
            className="confirm-dialog-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
        >
            <div className={`confirm-dialog confirm-dialog-${type}`}>
                {/* Icon */}
                <div className={`confirm-dialog-icon confirm-dialog-icon-${type}`}>
                    {icons[type]}
                </div>

                {/* Content */}
                <div className="confirm-dialog-content">
                    <h3 id="confirm-dialog-title" className="confirm-dialog-title">
                        {title}
                    </h3>
                    <p className="confirm-dialog-message">{message}</p>
                </div>

                {/* Actions */}
                <div className="confirm-dialog-actions">
                    <button
                        className="btn btn-ghost confirm-dialog-cancel"
                        onClick={onCancel}
                        autoFocus
                    >
                        {cancelText}
                    </button>
                    <button
                        className={`${confirmBtnClass} confirm-dialog-confirm`}
                        onClick={onConfirm}
                    >
                        {type === 'danger' && <i className="fa-solid fa-trash" style={{ marginRight: 6 }} />}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

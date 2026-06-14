import { useState, useCallback } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

/**
 * useConfirmDialog — Custom hook for easy ConfirmDialog usage
 *
 * Usage:
 *   const { confirmDialog, askConfirm } = useConfirmDialog();
 *
 *   // In JSX: render {confirmDialog}
 *   // To ask: const ok = await askConfirm({ title, message, confirmText, type })
 */
export default function useConfirmDialog() {
    const [dialogState, setDialogState] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger',
        resolve: null
    });

    const askConfirm = useCallback(({
        title = 'Are you sure?',
        message = 'This action cannot be undone.',
        confirmText = 'Delete',
        cancelText = 'Cancel',
        type = 'danger'
    } = {}) => {
        return new Promise((resolve) => {
            setDialogState({
                isOpen: true,
                title,
                message,
                confirmText,
                cancelText,
                type,
                resolve
            });
        });
    }, []);

    const handleConfirm = useCallback(() => {
        setDialogState(prev => {
            prev.resolve?.(true);
            return { ...prev, isOpen: false };
        });
    }, []);

    const handleCancel = useCallback(() => {
        setDialogState(prev => {
            prev.resolve?.(false);
            return { ...prev, isOpen: false };
        });
    }, []);

    const confirmDialog = (
        <ConfirmDialog
            isOpen={dialogState.isOpen}
            title={dialogState.title}
            message={dialogState.message}
            confirmText={dialogState.confirmText}
            cancelText={dialogState.cancelText}
            type={dialogState.type}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    );

    return { confirmDialog, askConfirm };
}

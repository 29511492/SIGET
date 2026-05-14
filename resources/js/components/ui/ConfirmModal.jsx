/**
 * Modal de confirmación reutilizable.
 * Usado por FamiliaList y HabitanteList para confirmar eliminaciones.
 *
 * USO:
 *   <ConfirmModal
 *     isOpen={!!itemToDelete}
 *     title="Dar de baja familia"
 *     message={`¿Dar de baja VIV-001?`}
 *     detail="Esta acción se puede revertir desde Auditoría."
 *     confirmLabel="Sí, dar de baja"
 *     variant="danger"
 *     onConfirm={handleConfirm}
 *     onCancel={() => setItemToDelete(null)}
 *     isLoading={deleting}
 *   />
 */

import { useEffect } from 'react';
import './ConfirmModal.css';

export default function ConfirmModal({
    isOpen,
    title       = '¿Confirmar acción?',
    message     = '¿Estás seguro?',
    detail      = '',
    confirmLabel = 'Confirmar',
    cancelLabel  = 'Cancelar',
    variant      = 'danger',   // 'danger' | 'warning'
    onConfirm,
    onCancel,
    isLoading    = false,
}) {
    // Bloquear scroll del body mientras el modal está abierto
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else        document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Cerrar con Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => { if (e.key === 'Escape' && !isLoading) onCancel(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, isLoading, onCancel]);

    if (!isOpen) return null;

    return (
        <div
            className="confirm-overlay"
            onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onCancel(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
        >
            <div className={`confirm-modal confirm-modal--${variant}`}>

                {/* Ícono */}
                <div className="confirm-modal__icon" aria-hidden="true">
                    {variant === 'danger' ? '🗑' : '⚠️'}
                </div>

                {/* Contenido */}
                <div className="confirm-modal__body">
                    <h3 id="confirm-title" className="confirm-modal__title">
                        {title}
                    </h3>
                    <p className="confirm-modal__message">{message}</p>
                    {detail && (
                        <p className="confirm-modal__detail">{detail}</p>
                    )}
                </div>

                {/* Acciones */}
                <div className="confirm-modal__actions">
                    <button
                        type="button"
                        className="confirm-btn confirm-btn--cancel"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`confirm-btn confirm-btn--${variant} ${isLoading ? 'confirm-btn--loading' : ''}`}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading
                            ? <><span className="confirm-btn__spinner" /> Procesando...</>
                            : confirmLabel
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * components/ui/FormModal.jsx
 *
 * Modal genérico para alojar formularios completos (a diferencia de
 * ConfirmModal, que es solo para confirmaciones cortas de una línea).
 * Se usa para que un formulario (ej. FamiliaForm) se abra como ventana
 * modal SIN cambiar la URL de la página que lo invoca.
 *
 * USO:
 *   <FormModal
 *     isOpen={showModal}
 *     title="Registrar Nueva Familia"
 *     onClose={() => setShowModal(false)}
 *   >
 *     <FamiliaForm onCancel={...} onSuccess={...} />
 *   </FormModal>
 */

import { useEffect } from 'react';
import './FormModal.css';

export default function FormModal({
    isOpen,
    title    = '',
    onClose,
    closable = true,   // false = sin botón X, sin Escape, sin click en overlay
    children,
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
        const handler = (e) => {
            if (e.key === 'Escape' && closable) onClose?.();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, closable, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="form-modal-overlay"
            onClick={(e) => { if (e.target === e.currentTarget && closable) onClose?.(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-modal-title"
        >
            <div className="form-modal-panel">

                <div className="form-modal-panel__header">
                    <h2 id="form-modal-title" className="form-modal-panel__title">
                        {title}
                    </h2>
                    {closable && (
                        <button
                            type="button"
                            className="form-modal-panel__close"
                            onClick={() => onClose?.()}
                            aria-label="Cerrar"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="form-modal-panel__body">
                    {children}
                </div>

            </div>
        </div>
    );
}

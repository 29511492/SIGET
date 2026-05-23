/**
 * PagoForm.jsx — Registro de Pago QR — SIGET
 * Ruta física: resources/js/pages/pagos/PagoForm.jsx
 *
 * Vista para el habitante: ve el QR de la comunidad, ingresa
 * su monto, referencia y sube la foto del comprobante.
 *
 * Registrar en app.jsx:
 *   import PagoForm from './pages/pagos/PagoForm';
 *
 *   // Todos los roles autenticados pueden registrar un pago
 *   <Route path="/pagos/nuevo" element={
 *       <ProtectedRoute>
 *           <PagoForm />
 *       </ProtectedRoute>
 *   } />
 */

import { useState, useRef }       from 'react';
import { useNavigate }            from 'react-router-dom';
import { useAuth }                from '../../hooks/useAuth';
import apiClient                  from '../../services/axios';
import './PagoQr.css';

// ── QR de la comunidad ─────────────────────────────────────────
// Para publicar el QR:
//   1. Coloca el archivo en: storage/app/public/qr/comunidad.png
//   2. Ejecuta: php artisan storage:link
// La URL pública resultante será /storage/qr/comunidad.png
const QR_COMUNIDAD_URL = '/storage/qr/comunidad.png';

const FORM_INICIAL = {
    referencia_bancaria: '',
    monto:               '',
    concepto_pago:       '',
    fecha_pago:          new Date().toISOString().slice(0, 10),
};

export default function PagoForm() {
    const navigate     = useNavigate();
    const { user }     = useAuth();

    // habitante_id viene del usuario autenticado (relación User→Habitante).
    // Si user.habitante_id es null el usuario no está vinculado a un habitante
    // y se mostrará un aviso en lugar del formulario.
    const habitanteId = user?.habitante_id ?? null;

    const [form,        setForm]        = useState(FORM_INICIAL);
    const [errors,      setErrors]      = useState({});
    const [saving,      setSaving]      = useState(false);
    const [comprobante, setComprobante] = useState(null);
    const [preview,     setPreview]     = useState(null);
    const [toast,       setToast]       = useState(null);
    const [qrError,     setQrError]     = useState(false);
    const [organizacionId, setOrganizacionId] = useState(''); // opcional
    const fileInputRef  = useRef(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    // ── Manejadores de campo ───────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validación de tipo y tamaño en el cliente
        const tiposValidos = ['image/jpeg', 'image/png', 'image/webp'];
        if (!tiposValidos.includes(file.type)) {
            setErrors(prev => ({ ...prev, comprobante: 'Solo se aceptan imágenes JPG, PNG o WEBP.' }));
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setErrors(prev => ({ ...prev, comprobante: 'La imagen no puede superar los 5 MB.' }));
            return;
        }

        setComprobante(file);
        setPreview(URL.createObjectURL(file));
        if (errors.comprobante) setErrors(prev => ({ ...prev, comprobante: '' }));
    };

    const quitarComprobante = () => {
        setComprobante(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const fieldErr = (name) => errors[name]?.[0] ?? errors[name] ?? '';

    // ── Envío ──────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validación mínima en cliente
        const clientErrors = {};
        if (!habitanteId)                          clientErrors.habitante_id = ['Tu usuario no está vinculado a un habitante. Contacta al administrador.'];
        if (!form.referencia_bancaria.trim())      clientErrors.referencia_bancaria = ['La referencia bancaria es obligatoria.'];
        if (!form.monto || Number(form.monto) <= 0) clientErrors.monto = ['El monto debe ser mayor a cero.'];
        if (!form.concepto_pago.trim())            clientErrors.concepto_pago = ['El concepto es obligatorio.'];
        if (!form.fecha_pago)                      clientErrors.fecha_pago = ['La fecha del pago es obligatoria.'];

        if (Object.keys(clientErrors).length) {
            setErrors(clientErrors);
            return;
        }

        setSaving(true);
        setErrors({});

        try {
            // ── Construir FormData ──────────────────────────────
            // REGLA CRÍTICA: nunca pongas Content-Type: multipart/form-data
            // manualmente. El browser/axios genera el boundary automáticamente.
            // Si lo fuerzas manualmente, el boundary queda vacío y el servidor
            // no puede parsear el body → error 422 aunque los datos sean correctos.
            const formData = new FormData();

            // Campo obligatorio — viene del usuario autenticado, no del form
            formData.append('habitante_id', habitanteId);

            // Campos del formulario — solo si tienen valor real
            formData.append('referencia_bancaria', form.referencia_bancaria.trim());
            formData.append('monto',               form.monto);
            formData.append('concepto_pago',       form.concepto_pago.trim());
            formData.append('fecha_pago',          form.fecha_pago);

            // Campos opcionales — enviar solo si tienen valor (no string vacío)
            // Enviar '' haría fallar la regla 'integer' en Laravel
            if (user?.familia_id)  formData.append('familia_id',      user.familia_id);
            if (organizacionId)    formData.append('organizacion_id', organizacionId);

            // Archivo del comprobante
            if (comprobante) formData.append('comprobante', comprobante);

            // Depuración — ver exactamente qué se envía antes del POST
            console.log('[PagoForm] FormData a enviar:');
            for (const [key, value] of formData.entries()) {
                console.log(`  ${key}:`, value instanceof File ? `[File: ${value.name}, ${value.size}b]` : value);
            }

            // SIN headers Content-Type — axios + browser gestionan el boundary
            await apiClient.post('/v1/pagos', formData);

            showToast('Pago registrado correctamente. Queda pendiente de verificación por el operador.');
            setTimeout(() => navigate('/dashboard'), 2000);

        } catch (err) {
            if (err.response?.status === 422) {
                // Mostrar errores de validación de Laravel campo por campo
                const serverErrors = err.response.data?.errors ?? {};
                console.error('[PagoForm] Errores 422 del servidor:', serverErrors);
                setErrors(serverErrors);
                // Si hay un error general (message) sin campos específicos
                if (!Object.keys(serverErrors).length && err.response.data?.message) {
                    showToast(err.response.data.message, 'error');
                }
            } else {
                showToast(err.response?.data?.message ?? 'Error al registrar el pago.', 'error');
                console.error('[PagoForm] Error inesperado:', err);
            }
        } finally {
            setSaving(false);
        }
    };

    // ── Guard: usuario no vinculado a habitante ────────────────
    // Si el usuario autenticado no tiene habitante_id, no puede
    // registrar un pago. El admin debe vincularlos en Usuarios.
    if (!habitanteId) {
        return (
            <div className="list-page">
                <header className="list-topbar">
                    <button className="list-topbar__back" onClick={() => navigate('/dashboard')} type="button">
                        ← Dashboard
                    </button>
                </header>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', padding: '2rem', fontFamily: 'DM Sans, sans-serif' }}>
                    <span style={{ fontSize: '3rem' }}>⚠️</span>
                    <p style={{ fontSize: '1rem', color: '#4a5568', textAlign: 'center', maxWidth: 420 }}>
                        Tu usuario no está vinculado a un habitante del censo.<br />
                        Contacta al administrador para que realice la vinculación.
                    </p>
                    <button
                        className="pago-btn pago-btn--secondary"
                        onClick={() => navigate('/dashboard')}
                        type="button"
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────
    //  RENDER PRINCIPAL
    // ─────────────────────────────────────────────────────────
    return (
        <div className="list-page">

            {toast && (
                <div className={`pago-toast pago-toast--${toast.type}`} role="alert">
                    {toast.type === 'success' ? '✓' : '⚠'} {toast.msg}
                </div>
            )}

            <header className="list-topbar">
                <button className="list-topbar__back" onClick={() => navigate('/dashboard')} type="button">
                    ← Dashboard
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Registrar Pago</span>
                </div>
            </header>

            <div className="pago-form-container">

                {/* ── Instrucciones + QR ────────────────────── */}
                <div className="pago-qr-card">
                    <div className="pago-qr-card__header">
                        <span className="pago-qr-card__icon">💳</span>
                        <div>
                            <h2 className="pago-qr-card__title">Pago QR Comunidad</h2>
                            <p className="pago-qr-card__sub">Escanea el código, realiza el pago y registra tu comprobante.</p>
                        </div>
                    </div>

                    <div className="pago-qr-image-wrap">
                        {!qrError ? (
                            <img
                                src={QR_COMUNIDAD_URL}
                                alt="Código QR de pago de la comunidad"
                                className="pago-qr-image"
                                onError={() => setQrError(true)}
                            />
                        ) : (
                            /* Fallback React — se renderiza cuando onError dispara setQrError(true) */
                            <div className="pago-qr-fallback">
                                <span>📱</span>
                                <p>QR pendiente de configuración</p>
                                <p className="pago-qr-fallback__sub">
                                    Coloca el archivo en:<br />
                                    <code>storage/app/public/qr/comunidad.png</code><br />
                                    y ejecuta <code>php artisan storage:link</code>
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="pago-steps">
                        <div className="pago-step"><span className="pago-step__num">1</span><span>Escanea el QR con tu banco</span></div>
                        <div className="pago-step"><span className="pago-step__num">2</span><span>Ingresa el monto y realiza el pago</span></div>
                        <div className="pago-step"><span className="pago-step__num">3</span><span>Completa el formulario y adjunta el comprobante</span></div>
                    </div>
                </div>

                {/* ── Formulario ────────────────────────────── */}
                <div className="pago-form-card">
                    <div className="pago-form-card__header">
                        <h2 className="pago-form-card__title">Datos del Comprobante</h2>
                        <p className="pago-form-card__sub">El operador verificará tu pago en las próximas horas.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="pago-form-body" noValidate>

                        {/* Error de habitante_id — se muestra si el backend lo rechaza */}
                        {fieldErr('habitante_id') && (
                            <div className="pago-field">
                                <span className="pago-campo__error">⚠ {fieldErr('habitante_id')}</span>
                            </div>
                        )}

                        {/* Referencia bancaria */}
                        <div className="pago-field">
                            <label className="pago-label" htmlFor="referencia_bancaria">
                                Referencia bancaria <span className="pago-required">*</span>
                            </label>
                            <input
                                id="referencia_bancaria"
                                name="referencia_bancaria"
                                type="text"
                                value={form.referencia_bancaria}
                                onChange={handleChange}
                                maxLength={100}
                                placeholder="Número de referencia de la transacción"
                                className={`pago-input ${fieldErr('referencia_bancaria') ? 'pago-input--error' : ''}`}
                                autoFocus
                            />
                            {fieldErr('referencia_bancaria') && <span className="pago-field__error">{fieldErr('referencia_bancaria')}</span>}
                        </div>

                        {/* Monto + Fecha en fila */}
                        <div className="pago-row">
                            <div className="pago-field">
                                <label className="pago-label" htmlFor="monto">
                                    Monto (Bs.) <span className="pago-required">*</span>
                                </label>
                                <input
                                    id="monto"
                                    name="monto"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={form.monto}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                    className={`pago-input ${fieldErr('monto') ? 'pago-input--error' : ''}`}
                                />
                                {fieldErr('monto') && <span className="pago-field__error">{fieldErr('monto')}</span>}
                            </div>

                            <div className="pago-field">
                                <label className="pago-label" htmlFor="fecha_pago">
                                    Fecha del pago <span className="pago-required">*</span>
                                </label>
                                <input
                                    id="fecha_pago"
                                    name="fecha_pago"
                                    type="date"
                                    value={form.fecha_pago}
                                    onChange={handleChange}
                                    max={new Date().toISOString().slice(0, 10)}
                                    className={`pago-input ${fieldErr('fecha_pago') ? 'pago-input--error' : ''}`}
                                />
                                {fieldErr('fecha_pago') && <span className="pago-field__error">{fieldErr('fecha_pago')}</span>}
                            </div>
                        </div>

                        {/* Concepto */}
                        <div className="pago-field">
                            <label className="pago-label" htmlFor="concepto_pago">
                                Concepto <span className="pago-required">*</span>
                            </label>
                            <input
                                id="concepto_pago"
                                name="concepto_pago"
                                type="text"
                                value={form.concepto_pago}
                                onChange={handleChange}
                                maxLength={200}
                                placeholder="Ej. Pago mensual de gas, Cuota de servicios..."
                                className={`pago-input ${fieldErr('concepto_pago') ? 'pago-input--error' : ''}`}
                            />
                            {fieldErr('concepto_pago') && <span className="pago-field__error">{fieldErr('concepto_pago')}</span>}
                        </div>

                        {/* Subida de comprobante */}
                        <div className="pago-field">
                            <label className="pago-label">Foto del comprobante</label>

                            {!preview ? (
                                <label className="pago-upload-area" htmlFor="comprobante_file">
                                    <input
                                        id="comprobante_file"
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleFile}
                                        className="pago-upload-input"
                                    />
                                    <span className="pago-upload-icon">📷</span>
                                    <span className="pago-upload-label">Toca para seleccionar imagen</span>
                                    <span className="pago-upload-hint">JPG, PNG o WEBP · máx. 5 MB</span>
                                </label>
                            ) : (
                                <div className="pago-preview-wrap">
                                    <img src={preview} alt="Vista previa del comprobante" className="pago-preview-img" />
                                    <button
                                        type="button"
                                        className="pago-preview-remove"
                                        onClick={quitarComprobante}
                                        title="Quitar imagen"
                                    >
                                        ✕ Quitar
                                    </button>
                                </div>
                            )}
                            {fieldErr('comprobante') && <span className="pago-field__error">{fieldErr('comprobante')}</span>}
                        </div>

                        {/* Acciones */}
                        <div className="pago-form-actions">
                            <button
                                type="button"
                                className="pago-btn pago-btn--secondary"
                                onClick={() => navigate('/dashboard')}
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="pago-btn pago-btn--verificar"
                                disabled={saving}
                            >
                                {saving
                                    ? <><span className="pago-btn-spinner" /> Enviando...</>
                                    : '📤 Registrar pago'
                                }
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}

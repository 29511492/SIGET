/**
 * resources/js/components/pagos/PagoQrWidget.jsx
 *
 * Widget de pagos para el Portal Ciudadano (rol usuario).
 * Muestra el QR fijo con los datos bancarios del Consejo Comunal,
 * permite copiar los datos, subir el comprobante de un pago realizado,
 * y consultar el historial propio con su estado de verificación.
 *
 * Consume:
 *   POST /api/v1/pagos/mio  → registrar pago con comprobante
 *   GET  /api/v1/pagos/mis  → ver los propios
 *
 * El QR se genera en el cliente con la librería 'qrcode' (ligera,
 * sin dependencias de servidor) a partir de los DATOS_BANCARIOS de
 * ejemplo definidos abajo. Cuando Enriquito tenga los datos reales
 * del Consejo Comunal, solo debe editar ese objeto.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode      from 'qrcode';
import apiClient   from '../../services/axios';
import './PagoQrWidget.css';

// ── Datos bancarios de ejemplo — EDITAR con los datos reales ──────
// Formato típico de Pago Móvil venezolano.
const DATOS_BANCARIOS = {
    banco:    'Banco de Venezuela (0102)',
    telefono: '0412-1234567',
    cedula:   'V-12345678',
    titular:  'Consejo Comunal Ana Karina Rote 2019',
};

// Texto que se codifica en el QR — el usuario lo escanea con su app
// bancaria o lo usa como referencia visual de los datos.
const TEXTO_QR =
    `Pago Móvil\n` +
    `Banco: ${DATOS_BANCARIOS.banco}\n` +
    `Teléfono: ${DATOS_BANCARIOS.telefono}\n` +
    `Cédula/RIF: ${DATOS_BANCARIOS.cedula}\n` +
    `Titular: ${DATOS_BANCARIOS.titular}`;

const FORM_INICIAL = {
    referencia_bancaria: '',
    monto: '',
    concepto_pago: '',
    fecha_pago: new Date().toISOString().slice(0, 10),
};

const ESTADO_CONFIG = {
    pendiente:  { label: '⏳ Pendiente',  cls: 'pqw-estado--pendiente'  },
    verificado: { label: '✓ Verificado',  cls: 'pqw-estado--verificado' },
    rechazado:  { label: '✗ Rechazado',   cls: 'pqw-estado--rechazado'  },
};

export default function PagoQrWidget() {
    const canvasRef = useRef(null);

    // ── Estado del formulario ──────────────────────────────────
    const [form,         setForm]         = useState(FORM_INICIAL);
    const [comprobante,  setComprobante]  = useState(null);
    const [previewUrl,   setPreviewUrl]   = useState('');
    const [errors,       setErrors]       = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg,   setSuccessMsg]   = useState('');
    const [serverError,  setServerError]  = useState('');

    // ── Estado historial ───────────────────────────────────────
    const [historial,    setHistorial]    = useState([]);
    const [loadingHist,  setLoadingHist]  = useState(true);
    const [verHistorial, setVerHistorial] = useState(false);
    const [copiado,      setCopiado]      = useState('');

    // ── Generar el QR en el canvas ──────────────────────────────
    useEffect(() => {
        if (canvasRef.current) {
            QRCode.toCanvas(canvasRef.current, TEXTO_QR, {
                width: 180,
                margin: 1,
                color: { dark: '#0d1f35', light: '#ffffff' },
            }).catch(() => {});
        }
    }, []);

    // ── Cargar historial propio ────────────────────────────────
    const cargarHistorial = useCallback(() => {
        setLoadingHist(true);
        apiClient.get('/v1/pagos/mis')
            .then(({ data }) => setHistorial(data.data))
            .catch(() => {})
            .finally(() => setLoadingHist(false));
    }, []);

    useEffect(() => {
        cargarHistorial();
    }, [cargarHistorial]);

    const toggleHistorial = () => {
        const abriendo = !verHistorial;
        setVerHistorial(abriendo);
        if (abriendo) cargarHistorial();
    };

    // ── Copiar datos bancarios al portapapeles ─────────────────
    const copiarDato = (texto, campo) => {
        navigator.clipboard.writeText(texto).then(() => {
            setCopiado(campo);
            setTimeout(() => setCopiado(''), 1500);
        });
    };

    // ── Handlers de formulario ─────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (errors[name])  setErrors(prev => ({ ...prev, [name]: '' }));
        if (serverError)   setServerError('');
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setErrors(prev => ({ ...prev, comprobante: 'El archivo no puede superar los 5 MB.' }));
            return;
        }

        setComprobante(file);
        setPreviewUrl(URL.createObjectURL(file));
        if (errors.comprobante) setErrors(prev => ({ ...prev, comprobante: '' }));
    };

    const validate = () => {
        const next = {};
        if (!form.referencia_bancaria.trim()) next.referencia_bancaria = 'La referencia es obligatoria.';
        if (!form.monto || Number(form.monto) <= 0) next.monto = 'Indica un monto válido.';
        if (!form.concepto_pago.trim()) next.concepto_pago = 'El concepto es obligatorio.';
        if (!comprobante) next.comprobante = 'Debes adjuntar el comprobante de pago.';
        return next;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSuccessMsg('');
        setServerError('');

        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('referencia_bancaria', form.referencia_bancaria);
            formData.append('monto', form.monto);
            formData.append('concepto_pago', form.concepto_pago);
            formData.append('fecha_pago', form.fecha_pago);
            formData.append('comprobante', comprobante);

            await apiClient.post('/v1/pagos/mio', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setSuccessMsg('¡Comprobante enviado! El Consejo Comunal verificará tu pago pronto.');
            setForm(FORM_INICIAL);
            setComprobante(null);
            setPreviewUrl('');
            cargarHistorial();
            setVerHistorial(true);
        } catch (err) {
            const { status, data } = err.response ?? {};
            if (status === 422) {
                setErrors({
                    referencia_bancaria: data.errors?.referencia_bancaria?.[0] ?? '',
                    monto:               data.errors?.monto?.[0] ?? '',
                    concepto_pago:       data.errors?.concepto_pago?.[0] ?? '',
                    comprobante:         data.errors?.comprobante?.[0] ?? '',
                });
            } else {
                setServerError('No se pudo registrar el pago. Intenta de nuevo.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────
    const pendientes = historial.filter(p => p.estado === 'pendiente').length;

    return (
        <section className="pqw-section" aria-label="Pagos QR">

            {/* Encabezado */}
            <div className="pqw-header">
                <div className="pqw-header__left">
                    <h2 className="pqw-header__title">
                        <span aria-hidden="true">📱</span>
                        Pagos QR
                    </h2>
                    <p className="pqw-header__subtitle">
                        Escanea el código, realiza tu pago y sube el comprobante
                    </p>
                </div>
                {historial.length > 0 && (
                    <button className="pqw-header__toggle" onClick={toggleHistorial}>
                        {verHistorial ? 'Ocultar historial' : `Mis pagos (${historial.length})`}
                        {pendientes > 0 && (
                            <span className="pqw-badge pqw-badge--pendiente">{pendientes}</span>
                        )}
                    </button>
                )}
            </div>

            {/* Tarjeta QR + datos bancarios */}
            <div className="pqw-qr-card">
                <div className="pqw-qr-card__qr">
                    <canvas ref={canvasRef} />
                </div>
                <div className="pqw-qr-card__datos">
                    <p className="pqw-qr-card__titulo">Datos para Pago Móvil</p>
                    <dl className="pqw-datos-list">
                        <div className="pqw-datos-list__row">
                            <dt>Banco</dt>
                            <dd>
                                <button
                                    className="pqw-copy-btn"
                                    onClick={() => copiarDato(DATOS_BANCARIOS.banco, 'banco')}
                                >
                                    {DATOS_BANCARIOS.banco}
                                    <span className="pqw-copy-btn__icon">
                                        {copiado === 'banco' ? '✓' : '📋'}
                                    </span>
                                </button>
                            </dd>
                        </div>
                        <div className="pqw-datos-list__row">
                            <dt>Teléfono</dt>
                            <dd>
                                <button
                                    className="pqw-copy-btn"
                                    onClick={() => copiarDato(DATOS_BANCARIOS.telefono, 'telefono')}
                                >
                                    {DATOS_BANCARIOS.telefono}
                                    <span className="pqw-copy-btn__icon">
                                        {copiado === 'telefono' ? '✓' : '📋'}
                                    </span>
                                </button>
                            </dd>
                        </div>
                        <div className="pqw-datos-list__row">
                            <dt>Cédula/RIF</dt>
                            <dd>
                                <button
                                    className="pqw-copy-btn"
                                    onClick={() => copiarDato(DATOS_BANCARIOS.cedula, 'cedula')}
                                >
                                    {DATOS_BANCARIOS.cedula}
                                    <span className="pqw-copy-btn__icon">
                                        {copiado === 'cedula' ? '✓' : '📋'}
                                    </span>
                                </button>
                            </dd>
                        </div>
                        <div className="pqw-datos-list__row">
                            <dt>Titular</dt>
                            <dd className="pqw-datos-list__titular">{DATOS_BANCARIOS.titular}</dd>
                        </div>
                    </dl>
                </div>
            </div>

            {/* Formulario de comprobante */}
            <div className="pqw-form-card">
                <p className="pqw-form-card__titulo">Sube tu comprobante de pago</p>

                {successMsg && (
                    <div className="pqw-alert pqw-alert--success" role="status">
                        <span aria-hidden="true">✅</span>
                        <span>{successMsg}</span>
                    </div>
                )}
                {serverError && (
                    <div className="pqw-alert pqw-alert--error" role="alert">
                        <span aria-hidden="true">⚠</span>
                        <span>{serverError}</span>
                    </div>
                )}

                <form className="pqw-form" onSubmit={handleSubmit} noValidate>
                    <div className="pqw-form__row">
                        <div className={`pqw-field ${errors.referencia_bancaria ? 'pqw-field--error' : ''}`}>
                            <label htmlFor="pqw-referencia" className="pqw-field__label">
                                Número de referencia
                            </label>
                            <input
                                id="pqw-referencia"
                                name="referencia_bancaria"
                                type="text"
                                className="pqw-field__input"
                                placeholder="Ej: 001234567890"
                                value={form.referencia_bancaria}
                                onChange={handleChange}
                                disabled={isSubmitting}
                            />
                            {errors.referencia_bancaria && (
                                <span className="pqw-field__error">{errors.referencia_bancaria}</span>
                            )}
                        </div>

                        <div className={`pqw-field ${errors.monto ? 'pqw-field--error' : ''}`}>
                            <label htmlFor="pqw-monto" className="pqw-field__label">
                                Monto (Bs.)
                            </label>
                            <input
                                id="pqw-monto"
                                name="monto"
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="pqw-field__input"
                                placeholder="0.00"
                                value={form.monto}
                                onChange={handleChange}
                                disabled={isSubmitting}
                            />
                            {errors.monto && (
                                <span className="pqw-field__error">{errors.monto}</span>
                            )}
                        </div>
                    </div>

                    <div className="pqw-form__row">
                        <div className={`pqw-field ${errors.concepto_pago ? 'pqw-field--error' : ''}`}>
                            <label htmlFor="pqw-concepto" className="pqw-field__label">
                                Concepto
                            </label>
                            <input
                                id="pqw-concepto"
                                name="concepto_pago"
                                type="text"
                                className="pqw-field__input"
                                placeholder="Ej: Cuota mensual de mantenimiento"
                                value={form.concepto_pago}
                                onChange={handleChange}
                                disabled={isSubmitting}
                            />
                            {errors.concepto_pago && (
                                <span className="pqw-field__error">{errors.concepto_pago}</span>
                            )}
                        </div>

                        <div className="pqw-field">
                            <label htmlFor="pqw-fecha" className="pqw-field__label">
                                Fecha del pago
                            </label>
                            <input
                                id="pqw-fecha"
                                name="fecha_pago"
                                type="date"
                                className="pqw-field__input"
                                max={new Date().toISOString().slice(0, 10)}
                                value={form.fecha_pago}
                                onChange={handleChange}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Subida de comprobante */}
                    <div className={`pqw-field ${errors.comprobante ? 'pqw-field--error' : ''}`}>
                        <label htmlFor="pqw-comprobante" className="pqw-field__label">
                            Comprobante de pago (imagen)
                        </label>
                        <label htmlFor="pqw-comprobante" className="pqw-upload">
                            {previewUrl ? (
                                <img src={previewUrl} alt="Vista previa del comprobante" className="pqw-upload__preview" />
                            ) : (
                                <>
                                    <span className="pqw-upload__icon" aria-hidden="true">📷</span>
                                    <span className="pqw-upload__text">
                                        Toca para subir una foto o captura del comprobante
                                    </span>
                                </>
                            )}
                        </label>
                        <input
                            id="pqw-comprobante"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleFileChange}
                            disabled={isSubmitting}
                            className="pqw-upload__input"
                        />
                        {errors.comprobante && (
                            <span className="pqw-field__error">{errors.comprobante}</span>
                        )}
                    </div>

                    <button
                        type="submit"
                        className={`pqw-submit ${isSubmitting ? 'pqw-submit--loading' : ''}`}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="pqw-submit__spinner" aria-hidden="true" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <span aria-hidden="true">📤</span>
                                Enviar Comprobante
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Historial */}
            {verHistorial && (
                <div className="pqw-historial">
                    <div className="pqw-historial__header">
                        <h3 className="pqw-historial__titulo">Mis pagos enviados</h3>
                        <button
                            className="pqw-historial__refresh"
                            onClick={cargarHistorial}
                            disabled={loadingHist}
                            title="Actualizar historial"
                        >
                            {loadingHist ? '⏳' : '🔄'}
                        </button>
                    </div>

                    {loadingHist ? (
                        <div className="pqw-historial__loading">
                            <div className="pqw-spinner" />
                        </div>
                    ) : historial.length === 0 ? (
                        <p className="pqw-historial__vacio">Aún no has registrado ningún pago.</p>
                    ) : (
                        <div className="pqw-historial__lista">
                            {historial.map(pago => {
                                const estado = ESTADO_CONFIG[pago.estado] ?? ESTADO_CONFIG.pendiente;
                                return (
                                    <article key={pago.id} className="pqw-item">
                                        <div className="pqw-item__header">
                                            <span className="pqw-item__concepto">{pago.concepto_pago}</span>
                                            <span className={`pqw-estado ${estado.cls}`}>{estado.label}</span>
                                        </div>
                                        <div className="pqw-item__detalles">
                                            <span>Ref: {pago.referencia_bancaria}</span>
                                            <span>Bs. {pago.monto}</span>
                                            <span>{pago.fecha_pago}</span>
                                        </div>
                                        {pago.estado === 'rechazado' && pago.motivo_rechazo && (
                                            <p className="pqw-item__motivo">
                                                ⚠ Motivo: {pago.motivo_rechazo}
                                            </p>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

        </section>
    );
}

/**
 * resources/js/components/pagos/PagoQrWidget.jsx
 *
 * Widget de pagos para el Portal Ciudadano (rol usuario).
 *
 * FIX (Fase 3 — junio 2026): Antes los datos bancarios (banco,
 * teléfono, cédula, titular) estaban hardcodeados en una constante
 * DATOS_BANCARIOS fija en este mismo archivo — solo existía UNA
 * cuenta posible y el admin no podía editarla desde el sistema.
 *
 * Ahora el widget consume GET /v1/cuentas-pago (Capa 1, todos los
 * roles) para listar las cuentas ACTIVAS gestionadas por el admin/
 * operador desde el panel /cuentas-pago. El usuario debe elegir una
 * cuenta antes de ver su QR específico y antes de poder enviar el
 * comprobante — la elección es OBLIGATORIA (cuenta_pago_id required
 * en el backend).
 *
 * El QR se regenera dinámicamente cada vez que cambia la cuenta
 * seleccionada, codificando los datos bancarios de ESA cuenta.
 *
 * Consume:
 *   GET  /api/v1/cuentas-pago     → listar cuentas activas
 *   POST /api/v1/pagos/mio        → registrar pago con comprobante
 *   GET  /api/v1/pagos/mis        → ver los propios
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode      from 'qrcode';
import apiClient   from '../../services/axios';
import './PagoQrWidget.css';

const FORM_INICIAL = {
    cuenta_pago_id: '',
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

    // ── Estado de cuentas de pago ───────────────────────────────
    const [cuentas,        setCuentas]        = useState([]);
    const [loadingCuentas, setLoadingCuentas] = useState(true);
    const [errorCuentas,   setErrorCuentas]   = useState('');

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

    // ── Cuenta actualmente seleccionada (objeto completo) ───────
    const cuentaSeleccionada = cuentas.find(
        c => String(c.id) === String(form.cuenta_pago_id)
    ) ?? null;

    // ── Cargar cuentas de pago activas ──────────────────────────
    const cargarCuentas = useCallback(() => {
        setLoadingCuentas(true);
        setErrorCuentas('');
        apiClient.get('/v1/cuentas-pago')
            .then(({ data }) => {
                const lista = Array.isArray(data.data) ? data.data : [];
                setCuentas(lista);
                // Si solo hay una cuenta activa, la preseleccionamos
                // para ahorrarle un paso al usuario.
                if (lista.length === 1) {
                    setForm(prev => ({ ...prev, cuenta_pago_id: String(lista[0].id) }));
                }
            })
            .catch(() => setErrorCuentas('No se pudieron cargar las cuentas de pago disponibles.'))
            .finally(() => setLoadingCuentas(false));
    }, []);

    useEffect(() => {
        cargarCuentas();
    }, [cargarCuentas]);

    // ── Generar el QR cada vez que cambia la cuenta elegida ─────
    useEffect(() => {
        if (!canvasRef.current || !cuentaSeleccionada) return;

        const textoQr =
            `Pago Móvil\n` +
            `Servicio: ${cuentaSeleccionada.nombre_servicio}\n` +
            `Banco: ${cuentaSeleccionada.banco}\n` +
            `Teléfono: ${cuentaSeleccionada.telefono}\n` +
            `Cédula/RIF: ${cuentaSeleccionada.cedula_rif}\n` +
            `Titular: ${cuentaSeleccionada.titular}`;

        QRCode.toCanvas(canvasRef.current, textoQr, {
            width: 180,
            margin: 1,
            color: { dark: '#0d1f35', light: '#ffffff' },
        }).catch(() => {});
    }, [cuentaSeleccionada]);

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

    // Al elegir una cuenta, sugerimos el concepto automáticamente
    // (el usuario puede seguir editándolo si quiere ser más específico).
    const handleCuentaChange = (e) => {
        const id = e.target.value;
        const cuenta = cuentas.find(c => String(c.id) === String(id));
        setForm(prev => ({
            ...prev,
            cuenta_pago_id: id,
            concepto_pago: prev.concepto_pago || (cuenta ? `Pago de ${cuenta.nombre_servicio}` : ''),
        }));
        if (errors.cuenta_pago_id) setErrors(prev => ({ ...prev, cuenta_pago_id: '' }));
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
        if (!form.cuenta_pago_id) next.cuenta_pago_id = 'Debes seleccionar a qué servicio corresponde tu pago.';
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
            formData.append('cuenta_pago_id', form.cuenta_pago_id);
            formData.append('referencia_bancaria', form.referencia_bancaria);
            formData.append('monto', form.monto);
            formData.append('concepto_pago', form.concepto_pago);
            formData.append('fecha_pago', form.fecha_pago);
            formData.append('comprobante', comprobante);

            await apiClient.post('/v1/pagos/mio', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setSuccessMsg('¡Comprobante enviado! El Consejo Comunal verificará tu pago pronto.');
            // Conservamos la cuenta elegida tras limpiar, para que el
            // usuario pueda registrar otro pago del mismo servicio
            // sin tener que volver a elegirla.
            setForm(prev => ({ ...FORM_INICIAL, cuenta_pago_id: prev.cuenta_pago_id }));
            setComprobante(null);
            setPreviewUrl('');
            cargarHistorial();
            setVerHistorial(true);
        } catch (err) {
            const { status, data } = err.response ?? {};
            if (status === 422) {
                setErrors({
                    cuenta_pago_id:      data.errors?.cuenta_pago_id?.[0] ?? '',
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
                        Elige el servicio, escanea el código y sube tu comprobante
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

            {/* Error al cargar cuentas */}
            {errorCuentas && (
                <div className="pqw-alert pqw-alert--error" role="alert">
                    <span aria-hidden="true">⚠</span>
                    <span>{errorCuentas}</span>
                </div>
            )}

            {/* Sin cuentas activas — el admin aún no configuró ninguna */}
            {!loadingCuentas && !errorCuentas && cuentas.length === 0 && (
                <div className="pqw-alert pqw-alert--info" role="status">
                    <span aria-hidden="true">ℹ️</span>
                    <span>
                        Aún no hay cuentas de pago configuradas por el Consejo Comunal.
                        Intenta más tarde.
                    </span>
                </div>
            )}

            {/* ── Selector de servicio + Tarjeta QR ───────────── */}
            {!loadingCuentas && cuentas.length > 0 && (
                <div className="pqw-qr-card">

                    {/* Si hay más de una cuenta, mostramos el selector.
                        Si solo hay una, ya viene preseleccionada y se
                        muestra como información fija. */}
                    {cuentas.length > 1 && (
                        <div className={`pqw-field pqw-cuenta-select ${errors.cuenta_pago_id ? 'pqw-field--error' : ''}`}>
                            <label htmlFor="pqw-cuenta" className="pqw-field__label">
                                ¿Qué servicio estás pagando?
                            </label>
                            <select
                                id="pqw-cuenta"
                                className="pqw-field__input"
                                value={form.cuenta_pago_id}
                                onChange={handleCuentaChange}
                                disabled={isSubmitting}
                            >
                                <option value="">Selecciona un servicio...</option>
                                {cuentas.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre_servicio}</option>
                                ))}
                            </select>
                            {errors.cuenta_pago_id && (
                                <span className="pqw-field__error">{errors.cuenta_pago_id}</span>
                            )}
                        </div>
                    )}

                    {cuentaSeleccionada ? (
                        <>
                            <div className="pqw-qr-card__qr">
                                <canvas ref={canvasRef} />
                            </div>
                            <div className="pqw-qr-card__datos">
                                <p className="pqw-qr-card__titulo">
                                    Datos para Pago Móvil — {cuentaSeleccionada.nombre_servicio}
                                </p>
                                {cuentaSeleccionada.descripcion && (
                                    <p className="pqw-qr-card__nota">{cuentaSeleccionada.descripcion}</p>
                                )}
                                <dl className="pqw-datos-list">
                                    <div className="pqw-datos-list__row">
                                        <dt>Banco</dt>
                                        <dd>
                                            <button
                                                className={`pqw-copy-btn ${copiado === 'banco' ? 'pqw-copy-btn--copiado' : ''}`}
                                                onClick={() => copiarDato(cuentaSeleccionada.banco, 'banco')}
                                            >
                                                {cuentaSeleccionada.banco}
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
                                                className={`pqw-copy-btn ${copiado === 'telefono' ? 'pqw-copy-btn--copiado' : ''}`}
                                                onClick={() => copiarDato(cuentaSeleccionada.telefono, 'telefono')}
                                            >
                                                {cuentaSeleccionada.telefono}
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
                                                className={`pqw-copy-btn ${copiado === 'cedula' ? 'pqw-copy-btn--copiado' : ''}`}
                                                onClick={() => copiarDato(cuentaSeleccionada.cedula_rif, 'cedula')}
                                            >
                                                {cuentaSeleccionada.cedula_rif}
                                                <span className="pqw-copy-btn__icon">
                                                    {copiado === 'cedula' ? '✓' : '📋'}
                                                </span>
                                            </button>
                                        </dd>
                                    </div>
                                    <div className="pqw-datos-list__row">
                                        <dt>Titular</dt>
                                        <dd className="pqw-datos-list__titular">{cuentaSeleccionada.titular}</dd>
                                    </div>
                                </dl>
                            </div>
                        </>
                    ) : (
                        <p className="pqw-sin-cuenta">
                            👆 Selecciona un servicio para ver el código QR y los datos de pago.
                        </p>
                    )}
                </div>
            )}

            {/* ── Formulario de comprobante ────────────────────── */}
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

                    {/* Si solo hay una cuenta, mostramos a cuál servicio
                        corresponde (de solo lectura) dentro del propio
                        formulario, para que quede claro sin selector. */}
                    {cuentas.length === 1 && cuentaSeleccionada && (
                        <div className="pqw-cuenta-fija">
                            Pagando: <strong>{cuentaSeleccionada.nombre_servicio}</strong>
                        </div>
                    )}

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
                                placeholder="Ej: Pago de gas del mes de junio"
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
                        disabled={isSubmitting || cuentas.length === 0}
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
                                            <span className="pqw-item__concepto">
                                                {pago.cuenta_pago_nombre
                                                    ? `${pago.cuenta_pago_nombre} — ${pago.concepto_pago}`
                                                    : pago.concepto_pago}
                                            </span>
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

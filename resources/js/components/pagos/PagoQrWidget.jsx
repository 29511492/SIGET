/**
 * resources/js/components/pagos/PagoQrWidget.jsx
 *
 * Widget de pagos para el Portal Ciudadano (rol usuario).
 *
 * CAMBIO (sept-2026, corrección 2 del profesor: "proceso de pago
 * mejorable, tiene que ser por pasos y validaciones de pasos para
 * evitar errores, debe existir la opción de múltiples métodos de
 * pago sea pago móvil, transferencia, etc.") —
 *
 * El formulario de una sola pantalla se convirtió en un asistente de
 * 4 pasos. Cada paso valida su propia información antes de dejar
 * avanzar al siguiente — ya no es posible llegar al final con datos
 * incompletos o inconsistentes:
 *
 *   1. Método    → elige método de pago (pago móvil / transferencia)
 *                  y luego el servicio, filtrado por ese método.
 *   2. Destino   → ve el QR / datos de la cuenta elegida.
 *   3. Datos     → referencia, monto, concepto, fecha, banco de
 *                  origen (si aplica) y comprobante.
 *   4. Revisión  → resumen completo antes de enviar.
 *
 * El histórico de pagos ("Mis pagos enviados") se conserva igual.
 *
 * Consume:
 *   GET  /api/v1/cuentas-pago     → listar cuentas activas
 *   POST /api/v1/pagos/mio        → registrar pago con comprobante
 *   GET  /api/v1/pagos/mis        → ver los propios
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import QRCode      from 'qrcode';
import apiClient   from '../../services/axios';
import './PagoQrWidget.css';

const METODOS = [
    { value: 'pago_movil',    label: 'Pago móvil',   icon: '📱', desc: 'Pago instantáneo desde tu banco al número del Consejo Comunal.' },
    { value: 'transferencia', label: 'Transferencia', icon: '🏦', desc: 'Transferencia bancaria a la cuenta del Consejo Comunal.' },
];

const PASOS = [
    { id: 1, label: 'Método' },
    { id: 2, label: 'Destino' },
    { id: 3, label: 'Datos y comprobante' },
    { id: 4, label: 'Revisión' },
];

const FORM_INICIAL = {
    metodo_pago:          '',
    cuenta_pago_id:       '',
    referencia_bancaria:  '',
    monto:                '',
    concepto_pago:        '',
    fecha_pago:           new Date().toISOString().slice(0, 10),
    banco_origen:         '',
};

const ESTADO_CONFIG = {
    pendiente:  { label: '⏳ Pendiente',  cls: 'pqw-estado--pendiente'  },
    verificado: { label: '✓ Verificado',  cls: 'pqw-estado--verificado' },
    rechazado:  { label: '✗ Rechazado',   cls: 'pqw-estado--rechazado'  },
};

// Hace hoy - 30 días en formato YYYY-MM-DD, para el límite del campo fecha.
const fechaMinima = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
};

export default function PagoQrWidget({ onPagoRegistrado } = {}) {
    const canvasRef = useRef(null);

    // ── Cuentas de pago ──────────────────────────────────────
    const [cuentas,        setCuentas]        = useState([]);
    const [loadingCuentas, setLoadingCuentas] = useState(true);
    const [errorCuentas,   setErrorCuentas]   = useState('');

    // ── Asistente ────────────────────────────────────────────
    const [paso,          setPaso]          = useState(1);
    const [form,          setForm]          = useState(FORM_INICIAL);
    const [comprobante,   setComprobante]   = useState(null);
    const [previewUrl,    setPreviewUrl]    = useState('');
    const [errors,        setErrors]        = useState({});
    const [isSubmitting,  setIsSubmitting]  = useState(false);
    const [successMsg,    setSuccessMsg]    = useState('');
    const [serverError,   setServerError]   = useState('');

    // ── Historial ────────────────────────────────────────────
    const [historial,    setHistorial]    = useState([]);
    const [loadingHist,  setLoadingHist]  = useState(true);
    const [verHistorial, setVerHistorial] = useState(false);
    const [copiado,      setCopiado]      = useState('');

    // ── Derivados ────────────────────────────────────────────
    const cuentasDelMetodo = useMemo(
        () => cuentas.filter(c => c.metodo === form.metodo_pago),
        [cuentas, form.metodo_pago]
    );

    const cuentaSeleccionada = cuentas.find(
        c => String(c.id) === String(form.cuenta_pago_id)
    ) ?? null;

    const metodoInfo = METODOS.find(m => m.value === form.metodo_pago) ?? null;

    // ── Cargar cuentas de pago activas ──────────────────────
    const cargarCuentas = useCallback(() => {
        setLoadingCuentas(true);
        setErrorCuentas('');
        apiClient.get('/v1/cuentas-pago')
            .then(({ data }) => {
                setCuentas(Array.isArray(data.data) ? data.data : []);
            })
            .catch(() => setErrorCuentas('No se pudieron cargar las cuentas de pago disponibles.'))
            .finally(() => setLoadingCuentas(false));
    }, []);

    useEffect(() => { cargarCuentas(); }, [cargarCuentas]);

    // Métodos que de verdad tienen al menos una cuenta activa
    const metodosDisponibles = useMemo(
        () => METODOS.filter(m => cuentas.some(c => c.metodo === m.value)),
        [cuentas]
    );

    // Si solo hay un método disponible, se preselecciona para ahorrar un paso.
    useEffect(() => {
        if (metodosDisponibles.length === 1 && !form.metodo_pago) {
            setForm(prev => ({ ...prev, metodo_pago: metodosDisponibles[0].value }));
        }
    }, [metodosDisponibles, form.metodo_pago]);

    // Si dentro de un método solo hay una cuenta, se preselecciona.
    useEffect(() => {
        if (form.metodo_pago && cuentasDelMetodo.length === 1 && !form.cuenta_pago_id) {
            const c = cuentasDelMetodo[0];
            setForm(prev => ({
                ...prev,
                cuenta_pago_id: String(c.id),
                concepto_pago:  prev.concepto_pago || `Pago de ${c.nombre_servicio}`,
            }));
        }
    }, [form.metodo_pago, cuentasDelMetodo]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Generar el QR cada vez que cambia la cuenta elegida (paso 2) ──
    useEffect(() => {
        if (paso !== 2 || !canvasRef.current || !cuentaSeleccionada) return;

        const textoQr = cuentaSeleccionada.metodo === 'transferencia'
            ? `Transferencia\n` +
              `Servicio: ${cuentaSeleccionada.nombre_servicio}\n` +
              `Banco: ${cuentaSeleccionada.banco}\n` +
              `N° de cuenta: ${cuentaSeleccionada.numero_cuenta}\n` +
              `Cédula/RIF: ${cuentaSeleccionada.cedula_rif}\n` +
              `Titular: ${cuentaSeleccionada.titular}`
            : `Pago Móvil\n` +
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
    }, [paso, cuentaSeleccionada]);

    // ── Historial ────────────────────────────────────────────
    const cargarHistorial = useCallback(() => {
        setLoadingHist(true);
        apiClient.get('/v1/pagos/mis')
            .then(({ data }) => setHistorial(data.data))
            .catch(() => {})
            .finally(() => setLoadingHist(false));
    }, []);

    useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

    const toggleHistorial = () => {
        const abriendo = !verHistorial;
        setVerHistorial(abriendo);
        if (abriendo) cargarHistorial();
    };

    const copiarDato = (texto, campo) => {
        navigator.clipboard.writeText(texto).then(() => {
            setCopiado(campo);
            setTimeout(() => setCopiado(''), 1500);
        });
    };

    // ── Handlers de formulario ─────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (errors[name])  setErrors(prev => ({ ...prev, [name]: '' }));
        if (serverError)   setServerError('');
    };

    const elegirMetodo = (metodo) => {
        setForm(prev => ({
            ...FORM_INICIAL,
            metodo_pago: metodo,
            fecha_pago:  prev.fecha_pago,
        }));
        setErrors({});
    };

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

    // ── Validación POR PASO — evita llegar al final con datos
    //    incompletos o inconsistentes (corrección del profesor) ──
    const validarPaso = (n) => {
        const next = {};

        if (n === 1) {
            if (!form.metodo_pago)    next.metodo_pago    = 'Elige un método de pago.';
            if (!form.cuenta_pago_id) next.cuenta_pago_id = 'Selecciona a qué servicio corresponde tu pago.';
        }

        if (n === 3) {
            if (!form.referencia_bancaria.trim()) next.referencia_bancaria = 'La referencia es obligatoria.';
            if (!form.monto || Number(form.monto) <= 0) next.monto = 'Indica un monto válido.';
            if (!form.concepto_pago.trim()) next.concepto_pago = 'El concepto es obligatorio.';
            if (!form.fecha_pago) next.fecha_pago = 'Indica la fecha del pago.';
            if (form.metodo_pago === 'transferencia' && !form.banco_origen.trim()) {
                next.banco_origen = 'Indica desde qué banco transferiste.';
            }
            if (!comprobante) next.comprobante = 'Debes adjuntar el comprobante de pago.';
        }

        return next;
    };

    const irAPaso = (n) => {
        if (n < paso) { setPaso(n); return; } // retroceder siempre está permitido

        // Avanzar: cada paso intermedio debe quedar válido primero
        for (let p = paso; p < n; p++) {
            const err = validarPaso(p);
            if (Object.keys(err).length > 0) {
                setErrors(err);
                setPaso(p);
                return;
            }
        }
        setErrors({});
        setPaso(n);
    };

    const siguiente = () => irAPaso(paso + 1);
    const anterior  = () => irAPaso(paso - 1);

    // ── Envío final (paso 4) ────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSuccessMsg('');
        setServerError('');

        // Revalida todo por si el usuario llegó aquí saltándose algo
        const erroresPaso1 = validarPaso(1);
        const erroresPaso3 = validarPaso(3);
        const todosErrores = { ...erroresPaso1, ...erroresPaso3 };
        if (Object.keys(todosErrores).length > 0) {
            setErrors(todosErrores);
            setPaso(Object.keys(erroresPaso1).length ? 1 : 3);
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('cuenta_pago_id', form.cuenta_pago_id);
            formData.append('metodo_pago', form.metodo_pago);
            formData.append('referencia_bancaria', form.referencia_bancaria);
            formData.append('monto', form.monto);
            formData.append('concepto_pago', form.concepto_pago);
            formData.append('fecha_pago', form.fecha_pago);
            if (form.metodo_pago === 'transferencia') {
                formData.append('banco_origen', form.banco_origen);
            }
            formData.append('comprobante', comprobante);

            await apiClient.post('/v1/pagos/mio', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setSuccessMsg('¡Comprobante enviado! El Consejo Comunal verificará tu pago pronto.');
            setForm(FORM_INICIAL);
            setComprobante(null);
            setPreviewUrl('');
            setPaso(1);
            cargarHistorial();
            setVerHistorial(true);

            onPagoRegistrado?.();
        } catch (err) {
            const { status, data } = err.response ?? {};
            if (status === 422) {
                const nuevos = {
                    metodo_pago:         data.errors?.metodo_pago?.[0] ?? '',
                    cuenta_pago_id:      data.errors?.cuenta_pago_id?.[0] ?? '',
                    referencia_bancaria: data.errors?.referencia_bancaria?.[0] ?? '',
                    monto:               data.errors?.monto?.[0] ?? '',
                    concepto_pago:       data.errors?.concepto_pago?.[0] ?? '',
                    banco_origen:        data.errors?.banco_origen?.[0] ?? '',
                    fecha_pago:          data.errors?.fecha_pago?.[0] ?? '',
                    comprobante:         data.errors?.comprobante?.[0] ?? '',
                };
                setErrors(nuevos);
                // Si el error viene de método/cuenta, regresa al paso 1
                if (nuevos.metodo_pago || nuevos.cuenta_pago_id) setPaso(1);
                else setPaso(3);
            } else {
                setServerError('No se pudo registrar el pago. Intenta de nuevo.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Render ───────────────────────────────────────────────
    const pendientes = historial.filter(p => p.estado === 'pendiente').length;

    return (
        <section className="pqw-section" aria-label="Pagos QR">

            {/* Encabezado */}
            <div className="pqw-header">
                <div className="pqw-header__left">
                    <h2 className="pqw-header__title">
                        <span aria-hidden="true">📱</span>
                        Pagos
                    </h2>
                    <p className="pqw-header__subtitle">
                        Elige el método, el servicio y sube tu comprobante paso a paso
                    </p>
                </div>
                {historial.length > 0 && (
                    <button className="pqw-header__toggle" onClick={toggleHistorial} type="button">
                        {verHistorial ? 'Ocultar historial' : `Mis pagos (${historial.length})`}
                        {pendientes > 0 && (
                            <span className="pqw-badge pqw-badge--pendiente">{pendientes}</span>
                        )}
                    </button>
                )}
            </div>

            {errorCuentas && (
                <div className="pqw-alert pqw-alert--error" role="alert">
                    <span aria-hidden="true">⚠</span>
                    <span>{errorCuentas}</span>
                </div>
            )}

            {!loadingCuentas && !errorCuentas && cuentas.length === 0 && (
                <div className="pqw-alert pqw-alert--info" role="status">
                    <span aria-hidden="true">ℹ️</span>
                    <span>
                        Aún no hay cuentas de pago configuradas por el Consejo Comunal.
                        Intenta más tarde.
                    </span>
                </div>
            )}

            {!loadingCuentas && cuentas.length > 0 && (
                <div className="pqw-form-card">

                    {/* ── Indicador de pasos ──────────────────────── */}
                    <ol className="pqw-steps" aria-label="Progreso del pago">
                        {PASOS.map((p) => (
                            <li
                                key={p.id}
                                className={[
                                    'pqw-step',
                                    p.id === paso && 'pqw-step--active',
                                    p.id < paso && 'pqw-step--done',
                                ].filter(Boolean).join(' ')}
                            >
                                <button
                                    type="button"
                                    className="pqw-step__btn"
                                    onClick={() => irAPaso(p.id)}
                                    disabled={isSubmitting}
                                >
                                    <span className="pqw-step__num">
                                        {p.id < paso ? '✓' : p.id}
                                    </span>
                                    <span className="pqw-step__label">{p.label}</span>
                                </button>
                            </li>
                        ))}
                    </ol>

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

                        {/* ══ PASO 1 — Método y servicio ══════════ */}
                        {paso === 1 && (
                            <div className="pqw-paso">
                                <p className="pqw-paso__titulo">¿Cómo vas a pagar?</p>

                                <div className={`pqw-metodos ${errors.metodo_pago ? 'pqw-field--error' : ''}`}>
                                    {metodosDisponibles.map((m) => (
                                        <button
                                            key={m.value}
                                            type="button"
                                            className={`pqw-metodo-card ${form.metodo_pago === m.value ? 'pqw-metodo-card--activo' : ''}`}
                                            onClick={() => elegirMetodo(m.value)}
                                        >
                                            <span className="pqw-metodo-card__icon" aria-hidden="true">{m.icon}</span>
                                            <span className="pqw-metodo-card__label">{m.label}</span>
                                            <span className="pqw-metodo-card__desc">{m.desc}</span>
                                        </button>
                                    ))}
                                </div>
                                {errors.metodo_pago && (
                                    <span className="pqw-field__error">{errors.metodo_pago}</span>
                                )}

                                {form.metodo_pago && (
                                    <div className={`pqw-field ${errors.cuenta_pago_id ? 'pqw-field--error' : ''}`} style={{ marginTop: '1.25rem' }}>
                                        <label htmlFor="pqw-cuenta" className="pqw-field__label">
                                            ¿Qué servicio estás pagando?
                                        </label>
                                        {cuentasDelMetodo.length === 0 ? (
                                            <p className="pqw-sin-cuenta">
                                                No hay servicios disponibles para {metodoInfo?.label.toLowerCase()} en este momento.
                                            </p>
                                        ) : (
                                            <select
                                                id="pqw-cuenta"
                                                className="pqw-field__input"
                                                value={form.cuenta_pago_id}
                                                onChange={handleCuentaChange}
                                            >
                                                <option value="">Selecciona un servicio...</option>
                                                {cuentasDelMetodo.map(c => (
                                                    <option key={c.id} value={c.id}>{c.nombre_servicio}</option>
                                                ))}
                                            </select>
                                        )}
                                        {errors.cuenta_pago_id && (
                                            <span className="pqw-field__error">{errors.cuenta_pago_id}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ══ PASO 2 — Destino (QR + datos) ═══════ */}
                        {paso === 2 && cuentaSeleccionada && (
                            <div className="pqw-paso">
                                <p className="pqw-paso__titulo">
                                    Datos para {metodoInfo?.label} — {cuentaSeleccionada.nombre_servicio}
                                </p>
                                {cuentaSeleccionada.descripcion && (
                                    <p className="pqw-qr-card__nota">{cuentaSeleccionada.descripcion}</p>
                                )}

                                <div className="pqw-qr-card">
                                    <div className="pqw-qr-card__qr">
                                        <canvas ref={canvasRef} />
                                    </div>
                                    <div className="pqw-qr-card__datos">
                                        <dl className="pqw-datos-list">
                                            <div className="pqw-datos-list__row">
                                                <dt>Banco</dt>
                                                <dd>
                                                    <button
                                                        type="button"
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

                                            {cuentaSeleccionada.metodo === 'transferencia' ? (
                                                <div className="pqw-datos-list__row">
                                                    <dt>N° de cuenta</dt>
                                                    <dd>
                                                        <button
                                                            type="button"
                                                            className={`pqw-copy-btn ${copiado === 'cuenta' ? 'pqw-copy-btn--copiado' : ''}`}
                                                            onClick={() => copiarDato(cuentaSeleccionada.numero_cuenta, 'cuenta')}
                                                        >
                                                            {cuentaSeleccionada.numero_cuenta}
                                                            <span className="pqw-copy-btn__icon">
                                                                {copiado === 'cuenta' ? '✓' : '📋'}
                                                            </span>
                                                        </button>
                                                    </dd>
                                                </div>
                                            ) : (
                                                <div className="pqw-datos-list__row">
                                                    <dt>Teléfono</dt>
                                                    <dd>
                                                        <button
                                                            type="button"
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
                                            )}

                                            <div className="pqw-datos-list__row">
                                                <dt>Cédula/RIF</dt>
                                                <dd>
                                                    <button
                                                        type="button"
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
                                </div>
                            </div>
                        )}

                        {/* ══ PASO 3 — Datos del pago y comprobante ══ */}
                        {paso === 3 && (
                            <div className="pqw-paso">
                                <p className="pqw-paso__titulo">Datos de tu pago</p>

                                <div className="pqw-cuenta-fija">
                                    Pagando: <strong>{cuentaSeleccionada?.nombre_servicio}</strong> por {metodoInfo?.label.toLowerCase()}
                                </div>

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

                                    <div className={`pqw-field ${errors.fecha_pago ? 'pqw-field--error' : ''}`}>
                                        <label htmlFor="pqw-fecha" className="pqw-field__label">
                                            Fecha del pago
                                        </label>
                                        <input
                                            id="pqw-fecha"
                                            name="fecha_pago"
                                            type="date"
                                            className="pqw-field__input"
                                            min={fechaMinima()}
                                            max={new Date().toISOString().slice(0, 10)}
                                            value={form.fecha_pago}
                                            onChange={handleChange}
                                            disabled={isSubmitting}
                                        />
                                        {errors.fecha_pago && (
                                            <span className="pqw-field__error">{errors.fecha_pago}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Banco de origen — solo transferencia */}
                                {form.metodo_pago === 'transferencia' && (
                                    <div className={`pqw-field ${errors.banco_origen ? 'pqw-field--error' : ''}`}>
                                        <label htmlFor="pqw-banco-origen" className="pqw-field__label">
                                            ¿Desde qué banco transferiste?
                                        </label>
                                        <input
                                            id="pqw-banco-origen"
                                            name="banco_origen"
                                            type="text"
                                            className="pqw-field__input"
                                            placeholder="Ej: Banesco"
                                            value={form.banco_origen}
                                            onChange={handleChange}
                                            disabled={isSubmitting}
                                        />
                                        {errors.banco_origen && (
                                            <span className="pqw-field__error">{errors.banco_origen}</span>
                                        )}
                                    </div>
                                )}

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
                            </div>
                        )}

                        {/* ══ PASO 4 — Revisión ═══════════════════ */}
                        {paso === 4 && (
                            <div className="pqw-paso">
                                <p className="pqw-paso__titulo">Revisa tu pago antes de enviarlo</p>

                                <dl className="pqw-resumen">
                                    <div className="pqw-resumen__row">
                                        <dt>Servicio</dt>
                                        <dd>{cuentaSeleccionada?.nombre_servicio}</dd>
                                    </div>
                                    <div className="pqw-resumen__row">
                                        <dt>Método</dt>
                                        <dd>{metodoInfo?.label}</dd>
                                    </div>
                                    <div className="pqw-resumen__row">
                                        <dt>Referencia</dt>
                                        <dd>{form.referencia_bancaria}</dd>
                                    </div>
                                    <div className="pqw-resumen__row">
                                        <dt>Monto</dt>
                                        <dd>Bs. {form.monto}</dd>
                                    </div>
                                    <div className="pqw-resumen__row">
                                        <dt>Concepto</dt>
                                        <dd>{form.concepto_pago}</dd>
                                    </div>
                                    <div className="pqw-resumen__row">
                                        <dt>Fecha</dt>
                                        <dd>{form.fecha_pago}</dd>
                                    </div>
                                    {form.metodo_pago === 'transferencia' && (
                                        <div className="pqw-resumen__row">
                                            <dt>Banco de origen</dt>
                                            <dd>{form.banco_origen}</dd>
                                        </div>
                                    )}
                                </dl>

                                {previewUrl && (
                                    <div className="pqw-resumen__comprobante">
                                        <img src={previewUrl} alt="Comprobante a enviar" className="pqw-upload__preview" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Navegación del asistente ────────────── */}
                        <div className="pqw-paso-nav">
                            {paso > 1 && (
                                <button
                                    type="button"
                                    className="pqw-paso-nav__btn pqw-paso-nav__btn--secundario"
                                    onClick={anterior}
                                    disabled={isSubmitting}
                                >
                                    ← Atrás
                                </button>
                            )}
                            <div className="pqw-paso-nav__spacer" />
                            {paso < 4 ? (
                                <button
                                    type="button"
                                    className="pqw-submit"
                                    onClick={siguiente}
                                    disabled={cuentas.length === 0}
                                >
                                    Siguiente →
                                </button>
                            ) : (
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
                            )}
                        </div>
                    </form>
                </div>
            )}

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
                            type="button"
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
                                            <span>{pago.metodo_pago_label ?? 'Pago móvil'}</span>
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

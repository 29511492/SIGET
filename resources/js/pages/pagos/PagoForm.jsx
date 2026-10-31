/**
 * PagoForm.jsx — Registro de pago por admin/operador — SIGET
 * Ruta física: resources/js/pages/pagos/PagoForm.jsx
 *
 * REESCRITO (oct-2026, pendiente 14.9-D / corrección 2 del profesor:
 * "proceso de pago por pasos, con validación de pasos y múltiples
 * métodos de pago"). El formulario anterior era del flujo viejo: leía
 * user.habitante_id (que UserResource no envía, así que se bloqueaba
 * para todos los roles), usaba un QR fijo y no manejaba cuenta ni
 * método de pago.
 *
 * Ahora el admin/operador registra un pago A NOMBRE DE UN HABITANTE
 * (vecino sin usuario en el Portal, o que pagó en persona) con un
 * asistente de 4 pasos, cada uno validado antes de avanzar:
 *
 *   1. Habitante          → busca la familia y elige al habitante.
 *   2. Método y cuenta    → pago móvil / transferencia y la cuenta
 *                           activa de destino (filtrada por método).
 *   3. Datos y comprobante→ referencia, monto, fecha, concepto, banco
 *                           de origen (transferencia) y comprobante.
 *   4. Revisión           → resumen completo antes de enviar.
 *
 * Consume (sin endpoints nuevos):
 *   GET  /v1/familias?search=…   → buscar familia (admin+operador)
 *   GET  /v1/familias/{id}       → habitantes de la familia elegida
 *   GET  /v1/cuentas-pago        → cuentas activas
 *   POST /v1/pagos               → registrar (queda 'pendiente')
 *
 * El portal del ciudadano (PagoQrWidget.jsx) no se toca.
 *
 * Ruta en app.jsx (solo admin + operador, igual que el backend):
 *   <Route path="/pagos/nuevo" element={
 *       <ProtectedRoute allowedRoles={['admin', 'operador']}>
 *           <PagoForm />
 *       </ProtectedRoute>
 *   } />
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/axios';
import './PagoForm.css';

const METODOS = [
    { value: 'pago_movil',    label: 'Pago móvil',    icon: '📱', desc: 'Pago instantáneo desde el banco al número del Consejo Comunal.' },
    { value: 'transferencia', label: 'Transferencia', icon: '🏦', desc: 'Transferencia bancaria a la cuenta del Consejo Comunal.' },
];

const PASOS = [
    { id: 1, label: 'Habitante' },
    { id: 2, label: 'Método y cuenta' },
    { id: 3, label: 'Datos y comprobante' },
    { id: 4, label: 'Revisión' },
];

// Fecha LOCAL en formato YYYY-MM-DD. No se usa toISOString() porque
// convierte a UTC: en Venezuela (UTC-4), de noche daría la fecha de
// mañana y el servidor la rechazaría por "fecha futura".
const fechaLocal = (d = new Date()) => {
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
};

const fechaMinima = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return fechaLocal(d);
};

const FORM_INICIAL = () => ({
    metodo_pago:         '',
    cuenta_pago_id:      '',
    referencia_bancaria: '',
    monto:               '',
    concepto_pago:       '',
    fecha_pago:          fechaLocal(),
    banco_origen:        '',
});

const PREFIJO_CONCEPTO = 'Pago de ';

// Concepto sugerido a partir de la cuenta, sin pisar lo que el usuario escribió.
const conceptoPara = (previo, cuenta) =>
    (!previo || previo.startsWith(PREFIJO_CONCEPTO)) && cuenta
        ? `${PREFIJO_CONCEPTO}${cuenta.nombre_servicio}`
        : previo;

export default function PagoForm() {
    const navigate = useNavigate();

    // ── Asistente ────────────────────────────────────────────
    const [paso,         setPaso]         = useState(1);
    const [form,         setForm]         = useState(FORM_INICIAL);
    const [errors,       setErrors]       = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [serverError,  setServerError]  = useState('');
    const [toast,        setToast]        = useState(null);

    // ── Paso 1: búsqueda de familia / habitante ──────────────
    const [busqueda,       setBusqueda]       = useState('');
    const [familias,       setFamilias]       = useState([]);
    const [buscando,       setBuscando]       = useState(false);
    const [errorBusqueda,  setErrorBusqueda]  = useState('');
    const [familiaSel,     setFamiliaSel]     = useState(null);
    const [habitantesFam,  setHabitantesFam]  = useState([]);
    const [cargandoHab,    setCargandoHab]    = useState(false);
    const [errorHab,       setErrorHab]       = useState('');
    const [habitante,      setHabitante]      = useState(null);
    const reqBusqueda = useRef(0);   // descarta respuestas de búsquedas viejas
    const reqFamilia  = useRef(0);

    // ── Paso 2: cuentas de pago ──────────────────────────────
    const [cuentas,        setCuentas]        = useState([]);
    const [loadingCuentas, setLoadingCuentas] = useState(true);
    const [errorCuentas,   setErrorCuentas]   = useState('');

    // ── Paso 3: comprobante ──────────────────────────────────
    const [comprobante, setComprobante] = useState(null);
    const [previewUrl,  setPreviewUrl]  = useState('');
    const fileInputRef = useRef(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    // ── Derivados ────────────────────────────────────────────
    const metodosDisponibles = useMemo(
        () => METODOS.filter(m => cuentas.some(c => c.metodo === m.value)),
        [cuentas]
    );

    const cuentasDelMetodo = useMemo(
        () => cuentas.filter(c => c.metodo === form.metodo_pago),
        [cuentas, form.metodo_pago]
    );

    const cuentaSeleccionada = cuentas.find(
        c => String(c.id) === String(form.cuenta_pago_id)
    ) ?? null;

    const metodoInfo = METODOS.find(m => m.value === form.metodo_pago) ?? null;

    // ── Carga de cuentas activas ─────────────────────────────
    const cargarCuentas = useCallback(() => {
        setLoadingCuentas(true);
        setErrorCuentas('');
        apiClient.get('/v1/cuentas-pago')
            .then(({ data }) => setCuentas(Array.isArray(data.data) ? data.data : []))
            .catch(() => setErrorCuentas('No se pudieron cargar las cuentas de pago disponibles.'))
            .finally(() => setLoadingCuentas(false));
    }, []);

    useEffect(() => { cargarCuentas(); }, [cargarCuentas]);

    // Si solo hay un método con cuentas, se preselecciona.
    useEffect(() => {
        if (metodosDisponibles.length === 1 && !form.metodo_pago) {
            setForm(prev => ({ ...prev, metodo_pago: metodosDisponibles[0].value }));
        }
    }, [metodosDisponibles, form.metodo_pago]);

    // Si dentro del método solo hay una cuenta, se preselecciona.
    useEffect(() => {
        if (form.metodo_pago && cuentasDelMetodo.length === 1 && !form.cuenta_pago_id) {
            const c = cuentasDelMetodo[0];
            setForm(prev => ({
                ...prev,
                cuenta_pago_id: String(c.id),
                concepto_pago:  conceptoPara(prev.concepto_pago, c),
            }));
        }
    }, [form.metodo_pago, cuentasDelMetodo]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Búsqueda de familias (con debounce) ──────────────────
    useEffect(() => {
        const q = busqueda.trim();

        if (q.length < 2) {
            reqBusqueda.current += 1;
            setFamilias([]);
            setBuscando(false);
            setErrorBusqueda('');
            return undefined;
        }

        const id = ++reqBusqueda.current;
        setBuscando(true);
        setErrorBusqueda('');

        const timer = setTimeout(async () => {
            try {
                const { data } = await apiClient.get('/v1/familias', {
                    params: { search: q, per_page: 8 },
                });
                if (id !== reqBusqueda.current) return;
                setFamilias(Array.isArray(data.data) ? data.data : []);
            } catch (err) {
                if (id !== reqBusqueda.current) return;
                setFamilias([]);
                setErrorBusqueda(err.response?.data?.message ?? 'No se pudo buscar familias.');
            } finally {
                if (id === reqBusqueda.current) setBuscando(false);
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [busqueda]);

    // Liberar la URL de la vista previa al cambiar o desmontar
    useEffect(() => () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    // ── Handlers: paso 1 ─────────────────────────────────────
    const elegirFamilia = async (fam) => {
        const id = ++reqFamilia.current;
        setFamiliaSel(fam);
        setHabitantesFam([]);
        setErrorHab('');
        setCargandoHab(true);
        try {
            const { data } = await apiClient.get(`/v1/familias/${fam.id}`);
            if (id !== reqFamilia.current) return;
            setHabitantesFam(Array.isArray(data.data?.habitantes) ? data.data.habitantes : []);
        } catch (err) {
            if (id !== reqFamilia.current) return;
            setErrorHab(err.response?.data?.message ?? 'No se pudieron cargar los habitantes.');
        } finally {
            if (id === reqFamilia.current) setCargandoHab(false);
        }
    };

    const elegirHabitante = (h) => {
        setHabitante({
            id:              h.id,
            nombre_completo: h.nombre_completo,
            cedula:          h.cedula,
            familia: {
                id:                 familiaSel.id,
                codigo_vivienda:    familiaSel.codigo_vivienda,
                nombre_responsable: familiaSel.nombre_responsable,
            },
        });
        if (errors.habitante_id) setErrors(prev => ({ ...prev, habitante_id: '' }));
        if (serverError) setServerError('');
    };

    // ── Handlers: paso 2 ─────────────────────────────────────
    const elegirMetodo = (metodo) => {
        setForm(prev => ({
            ...prev,
            metodo_pago:    metodo,
            cuenta_pago_id: '',
            banco_origen:   '',
            // si el concepto era el automático de la cuenta anterior, se limpia
            concepto_pago:  prev.concepto_pago.startsWith(PREFIJO_CONCEPTO) ? '' : prev.concepto_pago,
        }));
        setErrors(prev => ({ ...prev, metodo_pago: '', cuenta_pago_id: '' }));
        if (serverError) setServerError('');
    };

    const elegirCuenta = (cuenta) => {
        setForm(prev => ({
            ...prev,
            cuenta_pago_id: String(cuenta.id),
            concepto_pago:  conceptoPara(prev.concepto_pago, cuenta),
        }));
        if (errors.cuenta_pago_id) setErrors(prev => ({ ...prev, cuenta_pago_id: '' }));
        if (serverError) setServerError('');
    };

    // ── Handlers: paso 3 ─────────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
        if (serverError)  setServerError('');
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

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
        setPreviewUrl(URL.createObjectURL(file));
        if (errors.comprobante) setErrors(prev => ({ ...prev, comprobante: '' }));
    };

    const quitarComprobante = () => {
        setComprobante(null);
        setPreviewUrl('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Validación POR PASO ──────────────────────────────────
    const validarPaso = (n) => {
        const next = {};

        if (n === 1) {
            if (!habitante) next.habitante_id = 'Selecciona el habitante que realizó el pago.';
        }

        if (n === 2) {
            if (!form.metodo_pago) {
                next.metodo_pago = 'Elige un método de pago.';
            } else if (!cuentaSeleccionada || cuentaSeleccionada.metodo !== form.metodo_pago) {
                next.cuenta_pago_id = 'Selecciona la cuenta a la que corresponde el pago.';
            }
        }

        if (n === 3) {
            if (!form.referencia_bancaria.trim()) next.referencia_bancaria = 'La referencia es obligatoria.';
            if (!form.monto || Number(form.monto) <= 0) {
                next.monto = 'Indica un monto válido.';
            } else if (Number(form.monto) > 999999.99) {
                next.monto = 'El monto es demasiado alto.';
            }
            if (!form.concepto_pago.trim()) next.concepto_pago = 'El concepto es obligatorio.';
            if (!form.fecha_pago) {
                next.fecha_pago = 'Indica la fecha del pago.';
            } else if (form.fecha_pago > fechaLocal()) {
                next.fecha_pago = 'La fecha del pago no puede ser futura.';
            } else if (form.fecha_pago < fechaMinima()) {
                next.fecha_pago = 'La fecha no puede tener más de 30 días de antigüedad.';
            }
            if (form.metodo_pago === 'transferencia' && !form.banco_origen.trim()) {
                next.banco_origen = 'Indica desde qué banco se realizó la transferencia.';
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

    // Enter dentro de un <input> dispara el envío nativo del form: se
    // bloquea para no saltarse la revisión del paso 4 (mismo fix que
    // PagoQrWidget). El botón de envío sigue respondiendo al teclado.
    const bloquearEnterEnInputs = (e) => {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault();
    };

    // ── Envío final (paso 4) ─────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (paso !== 4 || isSubmitting) return;
        setServerError('');

        // Revalida todo por si se llegó aquí saltándose algo
        const todos = { ...validarPaso(1), ...validarPaso(2), ...validarPaso(3) };
        if (Object.keys(todos).length > 0) {
            setErrors(todos);
            if (todos.habitante_id) setPaso(1);
            else if (todos.metodo_pago || todos.cuenta_pago_id) setPaso(2);
            else setPaso(3);
            return;
        }

        setIsSubmitting(true);
        try {
            // El cliente axios del proyecto trae Content-Type: application/json por
            // defecto; con ese valor axios convierte el FormData a JSON y el archivo
            // se pierde (llega como objeto vacío y el servidor responde que falta el
            // comprobante). Por eso se declara multipart/form-data, igual que
            // PagoQrWidget: axios/navegador reemplazan el valor y ponen el boundary.
            const formData = new FormData();
            formData.append('habitante_id',        habitante.id);
            formData.append('cuenta_pago_id',      form.cuenta_pago_id);
            formData.append('metodo_pago',         form.metodo_pago);
            formData.append('referencia_bancaria', form.referencia_bancaria.trim());
            formData.append('monto',               form.monto);
            formData.append('concepto_pago',       form.concepto_pago.trim());
            formData.append('fecha_pago',          form.fecha_pago);
            if (form.metodo_pago === 'transferencia') {
                formData.append('banco_origen', form.banco_origen.trim());
            }
            formData.append('comprobante', comprobante);

            await apiClient.post('/v1/pagos', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            showToast('Pago registrado correctamente. Queda pendiente de verificación.');
            setTimeout(() => navigate('/pagos'), 1500);
        } catch (err) {
            const { status, data } = err.response ?? {};
            if (status === 422) {
                const primero = (k) => data?.errors?.[k]?.[0] ?? '';
                const nuevos = {
                    habitante_id:        primero('habitante_id'),
                    metodo_pago:         primero('metodo_pago'),
                    cuenta_pago_id:      primero('cuenta_pago_id'),
                    referencia_bancaria: primero('referencia_bancaria'),
                    monto:               primero('monto'),
                    concepto_pago:       primero('concepto_pago'),
                    banco_origen:        primero('banco_origen'),
                    fecha_pago:          primero('fecha_pago'),
                    comprobante:         primero('comprobante'),
                };
                setErrors(nuevos);
                if (nuevos.habitante_id) setPaso(1);
                else if (nuevos.metodo_pago || nuevos.cuenta_pago_id) setPaso(2);
                else setPaso(3);
                if (!Object.values(nuevos).some(Boolean)) {
                    setServerError(data?.message ?? 'Los datos proporcionados no son válidos.');
                }
            } else if (status === 403) {
                setServerError('No tienes permiso para registrar pagos.');
            } else {
                setServerError(data?.message ?? 'No se pudo registrar el pago. Intenta de nuevo.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────
    const montoFmt = form.monto ? Number(form.monto).toFixed(2) : '0.00';

    return (
        <div className="list-page">

            {toast && (
                <div className={`pfw-toast pfw-toast--${toast.type}`} role="alert">
                    {toast.type === 'success' ? '✓' : '⚠'} {toast.msg}
                </div>
            )}

            <header className="list-topbar">
                <button className="list-topbar__back" onClick={() => navigate('/pagos')} type="button">
                    ← Pagos
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Registrar Pago</span>
                </div>
            </header>

            <div className="pfw-container">
                <div className="pfw-card">

                    <div className="pfw-card__header">
                        <h1 className="pfw-card__title">Registrar pago de un habitante</h1>
                        <p className="pfw-card__sub">
                            Registra un pago a nombre del habitante. Quedará pendiente hasta que
                            un administrador o vocero lo verifique.
                        </p>
                    </div>

                    {/* ── Indicador de pasos ──────────────────── */}
                    <ol className="pfw-steps" aria-label="Progreso del registro">
                        {PASOS.map((p) => (
                            <li
                                key={p.id}
                                className={[
                                    'pfw-step',
                                    p.id === paso && 'pfw-step--active',
                                    p.id < paso && 'pfw-step--done',
                                ].filter(Boolean).join(' ')}
                            >
                                <button
                                    type="button"
                                    className="pfw-step__btn"
                                    onClick={() => irAPaso(p.id)}
                                    disabled={isSubmitting}
                                >
                                    <span className="pfw-step__num">{p.id < paso ? '✓' : p.id}</span>
                                    <span className="pfw-step__label">{p.label}</span>
                                </button>
                            </li>
                        ))}
                    </ol>

                    {serverError && (
                        <div className="pfw-alert pfw-alert--error" role="alert">
                            <span aria-hidden="true">⚠</span>
                            <span>{serverError}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} onKeyDown={bloquearEnterEnInputs} noValidate>

                        {/* ══ PASO 1 — Habitante ═══════════════════ */}
                        {paso === 1 && (
                            <div className="pfw-paso">
                                <p className="pfw-paso__titulo">¿Quién realizó el pago?</p>
                                <p className="pfw-paso__ayuda">
                                    Busca la familia y elige al habitante a cuyo nombre se registrará el pago.
                                </p>

                                {habitante && (
                                    <div className="pfw-seleccion" role="status">
                                        <div className="pfw-seleccion__info">
                                            <span className="pfw-seleccion__label">Habitante seleccionado</span>
                                            <strong className="pfw-seleccion__nombre">{habitante.nombre_completo}</strong>
                                            <span className="pfw-seleccion__meta">
                                                Cédula {habitante.cedula || '—'} · Familia {habitante.familia.codigo_vivienda} ({habitante.familia.nombre_responsable})
                                            </span>
                                        </div>
                                        <button type="button" className="pfw-link" onClick={() => setHabitante(null)}>
                                            Cambiar
                                        </button>
                                    </div>
                                )}

                                <div className={`pfw-field ${errors.habitante_id ? 'pfw-field--error' : ''}`}>
                                    <label htmlFor="pfw-busqueda" className="pfw-field__label">Buscar familia</label>
                                    <input
                                        id="pfw-busqueda"
                                        type="text"
                                        className="pfw-field__input"
                                        placeholder="Código de vivienda o nombre del responsable"
                                        value={busqueda}
                                        onChange={(e) => setBusqueda(e.target.value)}
                                        autoComplete="off"
                                        autoFocus
                                    />
                                    {errors.habitante_id && (
                                        <span className="pfw-field__error">{errors.habitante_id}</span>
                                    )}
                                </div>

                                <div className="pfw-columnas">
                                    <div className="pfw-columna">
                                        <h2 className="pfw-columna__titulo">Familias</h2>
                                        {busqueda.trim().length < 2 ? (
                                            <p className="pfw-vacio">Escribe al menos 2 caracteres para buscar.</p>
                                        ) : buscando ? (
                                            <p className="pfw-vacio">Buscando…</p>
                                        ) : errorBusqueda ? (
                                            <p className="pfw-vacio pfw-vacio--error">⚠ {errorBusqueda}</p>
                                        ) : familias.length === 0 ? (
                                            <p className="pfw-vacio">No se encontraron familias.</p>
                                        ) : (
                                            <ul className="pfw-lista">
                                                {familias.map(fam => (
                                                    <li key={fam.id}>
                                                        <button
                                                            type="button"
                                                            className={`pfw-item ${familiaSel?.id === fam.id ? 'pfw-item--activo' : ''}`}
                                                            onClick={() => elegirFamilia(fam)}
                                                            aria-pressed={familiaSel?.id === fam.id}
                                                        >
                                                            <strong>{fam.codigo_vivienda}</strong>
                                                            <span>{fam.nombre_responsable}</span>
                                                            {fam.calle?.nombre && <small>{fam.calle.nombre}</small>}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                    <div className="pfw-columna">
                                        <h2 className="pfw-columna__titulo">Habitantes</h2>
                                        {!familiaSel ? (
                                            <p className="pfw-vacio">Elige una familia para ver sus habitantes.</p>
                                        ) : cargandoHab ? (
                                            <p className="pfw-vacio">Cargando habitantes…</p>
                                        ) : errorHab ? (
                                            <p className="pfw-vacio pfw-vacio--error">⚠ {errorHab}</p>
                                        ) : habitantesFam.length === 0 ? (
                                            <p className="pfw-vacio">Esta familia no tiene habitantes registrados.</p>
                                        ) : (
                                            <ul className="pfw-lista">
                                                {habitantesFam.map(h => (
                                                    <li key={h.id}>
                                                        <button
                                                            type="button"
                                                            className={`pfw-item ${habitante?.id === h.id ? 'pfw-item--activo' : ''}`}
                                                            onClick={() => elegirHabitante(h)}
                                                            aria-pressed={habitante?.id === h.id}
                                                        >
                                                            <strong>{h.nombre_completo}</strong>
                                                            <span>Cédula {h.cedula || '—'}</span>
                                                            {h.edad != null && <small>{h.edad} años</small>}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ══ PASO 2 — Método y cuenta ═════════════ */}
                        {paso === 2 && (
                            <div className="pfw-paso">
                                {loadingCuentas && <p className="pfw-vacio">Cargando cuentas de pago…</p>}

                                {errorCuentas && (
                                    <div className="pfw-alert pfw-alert--error" role="alert">
                                        <span aria-hidden="true">⚠</span>
                                        <span>{errorCuentas}</span>
                                        <button type="button" className="pfw-link" onClick={cargarCuentas}>Reintentar</button>
                                    </div>
                                )}

                                {!loadingCuentas && !errorCuentas && cuentas.length === 0 && (
                                    <div className="pfw-alert pfw-alert--info" role="status">
                                        <span aria-hidden="true">ℹ️</span>
                                        <span>
                                            No hay cuentas de pago activas. Crea una en{' '}
                                            <button type="button" className="pfw-link" onClick={() => navigate('/cuentas-pago')}>
                                                Cuentas de Pago
                                            </button>{' '}
                                            antes de registrar un pago.
                                        </span>
                                    </div>
                                )}

                                {!loadingCuentas && cuentas.length > 0 && (
                                    <>
                                        <p className="pfw-paso__titulo">¿Cómo se realizó el pago?</p>
                                        <div className={`pfw-metodos ${errors.metodo_pago ? 'pfw-metodos--error' : ''}`}>
                                            {METODOS.map(m => {
                                                const disponible = metodosDisponibles.some(x => x.value === m.value);
                                                const activo     = form.metodo_pago === m.value;
                                                return (
                                                    <button
                                                        key={m.value}
                                                        type="button"
                                                        className={`pfw-metodo ${activo ? 'pfw-metodo--activo' : ''}`}
                                                        onClick={() => elegirMetodo(m.value)}
                                                        disabled={!disponible}
                                                        aria-pressed={activo}
                                                    >
                                                        <span className="pfw-metodo__icon" aria-hidden="true">{m.icon}</span>
                                                        <strong>{m.label}</strong>
                                                        <span className="pfw-metodo__desc">
                                                            {disponible ? m.desc : 'Sin cuentas activas para este método.'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {errors.metodo_pago && (
                                            <span className="pfw-field__error">{errors.metodo_pago}</span>
                                        )}

                                        {form.metodo_pago && (
                                            <>
                                                <p className="pfw-paso__titulo pfw-paso__titulo--sec">
                                                    ¿A qué cuenta se pagó?
                                                </p>
                                                <div className="pfw-cuentas">
                                                    {cuentasDelMetodo.map(c => {
                                                        const activa = String(c.id) === String(form.cuenta_pago_id);
                                                        return (
                                                            <button
                                                                key={c.id}
                                                                type="button"
                                                                className={`pfw-cuenta ${activa ? 'pfw-cuenta--activa' : ''}`}
                                                                onClick={() => elegirCuenta(c)}
                                                                aria-pressed={activa}
                                                            >
                                                                <strong>{c.nombre_servicio}</strong>
                                                                <span>{c.banco}</span>
                                                                <span>
                                                                    {c.metodo === 'transferencia'
                                                                        ? `Cuenta ${c.numero_cuenta}`
                                                                        : `Tel. ${c.telefono}`}
                                                                </span>
                                                                <small>{c.titular}</small>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {errors.cuenta_pago_id && (
                                                    <span className="pfw-field__error">{errors.cuenta_pago_id}</span>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/* ══ PASO 3 — Datos y comprobante ═════════ */}
                        {paso === 3 && (
                            <div className="pfw-paso">
                                <p className="pfw-paso__titulo">Datos del pago</p>

                                <div className="pfw-cuenta-fija">
                                    Pago de <strong>{habitante?.nombre_completo}</strong> a{' '}
                                    <strong>{cuentaSeleccionada?.nombre_servicio}</strong> por{' '}
                                    {metodoInfo?.label.toLowerCase()}
                                </div>

                                <div className="pfw-row">
                                    <div className={`pfw-field ${errors.referencia_bancaria ? 'pfw-field--error' : ''}`}>
                                        <label htmlFor="pfw-referencia" className="pfw-field__label">
                                            Número de referencia
                                        </label>
                                        <input
                                            id="pfw-referencia"
                                            name="referencia_bancaria"
                                            type="text"
                                            className="pfw-field__input"
                                            placeholder="Ej: 001234567890"
                                            maxLength={100}
                                            value={form.referencia_bancaria}
                                            onChange={handleChange}
                                            disabled={isSubmitting}
                                            autoFocus
                                        />
                                        {errors.referencia_bancaria && (
                                            <span className="pfw-field__error">{errors.referencia_bancaria}</span>
                                        )}
                                    </div>

                                    <div className={`pfw-field ${errors.monto ? 'pfw-field--error' : ''}`}>
                                        <label htmlFor="pfw-monto" className="pfw-field__label">Monto (Bs.)</label>
                                        <input
                                            id="pfw-monto"
                                            name="monto"
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            className="pfw-field__input"
                                            placeholder="0.00"
                                            value={form.monto}
                                            onChange={handleChange}
                                            disabled={isSubmitting}
                                        />
                                        {errors.monto && <span className="pfw-field__error">{errors.monto}</span>}
                                    </div>
                                </div>

                                <div className="pfw-row">
                                    <div className={`pfw-field ${errors.fecha_pago ? 'pfw-field--error' : ''}`}>
                                        <label htmlFor="pfw-fecha" className="pfw-field__label">Fecha del pago</label>
                                        <input
                                            id="pfw-fecha"
                                            name="fecha_pago"
                                            type="date"
                                            className="pfw-field__input"
                                            min={fechaMinima()}
                                            max={fechaLocal()}
                                            value={form.fecha_pago}
                                            onChange={handleChange}
                                            disabled={isSubmitting}
                                        />
                                        {errors.fecha_pago && <span className="pfw-field__error">{errors.fecha_pago}</span>}
                                    </div>

                                    {form.metodo_pago === 'transferencia' && (
                                        <div className={`pfw-field ${errors.banco_origen ? 'pfw-field--error' : ''}`}>
                                            <label htmlFor="pfw-banco" className="pfw-field__label">Banco de origen</label>
                                            <input
                                                id="pfw-banco"
                                                name="banco_origen"
                                                type="text"
                                                className="pfw-field__input"
                                                placeholder="Ej: Banesco"
                                                maxLength={100}
                                                value={form.banco_origen}
                                                onChange={handleChange}
                                                disabled={isSubmitting}
                                            />
                                            {errors.banco_origen && <span className="pfw-field__error">{errors.banco_origen}</span>}
                                        </div>
                                    )}
                                </div>

                                <div className={`pfw-field ${errors.concepto_pago ? 'pfw-field--error' : ''}`}>
                                    <label htmlFor="pfw-concepto" className="pfw-field__label">Concepto</label>
                                    <input
                                        id="pfw-concepto"
                                        name="concepto_pago"
                                        type="text"
                                        className="pfw-field__input"
                                        placeholder="Ej: Pago mensual de gas, cuota de servicios…"
                                        maxLength={200}
                                        value={form.concepto_pago}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    />
                                    {errors.concepto_pago && <span className="pfw-field__error">{errors.concepto_pago}</span>}
                                </div>

                                <div className={`pfw-field ${errors.comprobante ? 'pfw-field--error' : ''}`}>
                                    <span className="pfw-field__label">Foto del comprobante</span>

                                    {!previewUrl ? (
                                        <label className="pfw-upload" htmlFor="pfw-comprobante">
                                            <input
                                                id="pfw-comprobante"
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                className="pfw-upload__input"
                                                onChange={handleFileChange}
                                                disabled={isSubmitting}
                                            />
                                            <span className="pfw-upload__icon" aria-hidden="true">📷</span>
                                            <span className="pfw-upload__label">Toca para seleccionar la imagen</span>
                                            <span className="pfw-upload__hint">JPG, PNG o WEBP · máx. 5 MB</span>
                                        </label>
                                    ) : (
                                        <div className="pfw-preview">
                                            <img src={previewUrl} alt="Vista previa del comprobante" className="pfw-preview__img" />
                                            <button type="button" className="pfw-preview__quitar" onClick={quitarComprobante}>
                                                ✕ Quitar
                                            </button>
                                        </div>
                                    )}
                                    {errors.comprobante && <span className="pfw-field__error">{errors.comprobante}</span>}
                                </div>
                            </div>
                        )}

                        {/* ══ PASO 4 — Revisión ════════════════════ */}
                        {paso === 4 && (
                            <div className="pfw-paso">
                                <p className="pfw-paso__titulo">Revisa antes de registrar</p>

                                <dl className="pfw-resumen">
                                    <div className="pfw-resumen__row">
                                        <dt>Habitante</dt>
                                        <dd>
                                            {habitante?.nombre_completo}
                                            <small>Cédula {habitante?.cedula || '—'}</small>
                                        </dd>
                                    </div>
                                    <div className="pfw-resumen__row">
                                        <dt>Familia</dt>
                                        <dd>
                                            {habitante?.familia.codigo_vivienda}
                                            <small>{habitante?.familia.nombre_responsable}</small>
                                        </dd>
                                    </div>
                                    <div className="pfw-resumen__row">
                                        <dt>Método</dt>
                                        <dd>{metodoInfo?.icon} {metodoInfo?.label}</dd>
                                    </div>
                                    <div className="pfw-resumen__row">
                                        <dt>Cuenta de destino</dt>
                                        <dd>
                                            {cuentaSeleccionada?.nombre_servicio}
                                            <small>{cuentaSeleccionada?.banco} · {cuentaSeleccionada?.titular}</small>
                                        </dd>
                                    </div>
                                    {form.metodo_pago === 'transferencia' && (
                                        <div className="pfw-resumen__row">
                                            <dt>Banco de origen</dt>
                                            <dd>{form.banco_origen}</dd>
                                        </div>
                                    )}
                                    <div className="pfw-resumen__row">
                                        <dt>Referencia</dt>
                                        <dd>{form.referencia_bancaria}</dd>
                                    </div>
                                    <div className="pfw-resumen__row">
                                        <dt>Monto</dt>
                                        <dd className="pfw-resumen__monto">Bs. {montoFmt}</dd>
                                    </div>
                                    <div className="pfw-resumen__row">
                                        <dt>Fecha del pago</dt>
                                        <dd>{form.fecha_pago}</dd>
                                    </div>
                                    <div className="pfw-resumen__row">
                                        <dt>Concepto</dt>
                                        <dd>{form.concepto_pago}</dd>
                                    </div>
                                </dl>

                                {previewUrl && (
                                    <div className="pfw-preview pfw-preview--resumen">
                                        <img src={previewUrl} alt="Comprobante adjunto" className="pfw-preview__img" />
                                    </div>
                                )}

                                <p className="pfw-aviso">
                                    El pago quedará <strong>pendiente</strong> hasta que un administrador o
                                    vocero lo verifique.
                                </p>
                            </div>
                        )}

                        {/* ── Navegación del asistente ──────────── */}
                        <div className="pfw-nav">
                            {paso === 1 ? (
                                <button
                                    type="button"
                                    className="pfw-btn pfw-btn--secondary"
                                    onClick={() => navigate('/pagos')}
                                    disabled={isSubmitting}
                                >
                                    Cancelar
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="pfw-btn pfw-btn--secondary"
                                    onClick={anterior}
                                    disabled={isSubmitting}
                                >
                                    ← Atrás
                                </button>
                            )}

                            {paso < 4 ? (
                                <button
                                    type="button"
                                    className="pfw-btn pfw-btn--primary"
                                    onClick={siguiente}
                                    disabled={isSubmitting || (paso === 2 && loadingCuentas)}
                                >
                                    Siguiente →
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    className="pfw-btn pfw-btn--primary"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting
                                        ? <><span className="pfw-spinner" /> Enviando…</>
                                        : '📤 Registrar pago'}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

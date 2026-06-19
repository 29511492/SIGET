/**
 * resources/js/components/sugerencias/SugerenciaWidget.jsx
 *
 * Widget de envío y seguimiento de sugerencias.
 * Se integra en PerfilPage (rol usuario) y MiComunidad (rol vocero).
 *
 * Funcionalidad:
 *   - Selector visual de categoría (consulta, mejora, queja, emergencia)
 *   - Selector de prioridad (baja, media, alta)
 *   - Área de mensaje con contador de caracteres
 *   - Historial de sugerencias propias con estado y respuesta del admin
 *
 * Consume:
 *   POST /api/v1/sugerencias      → enviar nueva sugerencia
 *   GET  /api/v1/sugerencias/mis  → ver las propias
 *
 * FIX: El historial ahora se recarga cada vez que el usuario abre el panel
 *      de historial (toggle), para mostrar las respuestas del admin sin
 *      necesidad de recargar la página.
 */

import { useState, useEffect, useCallback } from 'react';
import apiClient                             from '../../services/axios';
import './SugerenciaWidget.css';

const CATEGORIAS = [
    { value: 'consulta',   label: 'Consulta',   icon: '❓', color: 'blue'  },
    { value: 'mejora',     label: 'Mejora',     icon: '💡', color: 'teal'  },
    { value: 'queja',      label: 'Queja',      icon: '⚠️', color: 'amber' },
    { value: 'emergencia', label: 'Emergencia', icon: '🚨', color: 'red'   },
];

const PRIORIDADES = [
    { value: 'baja',  label: 'Baja'  },
    { value: 'media', label: 'Media' },
    { value: 'alta',  label: 'Alta'  },
];

const FORM_INICIAL = { mensaje: '', categoria: 'consulta', prioridad: 'media' };

export default function SugerenciaWidget() {

    // ── Estado formulario ──────────────────────────────────────
    const [form,         setForm]         = useState(FORM_INICIAL);
    const [errors,       setErrors]       = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg,   setSuccessMsg]   = useState('');
    const [serverError,  setServerError]  = useState('');

    // ── Estado historial ───────────────────────────────────────
    const [historial,    setHistorial]    = useState([]);
    const [loadingHist,  setLoadingHist]  = useState(true);
    const [verHistorial, setVerHistorial] = useState(false);

    // ── Cargar historial propio ────────────────────────────────
    const cargarHistorial = useCallback(() => {
        setLoadingHist(true);
        apiClient.get('/v1/sugerencias/mis')
            .then(({ data }) => setHistorial(data.data))
            .catch(() => {})
            .finally(() => setLoadingHist(false));
    }, []);

    // Carga inicial al montar el componente
    useEffect(() => {
        cargarHistorial();
    }, [cargarHistorial]);

    // FIX: Recarga el historial cada vez que el usuario ABRE el panel.
    // Así las respuestas del admin aparecen sin recargar la página.
    const toggleHistorial = () => {
        const abriendo = !verHistorial;
        setVerHistorial(abriendo);
        if (abriendo) {
            cargarHistorial();
        }
    };

    // ── Handlers ───────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
        if (serverError)  setServerError('');
    };

    const validate = () => {
        const next = {};
        if (!form.mensaje.trim())          next.mensaje = 'El mensaje es obligatorio.';
        else if (form.mensaje.length < 10) next.mensaje = 'Mínimo 10 caracteres.';
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
            await apiClient.post('/v1/sugerencias', form);
            setSuccessMsg('¡Sugerencia enviada! El Consejo Comunal la revisará pronto.');
            setForm(FORM_INICIAL);
            // Recargar historial y abrir panel para que el usuario
            // vea su nueva sugerencia inmediatamente
            cargarHistorial();
            setVerHistorial(true);
        } catch (err) {
            const { status, data } = err.response ?? {};
            if (status === 422) {
                setErrors({ mensaje: data.errors?.mensaje?.[0] ?? '' });
            } else {
                setServerError('No se pudo enviar la sugerencia. Intenta de nuevo.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const getCategoriaConfig = (valor) =>
        CATEGORIAS.find(c => c.value === valor) ?? CATEGORIAS[0];

    const pendientes = historial.filter(s => !s.revisada).length;

    // ── Render ─────────────────────────────────────────────────
    return (
        <section className="sw-section" aria-label="Sugerencias y quejas">

            {/* Encabezado */}
            <div className="sw-header">
                <div className="sw-header__left">
                    <h2 className="sw-header__title">
                        <span aria-hidden="true">💬</span>
                        Sugerencias y Quejas
                    </h2>
                    <p className="sw-header__subtitle">
                        Comunícate directamente con el Consejo Comunal
                    </p>
                </div>
                {historial.length > 0 && (
                    <button
                        className="sw-header__toggle"
                        onClick={toggleHistorial}
                    >
                        {verHistorial
                            ? 'Ocultar historial'
                            : `Mis envíos (${historial.length})`
                        }
                        {pendientes > 0 && (
                            <span className="sw-badge sw-badge--pendiente">
                                {pendientes}
                            </span>
                        )}
                    </button>
                )}
            </div>

            {/* Formulario */}
            <div className="sw-form-card">

                {successMsg && (
                    <div className="sw-alert sw-alert--success" role="status">
                        <span aria-hidden="true">✅</span>
                        <span>{successMsg}</span>
                    </div>
                )}

                {serverError && (
                    <div className="sw-alert sw-alert--error" role="alert">
                        <span aria-hidden="true">⚠</span>
                        <span>{serverError}</span>
                    </div>
                )}

                <form className="sw-form" onSubmit={handleSubmit} noValidate>

                    {/* Categoría */}
                    <div className="sw-categoria-grid" role="group" aria-label="Categoría">
                        {CATEGORIAS.map(cat => (
                            <label
                                key={cat.value}
                                className={`sw-categoria-btn ${
                                    form.categoria === cat.value
                                        ? `sw-categoria-btn--active sw-categoria-btn--${cat.color}`
                                        : ''
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="categoria"
                                    value={cat.value}
                                    checked={form.categoria === cat.value}
                                    onChange={handleChange}
                                    className="sw-categoria-btn__input"
                                />
                                <span className="sw-categoria-btn__icon" aria-hidden="true">
                                    {cat.icon}
                                </span>
                                <span className="sw-categoria-btn__label">{cat.label}</span>
                            </label>
                        ))}
                    </div>

                    {/* Prioridad */}
                    <div className="sw-prioridad-row" role="group" aria-label="Prioridad">
                        <span className="sw-prioridad-row__label">Prioridad:</span>
                        <div className="sw-prioridad-options">
                            {PRIORIDADES.map(p => (
                                <label
                                    key={p.value}
                                    className={`sw-prioridad-opt ${
                                        form.prioridad === p.value
                                            ? `sw-prioridad-opt--active sw-prioridad-opt--${p.value}`
                                            : ''
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="prioridad"
                                        value={p.value}
                                        checked={form.prioridad === p.value}
                                        onChange={handleChange}
                                        className="sw-prioridad-opt__input"
                                    />
                                    {p.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Mensaje */}
                    <div className={`sw-field ${errors.mensaje ? 'sw-field--error' : ''}`}>
                        <label htmlFor="sw-mensaje" className="sw-field__label">
                            Mensaje
                            <span className="sw-field__count">
                                {form.mensaje.length}/1000
                            </span>
                        </label>
                        <textarea
                            id="sw-mensaje"
                            name="mensaje"
                            className="sw-field__textarea"
                            placeholder="Describe tu sugerencia, queja o consulta..."
                            value={form.mensaje}
                            onChange={handleChange}
                            disabled={isSubmitting}
                            maxLength={1000}
                            rows={4}
                        />
                        {errors.mensaje && (
                            <span className="sw-field__error">{errors.mensaje}</span>
                        )}
                    </div>

                    <button
                        type="submit"
                        className={`sw-submit ${isSubmitting ? 'sw-submit--loading' : ''}`}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="sw-submit__spinner" aria-hidden="true" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <span aria-hidden="true">📤</span>
                                Enviar Sugerencia
                            </>
                        )}
                    </button>

                </form>
            </div>

            {/* Historial */}
            {verHistorial && (
                <div className="sw-historial">
                    <div className="sw-historial__header">
                        <h3 className="sw-historial__titulo">Mis sugerencias enviadas</h3>
                        {/* FIX: Botón de actualizar para que el usuario pueda
                            refrescar manualmente y ver respuestas nuevas */}
                        <button
                            className="sw-historial__refresh"
                            onClick={cargarHistorial}
                            disabled={loadingHist}
                            title="Actualizar historial"
                            aria-label="Actualizar historial"
                        >
                            {loadingHist ? '⏳' : '🔄'}
                        </button>
                    </div>

                    {loadingHist ? (
                        <div className="sw-historial__loading">
                            <div className="sw-spinner" />
                        </div>
                    ) : historial.length === 0 ? (
                        <p className="sw-historial__vacio">
                            Aún no has enviado ninguna sugerencia.
                        </p>
                    ) : (
                        <div className="sw-historial__lista">
                            {historial.map(sug => {
                                const cat = getCategoriaConfig(sug.categoria);
                                return (
                                    <article key={sug.id} className="sw-item">
                                        <div className="sw-item__header">
                                            <div className="sw-item__meta">
                                                <span className={`sw-cat-badge sw-cat-badge--${cat.color}`}>
                                                    {cat.icon} {cat.label}
                                                </span>
                                                <span className={`sw-prio-badge sw-prio-badge--${sug.prioridad}`}>
                                                    {sug.prioridad}
                                                </span>
                                            </div>
                                            <div className="sw-item__estado-wrap">
                                                <span className={`sw-estado ${
                                                    sug.revisada
                                                        ? 'sw-estado--revisada'
                                                        : 'sw-estado--pendiente'
                                                }`}>
                                                    {sug.revisada ? '✓ Revisada' : '⏳ Pendiente'}
                                                </span>
                                                <span className="sw-item__fecha">
                                                    {sug.fecha_legible}
                                                </span>
                                            </div>
                                        </div>

                                        <p className="sw-item__mensaje">{sug.mensaje}</p>

                                        {/* Respuesta del admin — visible si existe */}
                                        {sug.respuesta && (
                                            <div className="sw-item__respuesta">
                                                <p className="sw-item__respuesta-label">
                                                    💬 Respuesta del Consejo Comunal:
                                                </p>
                                                <p className="sw-item__respuesta-texto">
                                                    {sug.respuesta}
                                                </p>
                                            </div>
                                        )}

                                        {/* Indicador de pendiente sin respuesta */}
                                        {!sug.revisada && !sug.respuesta && (
                                            <p className="sw-item__sin-respuesta">
                                                ⏳ En espera de revisión por el Consejo Comunal.
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

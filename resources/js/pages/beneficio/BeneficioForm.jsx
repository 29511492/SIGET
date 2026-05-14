/**
 * resources/js/pages/beneficios/BeneficioForm.jsx
 *
 * Clon de HabitanteForm.jsx para el módulo de Beneficios.
 *
 * Diferencias respecto a HabitanteForm:
 *   - Buscador de familia idéntico (mismo código copiado sin cambios)
 *   - Campos: nombre_beneficio, fecha_entrega, observaciones
 *   - user_id se inyecta en el backend (no se envía desde el frontend)
 *   - Sin sección de salud ni edades — formulario más simple
 *
 * Imports — misma ruta relativa que HabitanteForm:
 *   apiClient → '../../services/axios'
 *   useAuth   → '../../hooks/useAuth'
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../../hooks/useAuth';
import apiClient       from '../../services/axios';
import './BeneficioForm.css';

// ── Hook de debounce — copiado de HabitanteForm sin cambios ─────────────────
function useDebounce(value, delay = 400) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

const INITIAL_FORM = {
    familia_id:        '',
    nombre_beneficio:  '',
    fecha_entrega:     '',
    observaciones:     '',
};

export default function BeneficioForm() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // ── Estado principal ─────────────────────────────────────────────────────
    const [form,         setForm]         = useState(INITIAL_FORM);
    const [errors,       setErrors]       = useState({});
    const [serverError,  setServerError]  = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg,   setSuccessMsg]   = useState('');

    // ── Buscador de familia — código idéntico a HabitanteForm ────────────────
    const [busquedaFamilia,     setBusquedaFamilia]     = useState('');
    const [familiaSeleccionada, setFamiliaSeleccionada] = useState(null);
    const [familiaOpciones,     setFamiliaOpciones]     = useState([]);
    const [loadingFamilias,     setLoadingFamilias]     = useState(false);
    const [mostrarDropdown,     setMostrarDropdown]     = useState(false);
    const busquedaDebounced = useDebounce(busquedaFamilia, 400);
    const dropdownRef       = useRef(null);

    // Cerrar dropdown al clic fuera — idéntico a HabitanteForm
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setMostrarDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Búsqueda de familias con debounce — idéntico a HabitanteForm
    useEffect(() => {
        if (!busquedaDebounced || busquedaDebounced.length < 2) {
            setFamiliaOpciones([]);
            setMostrarDropdown(false);
            return;
        }

        const buscar = async () => {
            setLoadingFamilias(true);
            try {
                // GET /v1/familias?search=texto&sin_paginar=true
                // Mismo endpoint y params que HabitanteForm
                const res = await apiClient.get('/v1/familias', {
                    params: { search: busquedaDebounced, sin_paginar: true },
                });
                setFamiliaOpciones(res.data.data ?? []);
                setMostrarDropdown(true);
            } catch {
                setFamiliaOpciones([]);
            } finally {
                setLoadingFamilias(false);
            }
        };

        buscar();
    }, [busquedaDebounced]);

    // Seleccionar familia del dropdown — idéntico a HabitanteForm
    const seleccionarFamilia = (familia) => {
        setFamiliaSeleccionada(familia);
        setForm(prev => ({ ...prev, familia_id: familia.id }));
        setBusquedaFamilia(`${familia.codigo_vivienda} — ${familia.nombre_responsable}`);
        setMostrarDropdown(false);
        if (errors.familia_id) setErrors(prev => ({ ...prev, familia_id: '' }));
    };

    // Limpiar selección — idéntico a HabitanteForm
    const limpiarFamilia = () => {
        setFamiliaSeleccionada(null);
        setForm(prev => ({ ...prev, familia_id: '' }));
        setBusquedaFamilia('');
        setFamiliaOpciones([]);
    };

    // ── Cambio genérico de campo ─────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (errors[name])  setErrors(prev => ({ ...prev, [name]: '' }));
        if (serverError)   setServerError('');
    };

    // ── Validación cliente ───────────────────────────────────────────────────
    const validate = () => {
        const next = {};
        if (!form.familia_id)
            next.familia_id = 'Debes seleccionar una familia.';
        if (!form.nombre_beneficio.trim())
            next.nombre_beneficio = 'El nombre del beneficio es obligatorio.';
        if (!form.fecha_entrega)
            next.fecha_entrega = 'La fecha de entrega es obligatoria.';
        return next;
    };

    // ── Submit — misma estructura que HabitanteForm ──────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError('');
        setSuccessMsg('');

        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            document.querySelector('.beneficio-field--error')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                familia_id:       parseInt(form.familia_id),
                nombre_beneficio: form.nombre_beneficio.trim(),
                fecha_entrega:    form.fecha_entrega,
                // observaciones: null si está vacío (no string vacío)
                observaciones:    form.observaciones.trim() || null,
                // user_id NO se envía — el backend lo inyecta desde auth()->id()
                // para garantizar la trazabilidad (misma lógica que ProyectoController)
            };

            const response = await apiClient.post('/v1/beneficios', payload);
            const beneficio = response.data.data;

            setSuccessMsg(
                `✅ Beneficio "${beneficio.nombre_beneficio}" registrado correctamente.`
            );

            // Redirige a la lista igual que HabitanteForm → navigate tras 1.5s
            setTimeout(() => navigate('/beneficios'), 1500);

        } catch (err) {
            if (!err.response) {
                setServerError('Error de conexión. Verifica tu red.');
                return;
            }
            const { status, data } = err.response;
            if (status === 422) {
                setErrors(data.errors ?? {});
                setServerError(data.message ?? 'Revisa los campos marcados.');
            } else if (status === 403) {
                setServerError('No tienes permisos para registrar beneficios.');
            } else {
                setServerError(data.message ?? 'Error inesperado.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const fieldError = (name) => errors[name]?.[0] ?? errors[name] ?? '';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="beneficio-page">

            {/* Topbar — idéntico a HabitanteForm */}
            <header className="beneficio-topbar">
                <button
                    type="button"
                    className="beneficio-topbar__back"
                    onClick={() => navigate('/beneficios')}
                >
                    ← Volver a Beneficios
                </button>
                <div className="beneficio-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span>
                    <span>Beneficios</span><span>›</span>
                    <span>Registrar</span>
                </div>
            </header>

            <div className="beneficio-container">

                <div className="beneficio-heading">
                    <h1 className="beneficio-heading__title">Registrar Beneficio</h1>
                    <p className="beneficio-heading__subtitle">
                        Vincula un beneficio entregado a una familia del padrón comunal.
                    </p>
                </div>

                {successMsg && (
                    <div className="beneficio-alert beneficio-alert--success" role="status">
                        {successMsg}
                    </div>
                )}
                {serverError && (
                    <div className="beneficio-alert beneficio-alert--error" role="alert">
                        <span>⚠</span> {serverError}
                    </div>
                )}

                <form className="beneficio-form" onSubmit={handleSubmit} noValidate>

                    {/* ════════════════════════════════════════════════
                        SECCIÓN 1 — Familia vinculada
                        Buscador idéntico al de HabitanteForm
                        ════════════════════════════════════════════════ */}
                    <fieldset className="beneficio-fieldset">
                        <legend className="beneficio-fieldset__legend">
                            <span>🏠</span> Familia / Vivienda
                        </legend>

                        <div className={`beneficio-field ${fieldError('familia_id') ? 'beneficio-field--error' : ''}`}>
                            <label className="beneficio-field__label">
                                Familia <span className="required">*</span>
                            </label>

                            {/* Buscador dinámico con dropdown — código idéntico a HabitanteForm */}
                            <div className="familia-search" ref={dropdownRef}>
                                <div className="familia-search__input-wrap">
                                    <span className="familia-search__icon">🔍</span>
                                    <input
                                        type="text"
                                        value={busquedaFamilia}
                                        onChange={(e) => {
                                            setBusquedaFamilia(e.target.value);
                                            if (familiaSeleccionada) limpiarFamilia();
                                        }}
                                        placeholder="Buscar por código o responsable..."
                                        className={`familia-search__input ${familiaSeleccionada ? 'familia-search__input--selected' : ''}`}
                                        disabled={isSubmitting}
                                        autoComplete="off"
                                    />
                                    {familiaSeleccionada && (
                                        <button
                                            type="button"
                                            className="familia-search__clear"
                                            onClick={limpiarFamilia}
                                            aria-label="Limpiar selección"
                                        >
                                            ✕
                                        </button>
                                    )}
                                    {loadingFamilias && (
                                        <span className="familia-search__spinner" aria-hidden="true" />
                                    )}
                                </div>

                                {/* Dropdown de resultados */}
                                {mostrarDropdown && familiaOpciones.length > 0 && (
                                    <ul className="familia-search__dropdown" role="listbox">
                                        {familiaOpciones.map(f => (
                                            <li
                                                key={f.id}
                                                className="familia-search__option"
                                                role="option"
                                                onClick={() => seleccionarFamilia(f)}
                                            >
                                                <span className="familia-search__option-code">
                                                    {f.codigo_vivienda}
                                                </span>
                                                <span className="familia-search__option-name">
                                                    {f.nombre_responsable}
                                                </span>
                                                <span className={`familia-search__option-cond cond--${f.condicion_vivienda}`}>
                                                    {f.condicion_vivienda}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {mostrarDropdown && !loadingFamilias && familiaOpciones.length === 0 && busquedaDebounced.length >= 2 && (
                                    <div className="familia-search__empty">
                                        Sin resultados para "{busquedaDebounced}"
                                    </div>
                                )}

                                {/* Chip de familia seleccionada */}
                                {familiaSeleccionada && (
                                    <div className="familia-selected-chip">
                                        <span>✅</span>
                                        <strong>{familiaSeleccionada.codigo_vivienda}</strong>
                                        <span>—</span>
                                        <span>{familiaSeleccionada.nombre_responsable}</span>
                                    </div>
                                )}
                            </div>

                            {fieldError('familia_id') && (
                                <p className="beneficio-field__error">{fieldError('familia_id')}</p>
                            )}
                            <p className="beneficio-field__hint">
                                Escribe al menos 2 caracteres para buscar familias registradas.
                            </p>
                        </div>
                    </fieldset>

                    {/* ════════════════════════════════════════════════
                        SECCIÓN 2 — Datos del beneficio
                        ════════════════════════════════════════════════ */}
                    <fieldset className="beneficio-fieldset">
                        <legend className="beneficio-fieldset__legend">
                            <span>🎁</span> Datos del Beneficio
                        </legend>

                        {/* Nombre del beneficio — fila completa */}
                        <div className={`beneficio-field ${fieldError('nombre_beneficio') ? 'beneficio-field--error' : ''}`}>
                            <label htmlFor="nombre_beneficio" className="beneficio-field__label">
                                Nombre del beneficio <span className="required">*</span>
                            </label>
                            <input
                                id="nombre_beneficio" name="nombre_beneficio" type="text"
                                value={form.nombre_beneficio} onChange={handleChange}
                                placeholder="Ej: Caja CLAP, Silla de ruedas, Láminas de zinc..."
                                className="beneficio-field__input"
                                maxLength={200} disabled={isSubmitting}
                            />
                            {fieldError('nombre_beneficio') && (
                                <p className="beneficio-field__error">{fieldError('nombre_beneficio')}</p>
                            )}
                        </div>

                        {/* Fecha de entrega */}
                        <div className="beneficio-form-row">
                            <div className={`beneficio-field ${fieldError('fecha_entrega') ? 'beneficio-field--error' : ''}`}>
                                <label htmlFor="fecha_entrega" className="beneficio-field__label">
                                    Fecha de entrega <span className="required">*</span>
                                </label>
                                <input
                                    id="fecha_entrega" name="fecha_entrega" type="date"
                                    value={form.fecha_entrega} onChange={handleChange}
                                    max={new Date().toISOString().split('T')[0]}
                                    className="beneficio-field__input"
                                    disabled={isSubmitting}
                                />
                                {fieldError('fecha_entrega') && (
                                    <p className="beneficio-field__error">{fieldError('fecha_entrega')}</p>
                                )}
                            </div>

                            {/* Registrado por — solo lectura, informativo */}
                            <div className="beneficio-field">
                                <label className="beneficio-field__label">
                                    Registrado por
                                </label>
                                <input
                                    type="text"
                                    value={user?.name ?? '—'}
                                    readOnly
                                    disabled
                                    className="beneficio-field__input"
                                    style={{ background: '#f5f2ed', color: 'var(--c-text-light)' }}
                                />
                                <p className="beneficio-field__hint">
                                    Se asigna automáticamente al guardar.
                                </p>
                            </div>
                        </div>

                        {/* Observaciones */}
                        <div className="beneficio-field">
                            <label htmlFor="observaciones" className="beneficio-field__label">
                                Observaciones
                                <span className="beneficio-field__optional">(opcional)</span>
                            </label>
                            <textarea
                                id="observaciones" name="observaciones"
                                value={form.observaciones} onChange={handleChange}
                                placeholder="Notas adicionales sobre la entrega del beneficio..."
                                className="beneficio-field__textarea"
                                maxLength={500} disabled={isSubmitting}
                            />
                            {fieldError('observaciones') && (
                                <p className="beneficio-field__error">{fieldError('observaciones')}</p>
                            )}
                        </div>
                    </fieldset>

                    {/* ── Acciones — idéntico a HabitanteForm ──────────────── */}
                    <div className="beneficio-form-actions">
                        <button
                            type="button"
                            className="beneficio-btn beneficio-btn--secondary"
                            onClick={() => navigate('/beneficios')}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="beneficio-btn beneficio-btn--primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="beneficio-btn__spinner" aria-hidden="true" />
                                    Registrando...
                                </>
                            ) : '+ Registrar Beneficio'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

/**
 * resources/js/pages/habitantes/HabitanteForm.jsx
 *
 * ESTRUCTURA de imports desde esta ubicación:
 *   apiClient → '../../services/axios'   (2 niveles arriba)
 *   useAuth   → '../../hooks/useAuth'    (2 niveles arriba)
 *   CSS       → './HabitanteForm.css'    (mismo directorio)
 *
 * CARACTERÍSTICAS:
 *  1. Buscador dinámico de familia: escribe → debounce 400ms →
 *     GET /v1/familias?search=texto&sin_paginar=true → dropdown
 *  2. Cálculo de edad automático al ingresar fecha de nacimiento
 *  3. Sección salud condicional: tipo_discapacidad aparece
 *     solo si es_discapacitado = true
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../../hooks/useAuth';
import apiClient       from '../../services/axios';
import './HabitanteForm.css';

// ── Valores iniciales ─────────────────────────────────────────────
const INITIAL_FORM = {
    familia_id:         '',
    cedula:             '',
    nombres:            '',
    apellidos:          '',
    fecha_nacimiento:   '',
    sexo:               '',
    es_discapacitado:   false,
    tipo_discapacidad:  '',
    enfermedad_cronica: '',
    nivel_educativo:    'ninguno',
};

// ── ENUMs (de las migraciones) ────────────────────────────────────
const SEXO_OPTIONS = [
    { value: 'masculino', label: 'Masculino' },
    { value: 'femenino',  label: 'Femenino'  },
    { value: 'otro',      label: 'Otro'      },
];

const NIVEL_OPTIONS = [
    { value: 'ninguno',       label: 'Ninguno'        },
    { value: 'primaria',      label: 'Primaria'        },
    { value: 'bachillerato',  label: 'Bachillerato'    },
    { value: 'tecnico',       label: 'Técnico'         },
    { value: 'universitario', label: 'Universitario'   },
    { value: 'postgrado',     label: 'Postgrado'       },
];

// ── Hook de debounce ──────────────────────────────────────────────
function useDebounce(value, delay = 400) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

// ── Cálculo de edad ───────────────────────────────────────────────
function calcularEdad(fechaStr) {
    if (!fechaStr) return null;
    const hoy  = new Date();
    const nac  = new Date(fechaStr + 'T00:00:00');
    if (isNaN(nac)) return null;
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m  = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad >= 0 ? edad : null;
}

export default function HabitanteForm() {
    const navigate   = useNavigate();
    const { user }   = useAuth();

    // ── Estado principal ──────────────────────────────────────────
    const [form,         setForm]         = useState(INITIAL_FORM);
    const [errors,       setErrors]       = useState({});
    const [serverError,  setServerError]  = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg,   setSuccessMsg]   = useState('');

    // ── Buscador de familia ───────────────────────────────────────
    const [busquedaFamilia,   setBusquedaFamilia]   = useState('');
    const [familiaSeleccionada, setFamiliaSeleccionada] = useState(null);
    const [familiaOpciones,   setFamiliaOpciones]   = useState([]);
    const [loadingFamilias,   setLoadingFamilias]   = useState(false);
    const [mostrarDropdown,   setMostrarDropdown]   = useState(false);
    const busquedaDebounced = useDebounce(busquedaFamilia, 400);
    const dropdownRef       = useRef(null);

    // ── Edad calculada ────────────────────────────────────────────
    const edadCalculada = calcularEdad(form.fecha_nacimiento);

    // ── Cerrar dropdown al hacer clic fuera ───────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setMostrarDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Buscar familias con debounce ──────────────────────────────
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
                // sin_paginar=true devuelve array simple, no paginado
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

    // ── Seleccionar familia del dropdown ──────────────────────────
    const seleccionarFamilia = (familia) => {
        setFamiliaSeleccionada(familia);
        setForm(prev => ({ ...prev, familia_id: familia.id }));
        setBusquedaFamilia(`${familia.codigo_vivienda} — ${familia.nombre_responsable}`);
        setMostrarDropdown(false);
        if (errors.familia_id) setErrors(prev => ({ ...prev, familia_id: '' }));
    };

    // ── Limpiar selección de familia ──────────────────────────────
    const limpiarFamilia = () => {
        setFamiliaSeleccionada(null);
        setForm(prev => ({ ...prev, familia_id: '' }));
        setBusquedaFamilia('');
        setFamiliaOpciones([]);
    };

    // ── Cambio genérico de campo ──────────────────────────────────
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;

        setForm(prev => ({
            ...prev,
            [name]: newValue,
            // Si se desmarca es_discapacitado, limpiar tipo_discapacidad
            ...(name === 'es_discapacitado' && !checked
                ? { tipo_discapacidad: '' }
                : {}),
        }));

        if (errors[name])  setErrors(prev => ({ ...prev, [name]: '' }));
        if (serverError)   setServerError('');
    };

    // ── Validación cliente ────────────────────────────────────────
    const validate = () => {
        const next = {};

        if (!form.familia_id)
            next.familia_id = 'Debes seleccionar una familia.';
        if (!form.nombres.trim())
            next.nombres = 'Los nombres son obligatorios.';
        if (!form.apellidos.trim())
            next.apellidos = 'Los apellidos son obligatorios.';
        if (!form.fecha_nacimiento)
            next.fecha_nacimiento = 'La fecha de nacimiento es obligatoria.';
        else if (edadCalculada !== null && edadCalculada < 0)
            next.fecha_nacimiento = 'La fecha no puede ser futura.';
        if (!form.sexo)
            next.sexo = 'Debes seleccionar el sexo.';
        if (form.es_discapacitado && !form.tipo_discapacidad.trim())
            next.tipo_discapacidad = 'Describe el tipo de discapacidad.';
        if (form.cedula && form.cedula.length > 15)
            next.cedula = 'La cédula no puede tener más de 15 caracteres.';

        return next;
    };

    // ── Submit ────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError('');
        setSuccessMsg('');

        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            document.querySelector('.habitante-field--error')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...form,
                familia_id:       parseInt(form.familia_id),
                es_discapacitado: Boolean(form.es_discapacitado),
                // Si no hay cédula, enviar null (no string vacío)
                cedula: form.cedula.trim() || null,
                // Si no hay tipo_discapacidad, enviar null
                tipo_discapacidad:  form.tipo_discapacidad.trim()  || null,
                enfermedad_cronica: form.enfermedad_cronica.trim() || null,
            };

            const response = await apiClient.post('/v1/habitantes', payload);
            const habitante = response.data.data;

            setSuccessMsg(
                `✅ ${habitante.nombre_completo} registrado correctamente` +
                (habitante.edad !== null ? ` (${habitante.edad} años).` : '.')
            );

            setTimeout(() => navigate('/dashboard'), 1500);

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
                setServerError('No tienes permisos para registrar habitantes.');
            } else {
                setServerError(data.message ?? 'Error inesperado.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const fieldError = (name) => errors[name]?.[0] ?? errors[name] ?? '';

    // ─────────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="habitante-page">

            {/* ── Topbar ─────────────────────────────────────────── */}
            <header className="habitante-topbar">
                <button
                    type="button"
                    className="habitante-topbar__back"
                    onClick={() => navigate('/dashboard')}
                >
                    ← Volver al Dashboard
                </button>
                <div className="habitante-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span>
                    <span>Habitantes</span><span>›</span>
                    <span>Registrar</span>
                </div>
            </header>

            <div className="habitante-container">

                <div className="habitante-heading">
                    <h1 className="habitante-heading__title">
                        Registrar Habitante
                    </h1>
                    <p className="habitante-heading__subtitle">
                        Incorpora un nuevo miembro al padrón comunal.
                    </p>
                </div>

                {successMsg && (
                    <div className="habitante-alert habitante-alert--success" role="status">
                        {successMsg}
                    </div>
                )}
                {serverError && (
                    <div className="habitante-alert habitante-alert--error" role="alert">
                        <span>⚠</span> {serverError}
                    </div>
                )}

                <form className="habitante-form" onSubmit={handleSubmit} noValidate>

                    {/* ════════════════════════════════════════════
                        SECCIÓN 1 — Familia vinculada (buscador)
                        ════════════════════════════════════════════ */}
                    <fieldset className="habitante-fieldset">
                        <legend className="habitante-fieldset__legend">
                            <span>🏠</span> Familia / Vivienda
                        </legend>

                        <div className={`habitante-field ${fieldError('familia_id') ? 'habitante-field--error' : ''}`}>
                            <label className="habitante-field__label">
                                Familia <span className="required">*</span>
                            </label>

                            {/* Buscador dinámico con dropdown */}
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
                                <p className="habitante-field__error">{fieldError('familia_id')}</p>
                            )}
                            <p className="habitante-field__hint">
                                Escribe al menos 2 caracteres para buscar familias registradas.
                            </p>
                        </div>
                    </fieldset>

                    {/* ════════════════════════════════════════════
                        SECCIÓN 2 — Datos personales
                        ════════════════════════════════════════════ */}
                    <fieldset className="habitante-fieldset">
                        <legend className="habitante-fieldset__legend">
                            <span>👤</span> Datos Personales
                        </legend>

                        <div className="habitante-form-row">
                            <div className={`habitante-field ${fieldError('nombres') ? 'habitante-field--error' : ''}`}>
                                <label htmlFor="nombres" className="habitante-field__label">
                                    Nombres <span className="required">*</span>
                                </label>
                                <input
                                    id="nombres" name="nombres" type="text"
                                    value={form.nombres} onChange={handleChange}
                                    placeholder="Ej: Carlos Alberto"
                                    className="habitante-field__input"
                                    maxLength={100} disabled={isSubmitting}
                                />
                                {fieldError('nombres') && <p className="habitante-field__error">{fieldError('nombres')}</p>}
                            </div>

                            <div className={`habitante-field ${fieldError('apellidos') ? 'habitante-field--error' : ''}`}>
                                <label htmlFor="apellidos" className="habitante-field__label">
                                    Apellidos <span className="required">*</span>
                                </label>
                                <input
                                    id="apellidos" name="apellidos" type="text"
                                    value={form.apellidos} onChange={handleChange}
                                    placeholder="Ej: Pérez González"
                                    className="habitante-field__input"
                                    maxLength={100} disabled={isSubmitting}
                                />
                                {fieldError('apellidos') && <p className="habitante-field__error">{fieldError('apellidos')}</p>}
                            </div>
                        </div>

                        <div className="habitante-form-row habitante-form-row--three">
                            {/* Cédula */}
                            <div className={`habitante-field ${fieldError('cedula') ? 'habitante-field--error' : ''}`}>
                                <label htmlFor="cedula" className="habitante-field__label">
                                    Cédula
                                    <span className="habitante-field__optional">(opcional)</span>
                                </label>
                                <input
                                    id="cedula" name="cedula" type="text"
                                    value={form.cedula} onChange={handleChange}
                                    placeholder="Ej: V-12345678"
                                    className="habitante-field__input"
                                    maxLength={15} disabled={isSubmitting}
                                />
                                {fieldError('cedula') && <p className="habitante-field__error">{fieldError('cedula')}</p>}
                            </div>

                            {/* Fecha de nacimiento con cálculo de edad */}
                            <div className={`habitante-field ${fieldError('fecha_nacimiento') ? 'habitante-field--error' : ''}`}>
                                <label htmlFor="fecha_nacimiento" className="habitante-field__label">
                                    Fecha de nacimiento <span className="required">*</span>
                                </label>
                                <div className="habitante-date-wrap">
                                    <input
                                        id="fecha_nacimiento" name="fecha_nacimiento"
                                        type="date"
                                        value={form.fecha_nacimiento}
                                        onChange={handleChange}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="habitante-field__input"
                                        disabled={isSubmitting}
                                    />
                                    {/* Badge de edad calculada */}
                                    {edadCalculada !== null && edadCalculada >= 0 && (
                                        <span className="edad-badge">
                                            {edadCalculada} años
                                        </span>
                                    )}
                                </div>
                                {fieldError('fecha_nacimiento') && <p className="habitante-field__error">{fieldError('fecha_nacimiento')}</p>}
                            </div>

                            {/* Sexo */}
                            <div className={`habitante-field ${fieldError('sexo') ? 'habitante-field--error' : ''}`}>
                                <label htmlFor="sexo" className="habitante-field__label">
                                    Sexo <span className="required">*</span>
                                </label>
                                <select
                                    id="sexo" name="sexo"
                                    value={form.sexo} onChange={handleChange}
                                    className="habitante-field__select"
                                    disabled={isSubmitting}
                                >
                                    <option value="">— Seleccionar —</option>
                                    {SEXO_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                {fieldError('sexo') && <p className="habitante-field__error">{fieldError('sexo')}</p>}
                            </div>
                        </div>

                        {/* Nivel educativo */}
                        <div className={`habitante-field ${fieldError('nivel_educativo') ? 'habitante-field--error' : ''}`}>
                            <label htmlFor="nivel_educativo" className="habitante-field__label">
                                Nivel de instrucción <span className="required">*</span>
                            </label>
                            <div className="nivel-radio-group">
                                {NIVEL_OPTIONS.map(opt => (
                                    <label key={opt.value} className={`nivel-radio ${form.nivel_educativo === opt.value ? 'nivel-radio--active' : ''}`}>
                                        <input
                                            type="radio"
                                            name="nivel_educativo"
                                            value={opt.value}
                                            checked={form.nivel_educativo === opt.value}
                                            onChange={handleChange}
                                            disabled={isSubmitting}
                                        />
                                        {opt.label}
                                    </label>
                                ))}
                            </div>
                            {fieldError('nivel_educativo') && <p className="habitante-field__error">{fieldError('nivel_educativo')}</p>}
                        </div>
                    </fieldset>

                    {/* ════════════════════════════════════════════
                        SECCIÓN 3 — Salud (condicional)
                        ════════════════════════════════════════════ */}
                    <fieldset className="habitante-fieldset">
                        <legend className="habitante-fieldset__legend">
                            <span>🏥</span> Indicadores de Salud
                        </legend>

                        {/* Toggle: Discapacidad */}
                        <div className="habitante-field">
                            <label className="habitante-toggle" htmlFor="es_discapacitado">
                                <input
                                    id="es_discapacitado" name="es_discapacitado"
                                    type="checkbox"
                                    checked={form.es_discapacitado}
                                    onChange={handleChange}
                                    className="habitante-toggle__input"
                                    disabled={isSubmitting}
                                />
                                <span className="habitante-toggle__track" aria-hidden="true" />
                                <span className="habitante-toggle__label">
                                    {form.es_discapacitado
                                        ? '♿ Tiene alguna discapacidad'
                                        : '♿ Sin discapacidad registrada'}
                                </span>
                            </label>
                        </div>

                        {/* Campo condicional: tipo de discapacidad */}
                        {form.es_discapacitado && (
                            <div className={`habitante-field habitante-field--conditional ${fieldError('tipo_discapacidad') ? 'habitante-field--error' : ''}`}>
                                <label htmlFor="tipo_discapacidad" className="habitante-field__label">
                                    Tipo de discapacidad <span className="required">*</span>
                                </label>
                                <input
                                    id="tipo_discapacidad" name="tipo_discapacidad"
                                    type="text"
                                    value={form.tipo_discapacidad}
                                    onChange={handleChange}
                                    placeholder="Ej: Motora, Visual, Auditiva, Cognitiva..."
                                    className="habitante-field__input"
                                    maxLength={100} disabled={isSubmitting}
                                    autoFocus
                                />
                                {fieldError('tipo_discapacidad') && (
                                    <p className="habitante-field__error">{fieldError('tipo_discapacidad')}</p>
                                )}
                            </div>
                        )}

                        {/* Enfermedad crónica */}
                        <div className="habitante-field">
                            <label htmlFor="enfermedad_cronica" className="habitante-field__label">
                                Enfermedad crónica
                                <span className="habitante-field__optional">(opcional)</span>
                            </label>
                            <input
                                id="enfermedad_cronica" name="enfermedad_cronica"
                                type="text"
                                value={form.enfermedad_cronica}
                                onChange={handleChange}
                                placeholder="Ej: Diabetes, Hipertensión, Asma..."
                                className="habitante-field__input"
                                maxLength={150} disabled={isSubmitting}
                            />
                        </div>
                    </fieldset>

                    {/* ── Acciones ───────────────────────────────── */}
                    <div className="habitante-form-actions">
                        <button
                            type="button"
                            className="habitante-btn habitante-btn--secondary"
                            onClick={() => navigate('/dashboard')}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={`habitante-btn habitante-btn--primary ${isSubmitting ? 'habitante-btn--loading' : ''}`}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="habitante-btn__spinner" aria-hidden="true" />
                                    Registrando...
                                </>
                            ) : '+ Registrar Habitante'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

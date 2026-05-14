/**
 * resources/js/pages/familias/FamiliaForm.jsx
 *
 * Formulario de registro de familia.
 * Vive en: resources/js/pages/familias/
 *
 * IMPORTS relativos desde esta carpeta:
 *   apiClient → '../../services/axios'   (2 niveles arriba)
 *   useAuth   → '../../hooks/useAuth'    (2 niveles arriba)
 *   CSS       → './FamiliaForm.css'      (mismo directorio)
 *
 * FLUJO DE DATOS:
 *  1. Al montar: GET /v1/sedes → llena select de Sede
 *  2. Al cambiar sede: GET /v1/sedes/{id}/calles → llena select de Calle
 *  3. Al enviar: POST /v1/familias → crea registro
 *  4. En éxito: redirige al Dashboard (el contador se actualiza solo)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate }  from 'react-router-dom';
import { useAuth }      from '../../hooks/useAuth';
import apiClient        from '../../services/axios';
import './FamiliaForm.css';

// ── Valores iniciales del formulario ─────────────────────────────
const INITIAL_FORM = {
    codigo_vivienda:    '',
    nombre_responsable: '',
    sede_id:            '',
    calle_id:           '',
    condicion_vivienda: 'regular',
    cantidad_bombonas:  1,
    capacidad_bombona:  '10kg',
    posee_agua_potable: true,
    punto_referencia:   '',
};

// ── Opciones estáticas de los ENUMs (vienen de las migraciones) ───
const CONDICION_OPTIONS = [
    { value: 'optima',  label: 'Óptima'  },
    { value: 'regular', label: 'Regular' },
    { value: 'critica', label: 'Crítica' },
];

const CAPACIDAD_OPTIONS = [
    { value: '10kg', label: '10 kg' },
    { value: '18kg', label: '18 kg' },
    { value: '43kg', label: '43 kg' },
];

export default function FamiliaForm() {
    const navigate      = useNavigate();
    const { user }      = useAuth();

    // ── Estado del formulario ─────────────────────────────────────
    const [form,         setForm]         = useState(INITIAL_FORM);
    const [errors,       setErrors]       = useState({});
    const [serverError,  setServerError]  = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg,   setSuccessMsg]   = useState('');

    // ── Estado de los selects encadenados ─────────────────────────
    const [sedes,          setSedes]          = useState([]);
    const [calles,         setCalles]         = useState([]);
    const [loadingSedes,   setLoadingSedes]   = useState(true);
    const [loadingCalles,  setLoadingCalles]  = useState(false);

    // ── 1. Cargar sedes al montar ─────────────────────────────────
    useEffect(() => {
        const fetchSedes = async () => {
            try {
                const res = await apiClient.get('/v1/sedes');
                setSedes(res.data.data);
            } catch {
                setServerError('No se pudieron cargar las sedes. Recarga la página.');
            } finally {
                setLoadingSedes(false);
            }
        };
        fetchSedes();
    }, []);

    // ── 2. Cargar calles cuando cambia la sede ────────────────────
    const fetchCalles = useCallback(async (sedeId) => {
        if (!sedeId) {
            setCalles([]);
            return;
        }
        setLoadingCalles(true);
        setCalles([]);
        setForm(prev => ({ ...prev, calle_id: '' })); // Reset calle al cambiar sede

        try {
            const res = await apiClient.get(`/v1/sedes/${sedeId}/calles`);
            setCalles(res.data.data);
        } catch {
            setServerError('No se pudieron cargar las calles de esta sede.');
        } finally {
            setLoadingCalles(false);
        }
    }, []);

    // ── Manejador genérico de cambio de campo ─────────────────────
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;

        setForm(prev => ({ ...prev, [name]: newValue }));

        // Limpiar error del campo al modificarlo
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
        if (serverError)  setServerError('');

        // Select encadenado: si cambia la sede, recargar calles
        if (name === 'sede_id') fetchCalles(value);
    };

    // ── Validación cliente (complementa la del backend) ───────────
    const validate = () => {
        const next = {};

        if (!form.codigo_vivienda.trim())
            next.codigo_vivienda = 'El código de vivienda es obligatorio.';
        else if (form.codigo_vivienda.length > 20)
            next.codigo_vivienda = 'Máximo 20 caracteres.';

        if (!form.nombre_responsable.trim())
            next.nombre_responsable = 'El responsable de la familia es obligatorio.';

        if (!form.sede_id)
            next.sede_id = 'Debes seleccionar una sede.';

        if (!form.calle_id)
            next.calle_id = 'Debes seleccionar una calle.';

        if (!form.condicion_vivienda)
            next.condicion_vivienda = 'Selecciona la condición de la vivienda.';

        if (!form.capacidad_bombona)
            next.capacidad_bombona = 'Selecciona la capacidad de bombona.';

        if (form.cantidad_bombonas < 0 || form.cantidad_bombonas > 99)
            next.cantidad_bombonas = 'La cantidad debe ser entre 0 y 99.';

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
            // Scroll al primer error
            document.querySelector('.familia-field--error')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setIsSubmitting(true);

        try {
            /**
             * POST /api/v1/familias
             * El backend (StoreFamiliaRequest) revalida todo.
             * Familia::create() dispara booted() → Cache::forget('dashboard_stats')
             * El Dashboard mostrará el nuevo total en la próxima carga.
             */
            const response = await apiClient.post('/v1/familias', {
                ...form,
                // Asegurar tipos correctos antes de enviar
                sede_id:            parseInt(form.sede_id),
                calle_id:           parseInt(form.calle_id),
                cantidad_bombonas:  parseInt(form.cantidad_bombonas),
                posee_agua_potable: Boolean(form.posee_agua_potable),
            });

            const familia = response.data.data;
            setSuccessMsg(
                `✅ Familia "${familia.nombre_responsable}" (${familia.codigo_vivienda}) registrada correctamente.`
            );

            // Redirigir al dashboard tras 1.5 segundos para ver el mensaje
            setTimeout(() => navigate('/dashboard'), 1500);

        } catch (err) {
            if (!err.response) {
                setServerError('Error de conexión. Verifica tu red e intenta de nuevo.');
                return;
            }

            const { status, data } = err.response;

            if (status === 422) {
                // Mapear errores del backend al estado local
                const backendErrors = data.errors ?? {};
                setErrors(backendErrors);
                setServerError(data.message ?? 'Revisa los campos marcados.');
            } else if (status === 403) {
                setServerError('No tienes permisos para registrar familias.');
            } else {
                setServerError(data.message ?? 'Error inesperado. Intenta de nuevo.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Helper de renderizado de campo ────────────────────────────
    // Extrae la lógica repetitiva del campo en una función
    const fieldError = (name) => errors[name]?.[0] ?? errors[name] ?? '';

    // ─────────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="familia-form-page">

            {/* ── Topbar de navegación ───────────────────────────── */}
            <header className="familia-form-topbar">
                <button
                    className="familia-form-topbar__back"
                    onClick={() => navigate('/dashboard')}
                    type="button"
                >
                    ← Volver al Dashboard
                </button>
                <div className="familia-form-topbar__breadcrumb">
                    <span>SIGET</span>
                    <span>›</span>
                    <span>Familias</span>
                    <span>›</span>
                    <span>Registrar</span>
                </div>
            </header>

            <div className="familia-form-container">

                {/* ── Encabezado de la página ────────────────────── */}
                <div className="familia-form-heading">
                    <h1 className="familia-form-heading__title">
                        Registrar Nueva Familia
                    </h1>
                    <p className="familia-form-heading__subtitle">
                        Complete todos los campos obligatorios para incorporar
                        la familia al censo comunal.
                    </p>
                </div>

                {/* ── Alerta de éxito ────────────────────────────── */}
                {successMsg && (
                    <div className="familia-alert familia-alert--success" role="status">
                        {successMsg}
                    </div>
                )}

                {/* ── Alerta de error global ─────────────────────── */}
                {serverError && (
                    <div className="familia-alert familia-alert--error" role="alert">
                        <span>⚠</span> {serverError}
                    </div>
                )}

                <form
                    className="familia-form"
                    onSubmit={handleSubmit}
                    noValidate
                >

                    {/* ════════════════════════════════════════════
                        SECCIÓN 1 — Identificación de la vivienda
                        ════════════════════════════════════════════ */}
                    <fieldset className="familia-fieldset">
                        <legend className="familia-fieldset__legend">
                            <span>🏠</span> Identificación de la Vivienda
                        </legend>

                        <div className="familia-form-row">

                            {/* Código de vivienda */}
                            <div className={`familia-field ${fieldError('codigo_vivienda') ? 'familia-field--error' : ''}`}>
                                <label htmlFor="codigo_vivienda" className="familia-field__label">
                                    Código de vivienda <span className="required">*</span>
                                </label>
                                <input
                                    id="codigo_vivienda"
                                    name="codigo_vivienda"
                                    type="text"
                                    value={form.codigo_vivienda}
                                    onChange={handleChange}
                                    placeholder="Ej: VIV-001"
                                    className="familia-field__input"
                                    maxLength={20}
                                    disabled={isSubmitting}
                                    autoComplete="off"
                                />
                                {fieldError('codigo_vivienda') && (
                                    <p className="familia-field__error">
                                        {fieldError('codigo_vivienda')}
                                    </p>
                                )}
                            </div>

                            {/* Responsable de la familia */}
                            <div className={`familia-field ${fieldError('nombre_responsable') ? 'familia-field--error' : ''}`}>
                                <label htmlFor="nombre_responsable" className="familia-field__label">
                                    Apellido familiar / Responsable <span className="required">*</span>
                                </label>
                                <input
                                    id="nombre_responsable"
                                    name="nombre_responsable"
                                    type="text"
                                    value={form.nombre_responsable}
                                    onChange={handleChange}
                                    placeholder="Ej: Familia Pérez"
                                    className="familia-field__input"
                                    maxLength={100}
                                    disabled={isSubmitting}
                                />
                                {fieldError('nombre_responsable') && (
                                    <p className="familia-field__error">
                                        {fieldError('nombre_responsable')}
                                    </p>
                                )}
                            </div>

                        </div>

                        {/* Punto de referencia */}
                        <div className={`familia-field ${fieldError('punto_referencia') ? 'familia-field--error' : ''}`}>
                            <label htmlFor="punto_referencia" className="familia-field__label">
                                Punto de referencia
                                <span className="familia-field__optional">(opcional)</span>
                            </label>
                            <input
                                id="punto_referencia"
                                name="punto_referencia"
                                type="text"
                                value={form.punto_referencia}
                                onChange={handleChange}
                                placeholder="Ej: A 50m de la escuela, casa azul"
                                className="familia-field__input"
                                maxLength={255}
                                disabled={isSubmitting}
                            />
                        </div>

                    </fieldset>

                    {/* ════════════════════════════════════════════
                        SECCIÓN 2 — Ubicación (Select encadenado)
                        ════════════════════════════════════════════ */}
                    <fieldset className="familia-fieldset">
                        <legend className="familia-fieldset__legend">
                            <span>📍</span> Ubicación
                        </legend>

                        <div className="familia-form-row">

                            {/* Sede */}
                            <div className={`familia-field ${fieldError('sede_id') ? 'familia-field--error' : ''}`}>
                                <label htmlFor="sede_id" className="familia-field__label">
                                    Sede <span className="required">*</span>
                                </label>
                                <select
                                    id="sede_id"
                                    name="sede_id"
                                    value={form.sede_id}
                                    onChange={handleChange}
                                    className="familia-field__select"
                                    disabled={isSubmitting || loadingSedes}
                                >
                                    <option value="">
                                        {loadingSedes ? 'Cargando sedes...' : '— Selecciona una sede —'}
                                    </option>
                                    {sedes.map(sede => (
                                        <option key={sede.id} value={sede.id}>
                                            {sede.nombre}
                                        </option>
                                    ))}
                                </select>
                                {fieldError('sede_id') && (
                                    <p className="familia-field__error">
                                        {fieldError('sede_id')}
                                    </p>
                                )}
                            </div>

                            {/* Calle — se carga dinámicamente según la sede */}
                            <div className={`familia-field ${fieldError('calle_id') ? 'familia-field--error' : ''}`}>
                                <label htmlFor="calle_id" className="familia-field__label">
                                    Calle / Avenida <span className="required">*</span>
                                </label>
                                <select
                                    id="calle_id"
                                    name="calle_id"
                                    value={form.calle_id}
                                    onChange={handleChange}
                                    className="familia-field__select"
                                    disabled={isSubmitting || loadingCalles || !form.sede_id}
                                >
                                    <option value="">
                                        {!form.sede_id
                                            ? '— Primero selecciona una sede —'
                                            : loadingCalles
                                                ? 'Cargando calles...'
                                                : calles.length === 0
                                                    ? 'Sin calles registradas para esta sede'
                                                    : '— Selecciona una calle —'
                                        }
                                    </option>
                                    {calles.map(calle => (
                                        <option key={calle.id} value={calle.id}>
                                            {calle.nombre}
                                        </option>
                                    ))}
                                </select>
                                {fieldError('calle_id') && (
                                    <p className="familia-field__error">
                                        {fieldError('calle_id')}
                                    </p>
                                )}
                                {/* Indicador visual de select encadenado */}
                                {form.sede_id && loadingCalles && (
                                    <p className="familia-field__hint">
                                        ⏳ Cargando calles de la sede seleccionada...
                                    </p>
                                )}
                            </div>

                        </div>
                    </fieldset>

                    {/* ════════════════════════════════════════════
                        SECCIÓN 3 — Condición e infraestructura
                        ════════════════════════════════════════════ */}
                    <fieldset className="familia-fieldset">
                        <legend className="familia-fieldset__legend">
                            <span>🔧</span> Condición e Infraestructura
                        </legend>

                        <div className="familia-form-row familia-form-row--three">

                            {/* Condición de vivienda */}
                            <div className={`familia-field ${fieldError('condicion_vivienda') ? 'familia-field--error' : ''}`}>
                                <label htmlFor="condicion_vivienda" className="familia-field__label">
                                    Condición <span className="required">*</span>
                                </label>
                                <select
                                    id="condicion_vivienda"
                                    name="condicion_vivienda"
                                    value={form.condicion_vivienda}
                                    onChange={handleChange}
                                    className={`familia-field__select familia-field__select--condicion-${form.condicion_vivienda}`}
                                    disabled={isSubmitting}
                                >
                                    {CONDICION_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Capacidad de bombona */}
                            <div className={`familia-field ${fieldError('capacidad_bombona') ? 'familia-field--error' : ''}`}>
                                <label htmlFor="capacidad_bombona" className="familia-field__label">
                                    Capacidad de bombona <span className="required">*</span>
                                </label>
                                <select
                                    id="capacidad_bombona"
                                    name="capacidad_bombona"
                                    value={form.capacidad_bombona}
                                    onChange={handleChange}
                                    className="familia-field__select"
                                    disabled={isSubmitting}
                                >
                                    {CAPACIDAD_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Cantidad de bombonas */}
                            <div className={`familia-field ${fieldError('cantidad_bombonas') ? 'familia-field--error' : ''}`}>
                                <label htmlFor="cantidad_bombonas" className="familia-field__label">
                                    Cant. bombonas <span className="required">*</span>
                                </label>
                                <input
                                    id="cantidad_bombonas"
                                    name="cantidad_bombonas"
                                    type="number"
                                    value={form.cantidad_bombonas}
                                    onChange={handleChange}
                                    min={0}
                                    max={99}
                                    className="familia-field__input"
                                    disabled={isSubmitting}
                                />
                                {fieldError('cantidad_bombonas') && (
                                    <p className="familia-field__error">
                                        {fieldError('cantidad_bombonas')}
                                    </p>
                                )}
                            </div>

                        </div>

                        {/* Agua potable — toggle visual */}
                        <div className="familia-field familia-field--inline">
                            <label className="familia-toggle" htmlFor="posee_agua_potable">
                                <input
                                    id="posee_agua_potable"
                                    name="posee_agua_potable"
                                    type="checkbox"
                                    checked={form.posee_agua_potable}
                                    onChange={handleChange}
                                    className="familia-toggle__input"
                                    disabled={isSubmitting}
                                />
                                <span className="familia-toggle__track" aria-hidden="true" />
                                <span className="familia-toggle__label">
                                    {form.posee_agua_potable
                                        ? '💧 Tiene acceso a agua potable'
                                        : '🚫 Sin acceso a agua potable'}
                                </span>
                            </label>
                        </div>

                    </fieldset>

                    {/* ── Botones de acción ──────────────────────── */}
                    <div className="familia-form-actions">
                        <button
                            type="button"
                            className="familia-btn familia-btn--secondary"
                            onClick={() => navigate('/dashboard')}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            className={`familia-btn familia-btn--primary ${isSubmitting ? 'familia-btn--loading' : ''}`}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="familia-btn__spinner" aria-hidden="true" />
                                    Registrando...
                                </>
                            ) : (
                                '+ Registrar Familia'
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

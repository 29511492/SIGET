/**
 * resources/js/pages/proyectos/ProyectoForm.jsx
 *
 * Metodología idéntica a HabitanteForm.jsx:
 *   apiClient → '../../services/axios'
 *   useAuth   → '../../hooks/useAuth'
 *   CSS       → './ProyectoForm.css'
 *
 * Ruta: /proyectos/crear   → crea nuevo proyecto
 *       /proyectos/:id/editar → edita existente
 *
 * Carga los datos del form (sedes + comités) con 1 petición
 * GET /v1/proyectos/form-data (Patrón BFF, igual que VoceroForm).
 * Si es edición, carga el proyecto con GET /v1/proyectos/:id.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth }  from '../../hooks/useAuth';
import apiClient    from '../../services/axios';
import './ProyectoForm.css';

// ── Valores iniciales ────────────────────────────────────────────────────────
const INITIAL_FORM = {
    nombre_proyecto:       '',
    objetivo:              '',
    monto_aprobado:        '',
    fuente_financiamiento: '',
    estatus:               'presentado',
    fecha_inicio:          '',
    fecha_fin:             '',
    sede_id:               '',
    comite_id:             '',
};

// ── ENUMs (de la migración) ──────────────────────────────────────────────────
const FUENTES = [
    { value: 'CFG',         label: 'CFG'         },
    { value: 'Alcaldia',    label: 'Alcaldía'    },
    { value: 'Gobernacion', label: 'Gobernación' },
    { value: 'Autogestion', label: 'Autogestión' },
];

const ESTATUS_OPTS = [
    { value: 'presentado',   label: 'Presentado'   },
    { value: 'aprobado',     label: 'Aprobado'     },
    { value: 'en_ejecucion', label: 'En ejecución' },
    { value: 'finalizado',   label: 'Finalizado'   },
    { value: 'paralizado',   label: 'Paralizado'   },
];

// Estatus que muestran los campos de fecha
const REQUIERE_FECHAS = ['aprobado', 'en_ejecucion', 'finalizado', 'paralizado'];

export default function ProyectoForm() {
    const navigate      = useNavigate();
    const { id }        = useParams();           // undefined en /crear, número en /editar
    const { user }      = useAuth();
    const isEditing     = Boolean(id);

    // ── Estado principal ─────────────────────────────────────────────────────
    const [form,         setForm]         = useState(INITIAL_FORM);
    const [sedes,        setSedes]        = useState([]);
    const [comites,      setComites]      = useState([]);
    const [errors,       setErrors]       = useState({});
    const [serverError,  setServerError]  = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg,   setSuccessMsg]   = useState('');
    const [loadingData,  setLoadingData]  = useState(true);

    // ── Carga inicial — misma estructura que HabitanteForm ───────────────────
    // 1. GET /v1/proyectos/form-data  → sedes + comités (BFF, 1 petición)
    // 2. Si es edición: GET /v1/proyectos/:id → pre-popula el formulario
    useEffect(() => {
        const cargarDatos = async () => {
            setLoadingData(true);
            try {
                // Petición 1: datos del formulario
                const resFd = await apiClient.get('/v1/proyectos/form-data');
                setSedes(resFd.data.data.sedes);
                setComites(resFd.data.data.comites);

                // Petición 2 (solo edición): proyecto actual
                if (isEditing) {
                    const resP = await apiClient.get(`/v1/proyectos/${id}`);
                    const p    = resP.data.data;
                    setForm({
                        nombre_proyecto:       p.nombre_proyecto        ?? '',
                        objetivo:              p.objetivo                ?? '',
                        monto_aprobado:        p.monto_aprobado          ?? '',
                        fuente_financiamiento: p.fuente_financiamiento   ?? '',
                        estatus:               p.estatus                 ?? 'presentado',
                        fecha_inicio:          p.fecha_inicio             ?? '',
                        fecha_fin:             p.fecha_fin                ?? '',
                        sede_id:               p.sede_id    != null ? String(p.sede_id)    : '',
                        comite_id:             p.comite_id  != null ? String(p.comite_id)  : '',
                    });
                }
            } catch (err) {
                setServerError(
                    err.response?.data?.message ?? 'No se pudieron cargar los datos del formulario.'
                );
            } finally {
                setLoadingData(false);
            }
        };

        cargarDatos();
    }, [id]);

    // ── Cambio genérico de campo — idéntico a HabitanteForm ─────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;

        setForm(prev => ({
            ...prev,
            [name]: value,
            // Si el estatus vuelve a 'presentado', limpia las fechas
            ...(name === 'estatus' && value === 'presentado'
                ? { fecha_inicio: '', fecha_fin: '' }
                : {}),
        }));

        if (errors[name])  setErrors(prev => ({ ...prev, [name]: '' }));
        if (serverError)   setServerError('');
    };

    // ── Validación cliente ───────────────────────────────────────────────────
    const validate = () => {
        const next = {};
        if (!form.nombre_proyecto.trim())
            next.nombre_proyecto = 'El nombre del proyecto es obligatorio.';
        if (!form.objetivo.trim())
            next.objetivo = 'El objetivo del proyecto es obligatorio.';
        if (!form.fuente_financiamiento)
            next.fuente_financiamiento = 'Debes seleccionar una fuente de financiamiento.';
        if (!form.estatus)
            next.estatus = 'Debes seleccionar un estatus.';
        if (form.monto_aprobado !== '' && isNaN(Number(form.monto_aprobado)))
            next.monto_aprobado = 'El monto debe ser un número válido.';
        if (REQUIERE_FECHAS.includes(form.estatus) && form.fecha_inicio && form.fecha_fin) {
            if (form.fecha_fin < form.fecha_inicio)
                next.fecha_fin = 'La fecha de fin debe ser igual o posterior a la de inicio.';
        }
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
            document.querySelector('.proyecto-field--error')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setIsSubmitting(true);
        try {
            // Normaliza campos opcionales antes de enviar
            const payload = {
                ...form,
                sede_id:       form.sede_id       !== '' ? parseInt(form.sede_id)    : null,
                comite_id:     form.comite_id      !== '' ? parseInt(form.comite_id)  : null,
                monto_aprobado: form.monto_aprobado !== '' ? parseFloat(form.monto_aprobado) : null,
                // Limpia fechas si el estatus no las requiere
                fecha_inicio: REQUIERE_FECHAS.includes(form.estatus) ? (form.fecha_inicio || null) : null,
                fecha_fin:    REQUIERE_FECHAS.includes(form.estatus) ? (form.fecha_fin    || null) : null,
            };

            if (isEditing) {
                await apiClient.put(`/v1/proyectos/${id}`, payload);
                setSuccessMsg('✅ Proyecto actualizado correctamente.');
            } else {
                await apiClient.post('/v1/proyectos', payload);
                setSuccessMsg('✅ Proyecto registrado correctamente.');
            }

            // Redirige a la lista tras un breve momento, igual que HabitanteForm
            setTimeout(() => navigate('/proyectos'), 1500);

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
                setServerError('No tienes permisos para realizar esta acción.');
            } else {
                setServerError(data.message ?? 'Error inesperado.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Helper — igual que fieldError en HabitanteForm
    const fieldError = (name) => errors[name]?.[0] ?? errors[name] ?? '';

    const mostrarFechas = REQUIERE_FECHAS.includes(form.estatus);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="proyecto-page">

            {/* ── Topbar — idéntico a HabitanteForm ───────────────────────── */}
            <header className="proyecto-topbar">
                <button
                    type="button"
                    className="proyecto-topbar__back"
                    onClick={() => navigate('/proyectos')}
                >
                    ← Volver a Proyectos
                </button>
                <div className="proyecto-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span>
                    <span>Proyectos</span><span>›</span>
                    <span>{isEditing ? 'Editar' : 'Registrar'}</span>
                </div>
            </header>

            <div className="proyecto-container">

                <div className="proyecto-heading">
                    <h1 className="proyecto-heading__title">
                        {isEditing ? 'Editar Proyecto' : 'Nuevo Proyecto'}
                    </h1>
                    <p className="proyecto-heading__subtitle">
                        {isEditing
                            ? 'Modifica los datos del proyecto seleccionado.'
                            : 'Registra un nuevo proyecto comunal en el sistema.'}
                    </p>
                </div>

                {/* ── Alertas ──────────────────────────────────────────────── */}
                {successMsg && (
                    <div className="proyecto-alert proyecto-alert--success" role="status">
                        {successMsg}
                    </div>
                )}
                {serverError && (
                    <div className="proyecto-alert proyecto-alert--error" role="alert">
                        <span>⚠</span> {serverError}
                    </div>
                )}

                {/* ── Spinner de carga inicial ─────────────────────────────── */}
                {loadingData ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: 'var(--c-text-light)' }}>
                        <span className="proyecto-btn__spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                    </div>
                ) : (
                    <form className="proyecto-form" onSubmit={handleSubmit} noValidate>

                        {/* ════════════════════════════════════════════════
                            SECCIÓN 1 — Información general
                            ════════════════════════════════════════════════ */}
                        <fieldset className="proyecto-fieldset">
                            <legend className="proyecto-fieldset__legend">
                                <span>📋</span> Información General
                            </legend>

                            {/* Nombre del proyecto */}
                            <div className={`proyecto-field ${fieldError('nombre_proyecto') ? 'proyecto-field--error' : ''}`}>
                                <label htmlFor="nombre_proyecto" className="proyecto-field__label">
                                    Nombre del proyecto <span className="required">*</span>
                                </label>
                                <input
                                    id="nombre_proyecto" name="nombre_proyecto" type="text"
                                    value={form.nombre_proyecto} onChange={handleChange}
                                    placeholder="Ej: Rehabilitación de la calle principal"
                                    className="proyecto-field__input"
                                    maxLength={200} disabled={isSubmitting}
                                />
                                {fieldError('nombre_proyecto') && (
                                    <p className="proyecto-field__error">{fieldError('nombre_proyecto')}</p>
                                )}
                            </div>

                            {/* Objetivo */}
                            <div className={`proyecto-field ${fieldError('objetivo') ? 'proyecto-field--error' : ''}`}>
                                <label htmlFor="objetivo" className="proyecto-field__label">
                                    Objetivo <span className="required">*</span>
                                </label>
                                <textarea
                                    id="objetivo" name="objetivo"
                                    value={form.objetivo} onChange={handleChange}
                                    placeholder="Describe el objetivo principal del proyecto..."
                                    className="proyecto-field__textarea"
                                    disabled={isSubmitting}
                                />
                                {fieldError('objetivo') && (
                                    <p className="proyecto-field__error">{fieldError('objetivo')}</p>
                                )}
                            </div>
                        </fieldset>

                        {/* ════════════════════════════════════════════════
                            SECCIÓN 2 — Financiamiento
                            ════════════════════════════════════════════════ */}
                        <fieldset className="proyecto-fieldset">
                            <legend className="proyecto-fieldset__legend">
                                <span>💰</span> Financiamiento
                            </legend>

                            <div className="proyecto-form-row">
                                {/* Fuente */}
                                <div className={`proyecto-field ${fieldError('fuente_financiamiento') ? 'proyecto-field--error' : ''}`}>
                                    <label htmlFor="fuente_financiamiento" className="proyecto-field__label">
                                        Fuente <span className="required">*</span>
                                    </label>
                                    <select
                                        id="fuente_financiamiento" name="fuente_financiamiento"
                                        value={form.fuente_financiamiento} onChange={handleChange}
                                        className="proyecto-field__select"
                                        disabled={isSubmitting}
                                    >
                                        <option value="">— Seleccionar —</option>
                                        {FUENTES.map(f => (
                                            <option key={f.value} value={f.value}>{f.label}</option>
                                        ))}
                                    </select>
                                    {fieldError('fuente_financiamiento') && (
                                        <p className="proyecto-field__error">{fieldError('fuente_financiamiento')}</p>
                                    )}
                                </div>

                                {/* Monto */}
                                <div className={`proyecto-field ${fieldError('monto_aprobado') ? 'proyecto-field--error' : ''}`}>
                                    <label htmlFor="monto_aprobado" className="proyecto-field__label">
                                        Monto aprobado (Bs.)
                                        <span className="proyecto-field__optional">(opcional)</span>
                                    </label>
                                    <input
                                        id="monto_aprobado" name="monto_aprobado" type="number"
                                        value={form.monto_aprobado} onChange={handleChange}
                                        placeholder="0.00" min="0" step="0.01"
                                        className="proyecto-field__input"
                                        disabled={isSubmitting}
                                    />
                                    {fieldError('monto_aprobado') && (
                                        <p className="proyecto-field__error">{fieldError('monto_aprobado')}</p>
                                    )}
                                </div>
                            </div>
                        </fieldset>

                        {/* ════════════════════════════════════════════════
                            SECCIÓN 3 — Asignación y estatus
                            ════════════════════════════════════════════════ */}
                        <fieldset className="proyecto-fieldset">
                            <legend className="proyecto-fieldset__legend">
                                <span>📍</span> Asignación y Estatus
                            </legend>

                            <div className="proyecto-form-row">
                                {/* Estatus */}
                                <div className={`proyecto-field ${fieldError('estatus') ? 'proyecto-field--error' : ''}`}>
                                    <label htmlFor="estatus" className="proyecto-field__label">
                                        Estatus <span className="required">*</span>
                                    </label>
                                    <select
                                        id="estatus" name="estatus"
                                        value={form.estatus} onChange={handleChange}
                                        className="proyecto-field__select"
                                        disabled={isSubmitting}
                                    >
                                        {ESTATUS_OPTS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                    {fieldError('estatus') && (
                                        <p className="proyecto-field__error">{fieldError('estatus')}</p>
                                    )}
                                </div>

                                {/* Sede */}
                                <div className={`proyecto-field ${fieldError('sede_id') ? 'proyecto-field--error' : ''}`}>
                                    <label htmlFor="sede_id" className="proyecto-field__label">
                                        Sede
                                        <span className="proyecto-field__optional">(opcional)</span>
                                    </label>
                                    <select
                                        id="sede_id" name="sede_id"
                                        value={form.sede_id} onChange={handleChange}
                                        className="proyecto-field__select"
                                        disabled={isSubmitting}
                                    >
                                        <option value="">— Sin sede —</option>
                                        {sedes.map(s => (
                                            <option key={s.id} value={s.id}>{s.nombre}</option>
                                        ))}
                                    </select>
                                    {fieldError('sede_id') && (
                                        <p className="proyecto-field__error">{fieldError('sede_id')}</p>
                                    )}
                                </div>
                            </div>

                            {/* Comité — fila completa */}
                            <div className={`proyecto-field ${fieldError('comite_id') ? 'proyecto-field--error' : ''}`}>
                                <label htmlFor="comite_id" className="proyecto-field__label">
                                    Comité
                                    <span className="proyecto-field__optional">(opcional)</span>
                                </label>
                                <select
                                    id="comite_id" name="comite_id"
                                    value={form.comite_id} onChange={handleChange}
                                    className="proyecto-field__select"
                                    disabled={isSubmitting}
                                >
                                    <option value="">— Sin comité —</option>
                                    {comites.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </select>
                                {fieldError('comite_id') && (
                                    <p className="proyecto-field__error">{fieldError('comite_id')}</p>
                                )}
                            </div>

                            {/* ── Campo condicional: Fechas ─────────────────── */}
                            {/* Aparece con animación igual que tipo_discapacidad en HabitanteForm */}
                            {mostrarFechas && (
                                <div className="proyecto-field proyecto-field--conditional">
                                    <p className="proyecto-fieldset__legend" style={{ marginBottom: '0.75rem' }}>
                                        <span>⏱</span> Plazos del Proyecto
                                    </p>
                                    <div className="proyecto-form-row">
                                        <div className={`proyecto-field ${fieldError('fecha_inicio') ? 'proyecto-field--error' : ''}`}>
                                            <label htmlFor="fecha_inicio" className="proyecto-field__label">
                                                Fecha de inicio
                                            </label>
                                            <input
                                                id="fecha_inicio" name="fecha_inicio" type="date"
                                                value={form.fecha_inicio} onChange={handleChange}
                                                className="proyecto-field__input"
                                                disabled={isSubmitting}
                                            />
                                            {fieldError('fecha_inicio') && (
                                                <p className="proyecto-field__error">{fieldError('fecha_inicio')}</p>
                                            )}
                                        </div>
                                        <div className={`proyecto-field ${fieldError('fecha_fin') ? 'proyecto-field--error' : ''}`}>
                                            <label htmlFor="fecha_fin" className="proyecto-field__label">
                                                Fecha de fin
                                            </label>
                                            <input
                                                id="fecha_fin" name="fecha_fin" type="date"
                                                value={form.fecha_fin} onChange={handleChange}
                                                min={form.fecha_inicio || undefined}
                                                className="proyecto-field__input"
                                                disabled={isSubmitting}
                                            />
                                            {fieldError('fecha_fin') && (
                                                <p className="proyecto-field__error">{fieldError('fecha_fin')}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </fieldset>

                        {/* ── Acciones — idéntico a HabitanteForm ─────────── */}
                        <div className="proyecto-form-actions">
                            <button
                                type="button"
                                className="proyecto-btn proyecto-btn--secondary"
                                onClick={() => navigate('/proyectos')}
                                disabled={isSubmitting}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="proyecto-btn proyecto-btn--primary"
                                disabled={isSubmitting || loadingData}
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="proyecto-btn__spinner" aria-hidden="true" />
                                        {isEditing ? 'Guardando...' : 'Registrando...'}
                                    </>
                                ) : (
                                    isEditing ? '✓ Guardar cambios' : '+ Registrar Proyecto'
                                )}
                            </button>
                        </div>

                    </form>
                )}
            </div>
        </div>
    );
}

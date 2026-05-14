/**
 * resources/js/pages/voceros/VoceroForm.js
 *
 * Imports desde pages/voceros/:
 *   apiClient → '../../services/axios'   (2 niveles)
 *   useAuth   → '../../hooks/useAuth'    (2 niveles)
 *   CSS       → './VoceroList.css'       (reutiliza los estilos de lista)
 */

import { useState, useEffect } from 'react';
import { useNavigate }          from 'react-router-dom';
import { useAuth }              from '../../hooks/useAuth';
import apiClient                from '../../services/axios';
import './VoceroForm.css';

const INITIAL_FORM = {
    habitante_id:   '',
    sede_id:        '',
    comite_id:      '',
    unidad_comunal: '',
    fecha_eleccion: '',
    fecha_fin:      '',
    esta_activo:    true,
};

export default function VoceroForm() {
    const navigate   = useNavigate();
    const { user }   = useAuth();

    const [form,         setForm]         = useState(INITIAL_FORM);
    const [errors,       setErrors]       = useState({});
    const [serverError,  setServerError]  = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg,   setSuccessMsg]   = useState('');

    // Datos de los selects — todos en un solo estado
    const [formData,     setFormData]     = useState(null);
    const [loadingData,  setLoadingData]  = useState(true);
    const [loadError,    setLoadError]    = useState('');

    // ── Carga única de los 3 selects ──────────────────────────────
    useEffect(() => {
        const cargarDatos = async () => {
            try {
                // Una sola petición devuelve: habitantes, sedes y comités
                const res = await apiClient.get('/v1/voceros/form-data');
                setFormData(res.data.data);
            } catch {
                setLoadError('No se pudieron cargar los datos del formulario. Recarga la página.');
            } finally {
                setLoadingData(false);
            }
        };
        cargarDatos();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (errors[name])  setErrors(prev => ({ ...prev, [name]: '' }));
        if (serverError)   setServerError('');
    };

    const validate = () => {
        const next = {};
        if (!form.habitante_id)   next.habitante_id   = 'Debes seleccionar un habitante.';
        if (!form.sede_id)        next.sede_id        = 'Debes seleccionar una sede.';
        if (!form.unidad_comunal.trim()) next.unidad_comunal = 'La unidad comunal es obligatoria.';
        if (!form.fecha_eleccion) next.fecha_eleccion = 'La fecha de elección es obligatoria.';
        return next;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError('');
        setSuccessMsg('');

        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...form,
                habitante_id: parseInt(form.habitante_id),
                sede_id:      parseInt(form.sede_id),
                comite_id:    form.comite_id ? parseInt(form.comite_id) : null,
                fecha_fin:    form.fecha_fin || null,
                esta_activo:  Boolean(form.esta_activo),
            };

            const res = await apiClient.post('/v1/voceros', payload);
            const vocero = res.data.data;

            setSuccessMsg(
                `✅ ${vocero.habitante?.nombre_vocero ?? 'Vocero'} registrado como vocero correctamente.`
            );
            setTimeout(() => navigate('/voceros'), 1500);

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
                setServerError('No tienes permisos para registrar voceros.');
            } else {
                setServerError(data.message ?? 'Error inesperado.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const fieldErr = (name) => errors[name]?.[0] ?? errors[name] ?? '';

    // ── Estado de carga del formulario ────────────────────────────
    if (loadingData) {
        return (
            <div className="list-page">
                <header className="list-topbar">
                    <button className="list-topbar__back" onClick={() => navigate('/voceros')}>← Voceros</button>
                </header>
                <div className="list-container">
                    <div className="list-loading">
                        <span className="list-loading__spinner" />
                        <p>Cargando datos del formulario...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="list-page">
                <header className="list-topbar">
                    <button className="list-topbar__back" onClick={() => navigate('/voceros')}>← Voceros</button>
                </header>
                <div className="list-container">
                    <div className="list-alert list-alert--error">{loadError}</div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="list-page">
            <header className="list-topbar">
                <button className="list-topbar__back" type="button" onClick={() => navigate('/voceros')}>
                    ← Voceros
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span>
                    <span>Voceros</span><span>›</span>
                    <span>Registrar</span>
                </div>
            </header>

            <div className="list-container" style={{ maxWidth: '700px' }}>

                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Registrar Vocero</h1>
                        <p className="list-heading__subtitle">
                            Asigna un habitante del padrón a un cargo comunal.
                        </p>
                    </div>
                </div>

                {successMsg && (
                    <div className="list-alert" style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#166534', marginBottom: '1.5rem' }}>
                        {successMsg}
                    </div>
                )}
                {serverError && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span> {serverError}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="vocero-form">

                    {/* ── Sección 1: Identidad ─────────────────── */}
                    <fieldset className="vocero-fieldset">
                        <legend className="vocero-legend"><span>👤</span> Habitante y Cargo</legend>

                        {/* Habitante */}
                        <div className={`vocero-field ${fieldErr('habitante_id') ? 'vocero-field--error' : ''}`}>
                            <label htmlFor="habitante_id" className="vocero-label">
                                Habitante <span className="req">*</span>
                            </label>
                            <select
                                id="habitante_id" name="habitante_id"
                                value={form.habitante_id} onChange={handleChange}
                                className="vocero-select" disabled={isSubmitting}
                            >
                                <option value="">— Selecciona el habitante —</option>
                                {formData?.habitantes?.map(h => (
                                    <option key={h.id} value={h.id}>{h.label}</option>
                                ))}
                            </select>
                            {fieldErr('habitante_id') && <p className="vocero-error">{fieldErr('habitante_id')}</p>}
                            <p className="vocero-hint">Ordenado por apellido. Formato: Apellido, Nombre — Cédula.</p>
                        </div>

                        {/* Unidad comunal */}
                        <div className={`vocero-field ${fieldErr('unidad_comunal') ? 'vocero-field--error' : ''}`}>
                            <label htmlFor="unidad_comunal" className="vocero-label">
                                Unidad comunal <span className="req">*</span>
                            </label>
                            <input
                                id="unidad_comunal" name="unidad_comunal" type="text"
                                value={form.unidad_comunal} onChange={handleChange}
                                placeholder="Ej: Unidad de Contraloría Social"
                                className="vocero-input" maxLength={150} disabled={isSubmitting}
                            />
                            {fieldErr('unidad_comunal') && <p className="vocero-error">{fieldErr('unidad_comunal')}</p>}
                        </div>

                        {/* Comité (opcional) */}
                        <div className="vocero-field">
                            <label htmlFor="comite_id" className="vocero-label">
                                Comité
                                <span className="vocero-optional">(opcional)</span>
                            </label>
                            <select
                                id="comite_id" name="comite_id"
                                value={form.comite_id} onChange={handleChange}
                                className="vocero-select" disabled={isSubmitting}
                            >
                                <option value="">— Sin comité asignado —</option>
                                {formData?.comites?.map(c => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                    </fieldset>

                    {/* ── Sección 2: Sede y Fechas ─────────────── */}
                    <fieldset className="vocero-fieldset">
                        <legend className="vocero-legend"><span>📍</span> Sede y Mandato</legend>

                        {/* Sede */}
                        <div className={`vocero-field ${fieldErr('sede_id') ? 'vocero-field--error' : ''}`}>
                            <label htmlFor="sede_id" className="vocero-label">
                                Sede <span className="req">*</span>
                            </label>
                            <select
                                id="sede_id" name="sede_id"
                                value={form.sede_id} onChange={handleChange}
                                className="vocero-select" disabled={isSubmitting}
                            >
                                <option value="">— Selecciona la sede —</option>
                                {formData?.sedes?.map(s => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                            </select>
                            {fieldErr('sede_id') && <p className="vocero-error">{fieldErr('sede_id')}</p>}
                        </div>

                        <div className="vocero-row">
                            {/* Fecha de elección */}
                            <div className={`vocero-field ${fieldErr('fecha_eleccion') ? 'vocero-field--error' : ''}`}>
                                <label htmlFor="fecha_eleccion" className="vocero-label">
                                    Fecha de elección <span className="req">*</span>
                                </label>
                                <input
                                    id="fecha_eleccion" name="fecha_eleccion" type="date"
                                    value={form.fecha_eleccion} onChange={handleChange}
                                    max={new Date().toISOString().split('T')[0]}
                                    className="vocero-input" disabled={isSubmitting}
                                />
                                {fieldErr('fecha_eleccion') && <p className="vocero-error">{fieldErr('fecha_eleccion')}</p>}
                            </div>

                            {/* Fecha de fin (opcional) */}
                            <div className="vocero-field">
                                <label htmlFor="fecha_fin" className="vocero-label">
                                    Fin de mandato
                                    <span className="vocero-optional">(opcional)</span>
                                </label>
                                <input
                                    id="fecha_fin" name="fecha_fin" type="date"
                                    value={form.fecha_fin} onChange={handleChange}
                                    min={form.fecha_eleccion || undefined}
                                    className="vocero-input" disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        {/* Toggle esta_activo */}
                        <div className="vocero-field">
                            <label className="vocero-toggle" htmlFor="esta_activo">
                                <input
                                    id="esta_activo" name="esta_activo" type="checkbox"
                                    checked={form.esta_activo} onChange={handleChange}
                                    className="vocero-toggle__input" disabled={isSubmitting}
                                />
                                <span className="vocero-toggle__track" aria-hidden="true" />
                                <span className="vocero-toggle__label">
                                    {form.esta_activo
                                        ? '✅ Cargo activo — el vocero ejerce actualmente'
                                        : '⏸ Cargo inactivo — mandato culminado'}
                                </span>
                            </label>
                        </div>
                    </fieldset>

                    {/* ── Acciones ─────────────────────────────── */}
                    <div className="vocero-actions">
                        <button type="button" className="list-btn vocero-btn-cancel"
                            onClick={() => navigate('/voceros')} disabled={isSubmitting}>
                            Cancelar
                        </button>
                        <button type="submit"
                            className="list-btn list-btn--primary"
                            disabled={isSubmitting}
                            style={{ minWidth: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                            {isSubmitting ? (
                                <><span className="list-loading__spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> Registrando...</>
                            ) : '+ Registrar Vocero'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

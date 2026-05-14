
import { useState, useEffect }   from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth }                from '../../hooks/useAuth';
import apiClient                  from '../../services/axios';
import './OrganizacionForm.css';

// ── Opciones sincronizadas con el enum de la migración ─────────
const TIPOS_SERVICIO = [
    { value: 'agua',         label: '💧 Agua'          },
    { value: 'electricidad', label: '⚡ Electricidad'  },
    { value: 'gas',          label: '🔥 Gas'           },
    { value: 'salud',        label: '🏥 Salud'         },
    { value: 'educacion',    label: '📚 Educación'     },
    { value: 'seguridad',    label: '🛡️ Seguridad'    },
    { value: 'transporte',   label: '🚌 Transporte'    },
    { value: 'otro',         label: '🏛️ Otro'         },
];

const FORM_INICIAL = {
    nombre:        '',
    tipo_servicio: 'otro',
    contacto:      '',
    descripcion:   '',
    estatus:       true,
};

export default function OrganizacionForm() {
    const navigate        = useNavigate();
    const { id }          = useParams();          // undefined en modo crear
    const { canWrite }    = useAuth();
    const esEdicion       = Boolean(id);

    // ── Estado del formulario ──────────────────────────────────
    const [form,     setForm]     = useState(FORM_INICIAL);
    const [errors,   setErrors]   = useState({});
    const [loading,  setLoading]  = useState(esEdicion); // carga inicial solo en edición
    const [saving,   setSaving]   = useState(false);
    const [loadErr,  setLoadErr]  = useState(null);

    // ── Toast interno (sin dependencia externa) ────────────────
    const [toast, setToast] = useState(null); // { msg, type: 'success'|'error' }
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // ── Cargar datos en modo edición ───────────────────────────
    useEffect(() => {
        if (!esEdicion) return;
        setLoading(true);
        apiClient.get(`/v1/organizaciones/${id}`)
            .then(res => {
                const d = res.data?.data ?? {};
                setForm({
                    nombre:        d.nombre        ?? '',
                    tipo_servicio: d.tipo_servicio ?? 'otro',
                    contacto:      d.contacto      ?? '',
                    descripcion:   d.descripcion   ?? '',
                    estatus:       d.estatus       ?? true,
                });
            })
            .catch(() => setLoadErr('No se pudo cargar la organización. Verifica que el registro exista.'))
            .finally(() => setLoading(false));
    }, [id, esEdicion]);

    // ── Manejadores de campo ───────────────────────────────────
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        // Limpiar error del campo al editarlo
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    // ── Envío del formulario ───────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validación mínima en el cliente
        if (!form.nombre.trim()) {
            setErrors({ nombre: ['El nombre es obligatorio.'] });
            return;
        }

        setSaving(true);
        setErrors({});

        try {
            if (esEdicion) {
                await apiClient.put(`/v1/organizaciones/${id}`, form);
                showToast('Organización actualizada correctamente.');
            } else {
                await apiClient.post('/v1/organizaciones', form);
                showToast('Organización registrada correctamente.');
            }

            // Redirigir tras 900 ms para que el toast sea visible
            setTimeout(() => navigate('/organizaciones'), 900);

        } catch (err) {
            if (err.response?.status === 422) {
                setErrors(err.response.data?.errors ?? {});
            } else if (err.response?.status === 403) {
                showToast('No tienes permiso para realizar esta acción.', 'error');
            } else {
                showToast(
                    err.response?.data?.message ?? 'Error inesperado. Intenta de nuevo.',
                    'error'
                );
            }
        } finally {
            setSaving(false);
        }
    };

    const fieldErr = (name) => errors[name]?.[0] ?? '';

    // ─────────────────────────────────────────────────────────
    //  ESTADOS DE CARGA / ERROR INICIAL
    // ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="oform-page">
                <div className="oform-loading">
                    <span className="oform-loading__spinner" />
                    <p>Cargando organización...</p>
                </div>
            </div>
        );
    }

    if (loadErr) {
        return (
            <div className="oform-page">
                <div className="oform-loaderr">
                    <span>⚠️</span>
                    <p>{loadErr}</p>
                    <button className="oform-btn oform-btn--secondary" onClick={() => navigate('/organizaciones')}>
                        ← Volver al listado
                    </button>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────
    //  RENDER PRINCIPAL
    // ─────────────────────────────────────────────────────────
    return (
        <div className="oform-page">

            {/* ── Toast de notificación ─────────────────────── */}
            {toast && (
                <div className={`oform-toast oform-toast--${toast.type}`} role="alert">
                    <span>{toast.type === 'success' ? '✓' : '⚠'}</span>
                    {toast.msg}
                </div>
            )}

            {/* ── Topbar ────────────────────────────────────── */}
            <header className="oform-topbar">
                <button
                    className="oform-topbar__back"
                    onClick={() => navigate('/organizaciones')}
                    type="button"
                >
                    ← Organizaciones
                </button>
                <div className="oform-topbar__breadcrumb">
                    <span>SIGET</span>
                    <span>›</span>
                    <span>Organizaciones</span>
                    <span>›</span>
                    <span>{esEdicion ? 'Editar' : 'Nueva'}</span>
                </div>
            </header>

            {/* ── Card del formulario ───────────────────────── */}
            <div className="oform-container">
                <div className="oform-card">

                    {/* Encabezado de la card */}
                    <div className="oform-card__header">
                        <div className="oform-card__header-icon">
                            {esEdicion ? '✏️' : '🏛️'}
                        </div>
                        <div>
                            <h1 className="oform-card__title">
                                {esEdicion ? 'Editar Organización' : 'Nueva Organización'}
                            </h1>
                            <p className="oform-card__subtitle">
                                {esEdicion
                                    ? 'Modifica los datos del servicio público.'
                                    : 'Registra un nuevo servicio público en el directorio comunitario.'
                                }
                            </p>
                        </div>
                    </div>

                    {/* Cuerpo del formulario */}
                    <form onSubmit={handleSubmit} className="oform-body" noValidate>

                        {/* ── Nombre ────────────────────────── */}
                        <div className="oform-field">
                            <label className="oform-label" htmlFor="nombre">
                                Nombre de la organización <span className="oform-required">*</span>
                            </label>
                            <input
                                id="nombre"
                                name="nombre"
                                type="text"
                                value={form.nombre}
                                onChange={handleChange}
                                maxLength={150}
                                placeholder="Ej. Hidrocapital, CORPOELEC, Ambulatorio Sur..."
                                className={`oform-input ${fieldErr('nombre') ? 'oform-input--error' : ''}`}
                                autoFocus
                            />
                            {fieldErr('nombre') && (
                                <span className="oform-field__error">{fieldErr('nombre')}</span>
                            )}
                        </div>

                        {/* ── Tipo de servicio ──────────────── */}
                        <div className="oform-field">
                            <label className="oform-label" htmlFor="tipo_servicio">
                                Tipo de servicio <span className="oform-required">*</span>
                            </label>
                            <select
                                id="tipo_servicio"
                                name="tipo_servicio"
                                value={form.tipo_servicio}
                                onChange={handleChange}
                                className={`oform-select ${fieldErr('tipo_servicio') ? 'oform-input--error' : ''}`}
                            >
                                {TIPOS_SERVICIO.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                            {fieldErr('tipo_servicio') && (
                                <span className="oform-field__error">{fieldErr('tipo_servicio')}</span>
                            )}
                        </div>

                        {/* ── Contacto ──────────────────────── */}
                        <div className="oform-field">
                            <label className="oform-label" htmlFor="contacto">
                                Contacto
                                <span className="oform-label__hint"> — teléfono, WhatsApp o email</span>
                            </label>
                            <input
                                id="contacto"
                                name="contacto"
                                type="text"
                                value={form.contacto}
                                onChange={handleChange}
                                maxLength={100}
                                placeholder="+58 412 0000000 o info@ejemplo.gob.ve"
                                className={`oform-input ${fieldErr('contacto') ? 'oform-input--error' : ''}`}
                            />
                            {fieldErr('contacto') && (
                                <span className="oform-field__error">{fieldErr('contacto')}</span>
                            )}
                            <span className="oform-field__hint">
                                Los números se convierten automáticamente en enlace de WhatsApp.
                            </span>
                        </div>

                        {/* ── Descripción ───────────────────── */}
                        <div className="oform-field">
                            <label className="oform-label" htmlFor="descripcion">
                                Descripción
                            </label>
                            <textarea
                                id="descripcion"
                                name="descripcion"
                                value={form.descripcion}
                                onChange={handleChange}
                                maxLength={1000}
                                rows={4}
                                placeholder="Describe brevemente los servicios que ofrece esta organización..."
                                className={`oform-textarea ${fieldErr('descripcion') ? 'oform-input--error' : ''}`}
                            />
                            <span className="oform-field__count">
                                {form.descripcion.length}/1000
                            </span>
                            {fieldErr('descripcion') && (
                                <span className="oform-field__error">{fieldErr('descripcion')}</span>
                            )}
                        </div>

                        {/* ── Estatus ───────────────────────── */}
                        <div className="oform-field oform-field--switch">
                            <span className="oform-label">Estatus</span>
                            <label className="oform-switch" htmlFor="estatus">
                                <input
                                    id="estatus"
                                    name="estatus"
                                    type="checkbox"
                                    checked={form.estatus}
                                    onChange={handleChange}
                                    className="oform-switch__input"
                                />
                                <span className="oform-switch__track" />
                                <span className="oform-switch__label">
                                    {form.estatus
                                        ? <span className="oform-status oform-status--active">Activo — visible en el directorio</span>
                                        : <span className="oform-status oform-status--inactive">Inactivo — oculto del directorio</span>
                                    }
                                </span>
                            </label>
                        </div>

                        {/* ── Acciones ──────────────────────── */}
                        <div className="oform-actions">
                            <button
                                type="button"
                                className="oform-btn oform-btn--secondary"
                                onClick={() => navigate('/organizaciones')}
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="oform-btn oform-btn--primary"
                                disabled={saving}
                            >
                                {saving
                                    ? <><span className="oform-btn__spinner" /> Guardando...</>
                                    : esEdicion ? '✓ Guardar cambios' : '+ Registrar organización'
                                }
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}

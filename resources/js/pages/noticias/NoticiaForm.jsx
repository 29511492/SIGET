/**
 * resources/js/pages/noticias/NoticiaForm.jsx
 *
 * Formulario para crear y editar noticias comunales.
 * Si la URL contiene un :id, carga la noticia existente (modo edición).
 * Si no, inicia en blanco (modo creación).
 *
 * Consume:
 *   GET /api/v1/noticias/{id}  → cargar datos en modo edición
 *   POST /api/v1/noticias      → crear nueva noticia
 *   PUT  /api/v1/noticias/{id} → actualizar noticia existente
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../services/axios';
import './NoticiaForm.css';

const FORM_INICIAL = {
    titulo:    '',
    contenido: '',
    publicado: false,
};

export default function NoticiaForm() {
    const navigate       = useNavigate();
    const { id }         = useParams();
    const esEdicion      = Boolean(id);

    // ── Estado ─────────────────────────────────────────────────
    const [form,          setForm]          = useState(FORM_INICIAL);
    const [errors,        setErrors]        = useState({});
    const [serverError,   setServerError]   = useState('');
    const [successMsg,    setSuccessMsg]    = useState('');
    const [isSubmitting,  setIsSubmitting]  = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(esEdicion);

    // ── Cargar datos en modo edición ───────────────────────────
    useEffect(() => {
        if (!esEdicion) return;

        apiClient.get(`/v1/noticias/${id}`)
            .then(({ data }) => {
                const n = data.data;
                setForm({
                    titulo:    n.titulo    ?? '',
                    contenido: n.contenido ?? '',
                    publicado: n.publicado ?? false,
                });
            })
            .catch(() => setServerError('No se pudo cargar la noticia.'))
            .finally(() => setIsLoadingData(false));
    }, [id, esEdicion]);

    // ── Handlers ───────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
        if (serverError)  setServerError('');
    };

    const validate = () => {
        const next = {};
        if (!form.titulo.trim())    next.titulo    = 'El título es obligatorio.';
        if (!form.contenido.trim()) next.contenido = 'El contenido es obligatorio.';
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
            if (esEdicion) {
                await apiClient.put(`/v1/noticias/${id}`, form);
                setSuccessMsg('Noticia actualizada correctamente.');
            } else {
                await apiClient.post('/v1/noticias', form);
                setSuccessMsg('Noticia creada correctamente.');
                setForm(FORM_INICIAL);
            }

            setTimeout(() => navigate('/noticias'), 1200);

        } catch (err) {
            const { status, data } = err.response ?? {};
            if (status === 422) {
                setErrors({
                    titulo:    data.errors?.titulo?.[0]    ?? '',
                    contenido: data.errors?.contenido?.[0] ?? '',
                });
            } else {
                setServerError(data?.message ?? 'Error al guardar la noticia.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Guard: cargando datos en edición ───────────────────────
    if (isLoadingData) {
        return (
            <div className="noticia-form-page">
                <div className="noticia-form-topbar">
                    <button
                        className="noticia-form-topbar__back"
                        onClick={() => navigate('/noticias')}
                    >
                        ← Noticias
                    </button>
                </div>
                <div className="noticia-form-container">
                    <div className="noticia-form-loading">
                        <div className="noticia-form-loading__spinner" />
                        <span>Cargando noticia...</span>
                    </div>
                </div>
            </div>
        );
    }

    // ── Render ─────────────────────────────────────────────────
    return (
        <div className="noticia-form-page">

            <div className="noticia-form-topbar">
                <button
                    className="noticia-form-topbar__back"
                    onClick={() => navigate('/noticias')}
                >
                    ← Noticias
                </button>
                <div className="noticia-form-topbar__breadcrumb">
                    <span>SIGET</span>
                    <span>›</span>
                    <span>Noticias</span>
                    <span>›</span>
                    <span>{esEdicion ? 'Editar' : 'Nueva Noticia'}</span>
                </div>
            </div>

            <div className="noticia-form-container">

                <div className="noticia-form-heading">
                    <h1 className="noticia-form-heading__title">
                        {esEdicion ? 'Editar Noticia' : 'Nueva Noticia'}
                    </h1>
                    <p className="noticia-form-heading__subtitle">
                        {esEdicion
                            ? 'Modifica el contenido de la noticia comunal.'
                            : 'Redacta una nueva noticia o comunicado para la comunidad.'
                        }
                    </p>
                </div>

                {serverError && (
                    <div className="noticia-alert noticia-alert--error" role="alert">
                        <span>⚠</span>
                        <span>{serverError}</span>
                    </div>
                )}

                {successMsg && (
                    <div className="noticia-alert noticia-alert--success" role="status">
                        <span>✅</span>
                        <span>{successMsg}</span>
                    </div>
                )}

                <form className="noticia-form" onSubmit={handleSubmit} noValidate>

                    {/* Fieldset: Contenido */}
                    <div className="noticia-fieldset">
                        <p className="noticia-fieldset__legend">
                            📰 Contenido de la noticia
                        </p>

                        {/* Título */}
                        <div className={`noticia-field ${errors.titulo ? 'noticia-field--error' : ''}`}>
                            <label htmlFor="titulo" className="noticia-field__label">
                                Título <span className="required">*</span>
                            </label>
                            <input
                                id="titulo"
                                name="titulo"
                                type="text"
                                className="noticia-field__input"
                                placeholder="Ej: Reunión comunal este sábado"
                                value={form.titulo}
                                onChange={handleChange}
                                disabled={isSubmitting}
                                maxLength={200}
                            />
                            {errors.titulo && (
                                <span className="noticia-field__error">{errors.titulo}</span>
                            )}
                            <span className="noticia-field__hint">
                                {form.titulo.length}/200 caracteres
                            </span>
                        </div>

                        {/* Contenido */}
                        <div className={`noticia-field ${errors.contenido ? 'noticia-field--error' : ''}`}>
                            <label htmlFor="contenido" className="noticia-field__label">
                                Contenido <span className="required">*</span>
                            </label>
                            <textarea
                                id="contenido"
                                name="contenido"
                                className="noticia-field__textarea"
                                placeholder="Escribe el cuerpo de la noticia aquí..."
                                value={form.contenido}
                                onChange={handleChange}
                                disabled={isSubmitting}
                                rows={10}
                            />
                            {errors.contenido && (
                                <span className="noticia-field__error">{errors.contenido}</span>
                            )}
                        </div>
                    </div>

                    {/* Fieldset: Publicación */}
                    <div className="noticia-fieldset">
                        <p className="noticia-fieldset__legend">
                            📤 Estado de publicación
                        </p>

                        <label className="noticia-toggle">
                            <input
                                type="checkbox"
                                name="publicado"
                                className="noticia-toggle__input"
                                checked={form.publicado}
                                onChange={handleChange}
                                disabled={isSubmitting}
                            />
                            <span className="noticia-toggle__track" />
                            <span className="noticia-toggle__label">
                                {form.publicado
                                    ? '✅ Publicada — visible para todos los usuarios'
                                    : '📝 Borrador — solo visible para admin y operador'
                                }
                            </span>
                        </label>
                    </div>

                    {/* Acciones */}
                    <div className="noticia-form-actions">
                        <button
                            type="button"
                            className="noticia-btn noticia-btn--secondary"
                            onClick={() => navigate('/noticias')}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={`noticia-btn noticia-btn--primary ${
                                isSubmitting ? 'noticia-btn--loading' : ''
                            }`}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="noticia-btn__spinner" aria-hidden="true" />
                                    Guardando...
                                </>
                            ) : esEdicion ? 'Guardar Cambios' : 'Crear Noticia'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

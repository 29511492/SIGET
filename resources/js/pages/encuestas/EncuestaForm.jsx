/**
 * resources/js/pages/encuestas/EncuestaForm.jsx
 *
 * Formulario de creación de una campaña de censo. Se renderiza DENTRO de
 * un FormModal (EncuestaList), por eso recibe onCancel / onSuccess en vez
 * de navegar: la URL se queda en /encuestas.
 *
 * Valida en el cliente (nombre obligatorio, cierre no anterior al inicio)
 * y muestra los errores 422 del backend campo por campo.
 */

import { useState } from 'react';
import apiClient from '../../services/axios';
import './EncuestaForm.css';

const TIPOS = [
    { value: 'bombona_gas', label: 'Bombona de gas (predice agotamiento)' },
    { value: 'bolsa_clap',  label: 'Bolsa CLAP (mide cobertura)' },
    { value: 'otro',        label: 'Otro (mide cobertura)' },
];

const FORM_INICIAL = {
    nombre:       '',
    tipo:         'bombona_gas',
    descripcion:  '',
    fecha_inicio: '',
    fecha_cierre: '',
};

export default function EncuestaForm({ onCancel, onSuccess }) {
    const [form,         setForm]         = useState(FORM_INICIAL);
    const [errors,       setErrors]       = useState({});
    const [isSaving,     setIsSaving]     = useState(false);
    const [errorGeneral, setErrorGeneral] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    };

    const validar = () => {
        const nuevos = {};

        if (!form.nombre.trim()) {
            nuevos.nombre = ['El nombre de la campaña es obligatorio.'];
        }
        if (form.fecha_inicio && form.fecha_cierre && form.fecha_cierre < form.fecha_inicio) {
            nuevos.fecha_cierre = ['La fecha de cierre no puede ser anterior a la de inicio.'];
        }

        return nuevos;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorGeneral(null);

        const locales = validar();
        if (Object.keys(locales).length > 0) {
            setErrors(locales);
            return;
        }

        setIsSaving(true);
        setErrors({});

        try {
            const { data } = await apiClient.post('/v1/encuestas', {
                nombre:       form.nombre.trim(),
                tipo:         form.tipo,
                descripcion:  form.descripcion.trim() || null,
                fecha_inicio: form.fecha_inicio || null,
                fecha_cierre: form.fecha_cierre || null,
            });
            onSuccess?.(data.data);
        } catch (err) {
            if (err.response?.status === 422) {
                setErrors(err.response.data.errors ?? {});
            } else {
                setErrorGeneral(err.response?.data?.message ?? 'No se pudo crear la encuesta. Intenta de nuevo.');
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="encform-form" noValidate>

            {errorGeneral && (
                <p className="encform-alert" role="alert">{errorGeneral}</p>
            )}

            <div className="encform-field">
                <label htmlFor="encform-nombre">Nombre de la campaña</label>
                <input
                    id="encform-nombre"
                    name="nombre"
                    type="text"
                    value={form.nombre}
                    onChange={handleChange}
                    placeholder="Ej: Censo de gas — octubre 2026"
                    maxLength={150}
                    autoFocus
                />
                {errors.nombre && <span className="encform-field__error">{errors.nombre[0]}</span>}
            </div>

            <div className="encform-field">
                <label htmlFor="encform-tipo">Tipo de encuesta</label>
                <select id="encform-tipo" name="tipo" value={form.tipo} onChange={handleChange}>
                    {TIPOS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
                {errors.tipo && <span className="encform-field__error">{errors.tipo[0]}</span>}
            </div>

            <div className="encform-field">
                <label htmlFor="encform-descripcion">Descripción (opcional)</label>
                <textarea
                    id="encform-descripcion"
                    name="descripcion"
                    value={form.descripcion}
                    onChange={handleChange}
                    rows={3}
                    maxLength={1000}
                />
                {errors.descripcion && <span className="encform-field__error">{errors.descripcion[0]}</span>}
            </div>

            <div className="encform-row">
                <div className="encform-field">
                    <label htmlFor="encform-inicio">Fecha de inicio (opcional)</label>
                    <input
                        id="encform-inicio"
                        name="fecha_inicio"
                        type="date"
                        value={form.fecha_inicio}
                        onChange={handleChange}
                    />
                    {errors.fecha_inicio && <span className="encform-field__error">{errors.fecha_inicio[0]}</span>}
                </div>

                <div className="encform-field">
                    <label htmlFor="encform-cierre">Fecha de cierre (opcional)</label>
                    <input
                        id="encform-cierre"
                        name="fecha_cierre"
                        type="date"
                        value={form.fecha_cierre}
                        min={form.fecha_inicio || undefined}
                        onChange={handleChange}
                    />
                    {errors.fecha_cierre && <span className="encform-field__error">{errors.fecha_cierre[0]}</span>}
                </div>
            </div>

            <div className="encform-actions">
                <button type="button" className="encform-btn encform-btn--cancel" onClick={onCancel} disabled={isSaving}>
                    Cancelar
                </button>
                <button type="submit" className="encform-btn encform-btn--submit" disabled={isSaving}>
                    {isSaving ? 'Guardando…' : 'Crear encuesta'}
                </button>
            </div>
        </form>
    );
}

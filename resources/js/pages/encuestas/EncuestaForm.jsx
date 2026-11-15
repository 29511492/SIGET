/**
 * resources/js/pages/encuestas/EncuestaForm.jsx
 *
 * Formulario de creación de una encuesta territorial. Se renderiza DENTRO de
 * un FormModal (EncuestaList), por eso recibe onCancel / onSuccess en vez
 * de navegar: la URL se queda en /encuestas.
 *
 * ORDEN DE LOS CAMPOS (nov-2026): primero el TIPO, porque de él depende lo
 * demás: la ayuda que se muestra bajo el selector, el ejemplo de nombre y si
 * se piden fechas. Los tipos cuyo mapa sale del censo (condición de vivienda)
 * no llevan fechas de campaña, así que esos campos no se muestran ni se envían.
 *
 * Valida en el cliente (nombre obligatorio, cierre no anterior al inicio)
 * y muestra los errores 422 del backend campo por campo.
 */

import { useState } from 'react';
import apiClient from '../../services/axios';
import './EncuestaForm.css';

const TIPOS = [
    { value: 'bombona_gas',        label: 'Bombona de gas (predice agotamiento)' },
    { value: 'bolsa_clap',         label: 'Bolsa CLAP (mide cobertura)' },
    { value: 'combo_alimenticio',  label: 'Combo alimenticio (mide cobertura)' },
    { value: 'agua',               label: 'Servicio de agua (estado por calle)' },
    { value: 'condicion_vivienda', label: 'Condición de las viviendas (sale del censo)' },
    { value: 'otro',               label: 'Otro (mide cobertura)' },
];

/**
 * Por tipo: qué mide (ayuda bajo el selector), ejemplo de nombre y si lleva
 * fechas de campaña. Un tipo desconocido cae en 'otro'.
 */
const INFO_TIPO = {
    bombona_gas: {
        ayuda:   'Calcula cuándo se agotará la bombona de cada familia según sus fechas de entrega.',
        ejemplo: 'Censo de gas — noviembre 2026',
        fechas:  true,
    },
    bolsa_clap: {
        ayuda:   'Mide qué familias ya recibieron la bolsa y cuáles faltan, calle por calle.',
        ejemplo: 'Bolsa CLAP — noviembre 2026',
        fechas:  true,
    },
    combo_alimenticio: {
        ayuda:   'Mide qué familias ya recibieron el combo y cuáles faltan, calle por calle.',
        ejemplo: 'Combo alimenticio — noviembre 2026',
        fechas:  true,
    },
    agua: {
        ayuda:   'Registra por familia si el agua llega, llega de forma intermitente o no llega.',
        ejemplo: 'Servicio de agua — noviembre 2026',
        fechas:  true,
    },
    condicion_vivienda: {
        ayuda:   'Se calcula sola con la condición de vivienda del censo de familias: no hay nada que registrar ni fechas que indicar.',
        ejemplo: 'Condición de las viviendas — 2026',
        fechas:  false,
    },
    otro: {
        ayuda:   'Mide qué familias ya recibieron o completaron el servicio, calle por calle.',
        ejemplo: 'Censo de servicios — noviembre 2026',
        fechas:  true,
    },
};

const FORM_INICIAL = {
    tipo:         'bombona_gas',
    nombre:       '',
    descripcion:  '',
    fecha_inicio: '',
    fecha_cierre: '',
};

export default function EncuestaForm({ onCancel, onSuccess }) {
    const [form,         setForm]         = useState(FORM_INICIAL);
    const [errors,       setErrors]       = useState({});
    const [isSaving,     setIsSaving]     = useState(false);
    const [errorGeneral, setErrorGeneral] = useState(null);

    const info       = INFO_TIPO[form.tipo] ?? INFO_TIPO.otro;
    const usaFechas  = info.fechas;

    const handleChange = (e) => {
        const { name, value } = e.target;

        setForm((prev) => {
            const siguiente = { ...prev, [name]: value };

            // Un tipo sin fechas descarta las que ya se hubieran escrito
            if (name === 'tipo' && !(INFO_TIPO[value] ?? INFO_TIPO.otro).fechas) {
                siguiente.fecha_inicio = '';
                siguiente.fecha_cierre = '';
            }

            return siguiente;
        });

        if (errors[name] || name === 'tipo') {
            setErrors((prev) => ({
                ...prev,
                [name]: undefined,
                ...(name === 'tipo' ? { fecha_inicio: undefined, fecha_cierre: undefined } : {}),
            }));
        }
    };

    const validar = () => {
        const nuevos = {};

        if (!form.nombre.trim()) {
            nuevos.nombre = ['El nombre de la campaña es obligatorio.'];
        }
        if (usaFechas && form.fecha_inicio && form.fecha_cierre && form.fecha_cierre < form.fecha_inicio) {
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
                fecha_inicio: usaFechas ? (form.fecha_inicio || null) : null,
                fecha_cierre: usaFechas ? (form.fecha_cierre || null) : null,
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
                <p className="encform-alert" role="alert">⚠ {errorGeneral}</p>
            )}

            <div className="encform-field">
                <label htmlFor="encform-tipo">
                    Tipo de encuesta <span className="encform-required">*</span>
                </label>
                <select
                    id="encform-tipo"
                    name="tipo"
                    value={form.tipo}
                    onChange={handleChange}
                    autoFocus
                >
                    {TIPOS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
                <span className="encform-hint">{info.ayuda}</span>
                {errors.tipo && <span className="encform-field__error">{errors.tipo[0]}</span>}
            </div>

            <div className="encform-field">
                <label htmlFor="encform-nombre">
                    Nombre de la campaña <span className="encform-required">*</span>
                </label>
                <input
                    id="encform-nombre"
                    name="nombre"
                    type="text"
                    value={form.nombre}
                    onChange={handleChange}
                    placeholder={`Ej: ${info.ejemplo}`}
                    maxLength={150}
                />
                {errors.nombre && <span className="encform-field__error">{errors.nombre[0]}</span>}
            </div>

            <div className="encform-field">
                <label htmlFor="encform-descripcion">
                    Descripción <span className="encform-optional">(opcional)</span>
                </label>
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

            {usaFechas && (
                <div className="encform-row">
                    <div className="encform-field">
                        <label htmlFor="encform-inicio">
                            Fecha de inicio <span className="encform-optional">(opcional)</span>
                        </label>
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
                        <label htmlFor="encform-cierre">
                            Fecha de cierre <span className="encform-optional">(opcional)</span>
                        </label>
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
            )}

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

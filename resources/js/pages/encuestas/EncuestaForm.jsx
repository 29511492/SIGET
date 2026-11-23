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

import { useEffect, useMemo, useState } from 'react';
import apiClient from '../../services/axios';
import './EncuestaForm.css';

const TIPOS = [
    { value: 'bombona_gas',        label: 'Bombona de gas (predice agotamiento)' },
    { value: 'bolsa_clap',         label: 'Bolsa CLAP (mide cobertura)' },
    { value: 'combo_alimenticio',  label: 'Combo alimenticio (mide cobertura)' },
    { value: 'agua',               label: 'Servicio de agua (estado por calle)' },
    { value: 'condicion_vivienda', label: 'Condición de las viviendas (sale del censo)' },
    { value: 'pago_servicio',      label: 'Pagos de un servicio (quién falta por pagar)' },
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
    pago_servicio: {
        ayuda:   'Se calcula sola con los pagos verificados del servicio elegido durante el período indicado: no hay nada que registrar.',
        ejemplo: 'Cuota de noviembre 2026',
        fechas:  true,
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
    cuenta_pago_id: '',
};

export default function EncuestaForm({ onCancel, onSuccess }) {
    const [form,         setForm]         = useState(FORM_INICIAL);
    const [errors,       setErrors]       = useState({});
    const [isSaving,     setIsSaving]     = useState(false);
    const [errorGeneral, setErrorGeneral] = useState(null);

    const info       = INFO_TIPO[form.tipo] ?? INFO_TIPO.otro;
    const usaFechas  = info.fechas;
    const esPago     = form.tipo === 'pago_servicio';

    // En las encuestas de pagos el período es obligatorio; en las demás es opcional
    const marcaPeriodo = esPago
        ? <span className="encform-required">*</span>
        : <span className="encform-optional">(opcional)</span>;

    // Cuentas activas, cargadas solo cuando se elige el tipo de pagos
    const [cuentas, setCuentas] = useState(null);

    useEffect(() => {
        if (!esPago || cuentas !== null) return undefined;

        let cancelado = false;
        apiClient.get('/v1/cuentas-pago')
            .then(({ data }) => {
                if (cancelado) return;
                const lista = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
                setCuentas(lista);
            })
            .catch(() => { if (!cancelado) setCuentas([]); });

        return () => { cancelado = true; };
    }, [esPago, cuentas]);

    // Un servicio puede tener dos cuentas (pago móvil y transferencia): se ofrece una por nombre
    const servicios = useMemo(() => {
        const vistos = new Map();
        (cuentas ?? []).forEach((c) => {
            if (!vistos.has(c.nombre_servicio)) vistos.set(c.nombre_servicio, c);
        });
        return [...vistos.values()];
    }, [cuentas]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        setForm((prev) => {
            const siguiente = { ...prev, [name]: value };

            // Un tipo sin fechas descarta las que ya se hubieran escrito
            if (name === 'tipo' && !(INFO_TIPO[value] ?? INFO_TIPO.otro).fechas) {
                siguiente.fecha_inicio = '';
                siguiente.fecha_cierre = '';
            }

            // El servicio solo aplica a las encuestas de pagos
            if (name === 'tipo' && value !== 'pago_servicio') {
                siguiente.cuenta_pago_id = '';
            }

            return siguiente;
        });

        if (errors[name] || name === 'tipo') {
            setErrors((prev) => ({
                ...prev,
                [name]: undefined,
                ...(name === 'tipo' ? { fecha_inicio: undefined, fecha_cierre: undefined, cuenta_pago_id: undefined } : {}),
            }));
        }
    };

    const validar = () => {
        const nuevos = {};

        if (!form.nombre.trim()) {
            nuevos.nombre = ['El nombre de la campaña es obligatorio.'];
        }
        if (esPago && !form.cuenta_pago_id) {
            nuevos.cuenta_pago_id = ['Selecciona el servicio cuyos pagos se van a controlar.'];
        }
        if (esPago && !form.fecha_inicio) {
            nuevos.fecha_inicio = ['Indica desde qué fecha se cuentan los pagos.'];
        }
        if (esPago && !form.fecha_cierre) {
            nuevos.fecha_cierre = ['Indica hasta qué fecha se cuentan los pagos.'];
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
                ...(esPago ? { cuenta_pago_id: Number(form.cuenta_pago_id) } : {}),
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

            {esPago && (
                <div className="encform-field">
                    <label htmlFor="encform-servicio">
                        Servicio a controlar <span className="encform-required">*</span>
                    </label>
                    <select
                        id="encform-servicio"
                        name="cuenta_pago_id"
                        value={form.cuenta_pago_id}
                        onChange={handleChange}
                        disabled={cuentas === null}
                    >
                        <option value="">{cuentas === null ? 'Cargando servicios…' : 'Selecciona un servicio…'}</option>
                        {servicios.map((c) => (
                            <option key={c.id} value={c.id}>{c.nombre_servicio}</option>
                        ))}
                    </select>
                    <span className="encform-hint">
                        {cuentas !== null && servicios.length === 0
                            ? 'No hay cuentas de pago activas. Crea una primero en Cuentas de Pago.'
                            : 'Se cuentan los pagos de todas las cuentas de este servicio (pago móvil y transferencia).'}
                    </span>
                    {errors.cuenta_pago_id && <span className="encform-field__error">{errors.cuenta_pago_id[0]}</span>}
                </div>
            )}

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
                            Fecha de inicio {marcaPeriodo}
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
                            Fecha de cierre {marcaPeriodo}
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

/**
 * resources/js/pages/familias/FamiliaForm.jsx
 *
 * Formulario de registro Y edición de familia — sept-2026: ahora
 * también gestiona los habitantes de la familia dentro del mismo
 * formulario (por instrucción del profesor, el módulo de
 * Habitantes se eliminó como módulo independiente).
 *
 * IMPORTS relativos desde esta carpeta:
 *   apiClient         → '../../services/axios'
 *   useAuth           → '../../hooks/useAuth'
 *   HabitanteFieldset → './HabitanteFieldset'
 *   CSS               → './FamiliaForm.css'
 *
 * USO — se renderiza dentro de un FormModal (components/ui/FormModal.jsx)
 * invocado desde FamiliaList.jsx. No navega, solo llama a las props
 * que le pasa quien lo abre.
 *
 *   Crear:  <FamiliaForm onCancel={...} onSuccess={(familia) => ...} />
 *   Editar: <FamiliaForm familiaExistente={familia} onCancel={...} onSuccess={...} />
 *
 * PROPS:
 *   familiaExistente     → objeto de familia (con .habitantes cargados)
 *                          para precargar el formulario en modo edición.
 *                          Si se omite, el formulario es de creación.
 *   onCancel()           → se llama al pulsar "Cancelar" (cierra el modal)
 *   onSuccess(familia)   → se llama tras guardar con éxito, 1.5s después
 *                          de mostrar el mensaje de éxito
 *
 * HABITANTES:
 *  - Se gestionan como un array en el estado local. Cada elemento
 *    trae `id` (si ya existe en BD) o no (si es nuevo, agregado en
 *    esta sesión de edición/creación).
 *  - Al enviar, todo el array viaja en el mismo payload que la
 *    familia (`habitantes: [...]`). El backend decide en una sola
 *    transacción qué crear, actualizar o dar de baja — ver
 *    FamiliaController::store()/update().
 *  - Los errores de validación del backend llegan con claves tipo
 *    "habitantes.0.nombres" — se parsean y se reparten por índice
 *    hacia cada HabitanteFieldset.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth }        from '../../hooks/useAuth';
import apiClient          from '../../services/axios';
import HabitanteFieldset  from './HabitanteFieldset';
import './FamiliaForm.css';

// ── Valores iniciales del formulario (modo creación) ──────────────
const INITIAL_FORM = {
    codigo_vivienda:    '',
    nombre_responsable: '',
    sede_id:            '',
    calle_id:           '',
    condicion_vivienda: 'regular',
    cantidad_bombonas:  1,
    capacidad_bombona:  '10kg',
    posee_agua_potable: true,
    posee_luz:          true,
    posee_aseo:         true,
    punto_referencia:   '',
};

const HABITANTE_VACIO = () => ({
    _localId:           crypto.randomUUID(),
    id:                 null,
    cedula:             '',
    nombres:            '',
    apellidos:          '',
    fecha_nacimiento:   '',
    sexo:               '',
    es_discapacitado:   false,
    tipo_discapacidad:  '',
    enfermedad_cronica: '',
    nivel_educativo:    'ninguno',
});

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

// ── Construye el estado inicial a partir de una familia existente ─
function buildInitialForm(familiaExistente) {
    if (!familiaExistente) return INITIAL_FORM;
    return {
        codigo_vivienda:    familiaExistente.codigo_vivienda,
        nombre_responsable: familiaExistente.nombre_responsable ?? '',
        sede_id:            familiaExistente.sede?.id ?? '',
        calle_id:           familiaExistente.calle?.id ?? '',
        condicion_vivienda: familiaExistente.condicion_vivienda,
        cantidad_bombonas:  familiaExistente.cantidad_bombonas,
        capacidad_bombona:  familiaExistente.capacidad_bombona,
        posee_agua_potable: familiaExistente.posee_agua_potable,
        posee_luz:          familiaExistente.posee_luz,
        posee_aseo:         familiaExistente.posee_aseo,
        punto_referencia:   familiaExistente.punto_referencia ?? '',
    };
}

function buildInitialHabitantes(familiaExistente) {
    if (!familiaExistente?.habitantes?.length) return [];
    return familiaExistente.habitantes.map(h => ({
        _localId:           `existente-${h.id}`,
        id:                 h.id,
        cedula:             h.cedula ?? '',
        nombres:            h.nombres,
        apellidos:          h.apellidos,
        fecha_nacimiento:   h.fecha_nacimiento ?? '',
        sexo:               h.sexo,
        es_discapacitado:   Boolean(h.es_discapacitado),
        tipo_discapacidad:  h.tipo_discapacidad ?? '',
        enfermedad_cronica: h.enfermedad_cronica ?? '',
        nivel_educativo:    h.nivel_educativo,
    }));
}

// ── Parsea errores backend "habitantes.N.campo" a un array por índice ─
function parseHabitanteErrors(backendErrors, cantidad) {
    const arr = Array.from({ length: cantidad }, () => ({}));
    Object.entries(backendErrors || {}).forEach(([key, msgs]) => {
        const match = key.match(/^habitantes\.(\d+)\.(.+)$/);
        if (match) {
            const idx = parseInt(match[1], 10);
            const field = match[2];
            if (arr[idx]) arr[idx][field] = Array.isArray(msgs) ? msgs[0] : msgs;
        }
    });
    return arr;
}

export default function FamiliaForm({ familiaExistente = null, onCancel, onSuccess }) {
    const { user } = useAuth();
    const isEditing = Boolean(familiaExistente);

    // ── Estado del formulario (familia) ─────────────────────────────
    const [form,         setForm]         = useState(() => buildInitialForm(familiaExistente));
    const [errors,       setErrors]       = useState({});
    const [serverError,  setServerError]  = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg,   setSuccessMsg]   = useState('');

    // ── Estado de los habitantes ─────────────────────────────────────
    const [habitantes,       setHabitantes]       = useState(() => buildInitialHabitantes(familiaExistente));
    const [habitantesErrors, setHabitantesErrors]  = useState([]);

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

    // ── 1b. En modo edición, precargar las calles de la sede actual ──
    // (aparte de fetchCalles, que resetea calle_id — aquí NO queremos
    // resetear, queremos conservar la calle ya seleccionada)
    useEffect(() => {
        if (!familiaExistente?.sede?.id) return;
        const cargarCallesIniciales = async () => {
            setLoadingCalles(true);
            try {
                const res = await apiClient.get(`/v1/sedes/${familiaExistente.sede.id}/calles`);
                setCalles(res.data.data);
            } catch {
                setServerError('No se pudieron cargar las calles de esta sede.');
            } finally {
                setLoadingCalles(false);
            }
        };
        cargarCallesIniciales();
        // Solo al montar — esta instancia del formulario vive para
        // una sola familia (FamiliaList la remonta con key={familia.id}).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── 2. Cargar calles cuando el USUARIO cambia la sede ──────────
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

    // ── Manejador genérico de cambio de campo (familia) ────────────
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newValue = type === 'checkbox' ? checked : value;

        // Apellido familiar / Responsable: solo letras (con tildes/ñ),
        // espacios, apóstrofes y guiones — bloquea números mientras se escribe.
        if (name === 'nombre_responsable') {
            newValue = newValue.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü\s'-]/g, '');
        }

        setForm(prev => ({ ...prev, [name]: newValue }));

        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
        if (serverError)  setServerError('');

        // Select encadenado: si cambia la sede, recargar calles
        if (name === 'sede_id') fetchCalles(value);
    };

    // ── Gestión del array de habitantes ─────────────────────────────
    const addHabitante = () => {
        setHabitantes(prev => [...prev, HABITANTE_VACIO()]);
        setHabitantesErrors([]); // los índices cambiaron, se recalculan al validar
    };

    const removeHabitante = (_localId) => {
        setHabitantes(prev => prev.filter(h => h._localId !== _localId));
        setHabitantesErrors([]);
    };

    const updateHabitante = (_localId, field, value) => {
        setHabitantes(prev => prev.map(h => h._localId === _localId
            ? {
                ...h,
                [field]: value,
                // Si se desmarca discapacidad, limpiar el tipo (igual que hacía HabitanteForm)
                ...(field === 'es_discapacitado' && !value ? { tipo_discapacidad: '' } : {}),
            }
            : h
        ));
    };

    // ── Validación cliente de la familia ────────────────────────────
    const validate = () => {
        const next = {};

        if (!form.codigo_vivienda.trim())
            next.codigo_vivienda = 'El código de vivienda es obligatorio.';
        else if (form.codigo_vivienda.length > 20)
            next.codigo_vivienda = 'Máximo 20 caracteres.';

        if (!form.nombre_responsable.trim())
            next.nombre_responsable = 'El responsable de la familia es obligatorio.';
        else if (!/^[A-Za-zÁÉÍÓÚÑÜáéíóúñü\s'-]+$/.test(form.nombre_responsable))
            next.nombre_responsable = 'Solo se permiten letras.';

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

    // ── Validación cliente de cada habitante ────────────────────────
    const validateHabitantes = () => {
        const soloLetras = /^[A-Za-zÁÉÍÓÚÑÜáéíóúñü\s'-]+$/;
        return habitantes.map(h => {
            const e = {};
            if (!h.nombres.trim())   e.nombres   = 'Los nombres son obligatorios.';
            else if (!soloLetras.test(h.nombres)) e.nombres = 'Solo se permiten letras.';
            if (!h.apellidos.trim()) e.apellidos = 'Los apellidos son obligatorios.';
            else if (!soloLetras.test(h.apellidos)) e.apellidos = 'Solo se permiten letras.';
            if (!h.fecha_nacimiento) e.fecha_nacimiento = 'La fecha de nacimiento es obligatoria.';
            if (!h.sexo)             e.sexo      = 'Debes seleccionar el sexo.';
            if (h.es_discapacitado && !h.tipo_discapacidad.trim())
                e.tipo_discapacidad = 'Describe el tipo de discapacidad.';
            if (h.cedula && h.cedula.length > 15)
                e.cedula = 'La cédula no puede tener más de 15 caracteres.';
            return e;
        });
    };

    // ── Submit ────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError('');
        setSuccessMsg('');

        const validationErrors    = validate();
        const habitantesErrorsArr = validateHabitantes();
        const hayErroresHabitantes = habitantesErrorsArr.some(err => Object.keys(err).length > 0);

        if (Object.keys(validationErrors).length > 0 || hayErroresHabitantes) {
            setErrors(validationErrors);
            setHabitantesErrors(habitantesErrorsArr);
            document.querySelector('.familia-field--error, .habitante-field--error')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setIsSubmitting(true);

        try {
            const payloadHabitantes = habitantes.map(h => ({
                ...(h.id ? { id: h.id } : {}),
                cedula:             h.cedula.trim() || null,
                nombres:            h.nombres,
                apellidos:          h.apellidos,
                fecha_nacimiento:   h.fecha_nacimiento,
                sexo:               h.sexo,
                es_discapacitado:   Boolean(h.es_discapacitado),
                tipo_discapacidad:  h.tipo_discapacidad.trim() || null,
                enfermedad_cronica: h.enfermedad_cronica.trim() || null,
                nivel_educativo:    h.nivel_educativo,
            }));

            const payload = {
                ...form,
                sede_id:            parseInt(form.sede_id),
                calle_id:           parseInt(form.calle_id),
                cantidad_bombonas:  parseInt(form.cantidad_bombonas),
                posee_agua_potable: Boolean(form.posee_agua_potable),
                posee_luz:          Boolean(form.posee_luz),
                posee_aseo:         Boolean(form.posee_aseo),
                habitantes:         payloadHabitantes,
            };

            /**
             * POST /api/v1/familias  (crear)  o  PUT /api/v1/familias/{id}  (editar)
             * El backend valida y persiste familia + habitantes en una sola
             * transacción — ver FamiliaController::store()/update().
             */
            const response = isEditing
                ? await apiClient.put(`/v1/familias/${familiaExistente.id}`, payload)
                : await apiClient.post('/v1/familias', payload);

            const familia = response.data.data;
            setSuccessMsg(
                isEditing
                    ? `✅ Familia "${familia.nombre_responsable}" (${familia.codigo_vivienda}) actualizada correctamente.`
                    : `✅ Familia "${familia.nombre_responsable}" (${familia.codigo_vivienda}) registrada correctamente.`
            );

            // Avisar al padre (FamiliaList) tras 1.5s para que se vea el mensaje.
            // El padre es quien cierra el modal y refresca la tabla.
            setTimeout(() => onSuccess?.(familia), 1500);

        } catch (err) {
            if (!err.response) {
                setServerError('Error de conexión. Verifica tu red e intenta de nuevo.');
                return;
            }

            const { status, data } = err.response;

            if (status === 422) {
                const backendErrors = data.errors ?? {};

                // Separar errores de la familia de los errores anidados de habitantes
                const familiaErrors = {};
                Object.entries(backendErrors).forEach(([key, msgs]) => {
                    if (!key.startsWith('habitantes.')) familiaErrors[key] = msgs;
                });

                setErrors(familiaErrors);
                setHabitantesErrors(parseHabitanteErrors(backendErrors, habitantes.length));
                setServerError(data.message ?? 'Revisa los campos marcados.');
            } else if (status === 403) {
                setServerError(isEditing
                    ? 'No tienes permisos para editar familias.'
                    : 'No tienes permisos para registrar familias.');
            } else {
                setServerError(data.message ?? 'Error inesperado. Intenta de nuevo.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const fieldError = (name) => errors[name]?.[0] ?? errors[name] ?? '';

    // ─────────────────────────────────────────────────────────────
    //  RENDER
    //  (sin topbar ni wrapper de página: eso lo da FormModal)
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="familia-form-container">

            {/* ── Encabezado ──────────────────────────────────── */}
            <div className="familia-form-heading">
                <h1 className="familia-form-heading__title">
                    {isEditing ? 'Editar Familia' : 'Registrar Nueva Familia'}
                </h1>
                <p className="familia-form-heading__subtitle">
                    {isEditing
                        ? 'Actualiza los datos de la vivienda y de sus habitantes.'
                        : 'Complete todos los campos obligatorios para incorporar la familia al censo comunal, incluyendo sus habitantes.'}
                </p>
            </div>

            {successMsg && (
                <div className="familia-alert familia-alert--success" role="status">
                    {successMsg}
                </div>
            )}

            {serverError && (
                <div className="familia-alert familia-alert--error" role="alert">
                    <span>⚠</span> {serverError}
                </div>
            )}

            <form className="familia-form" onSubmit={handleSubmit} noValidate>

                {/* ════════════════════════════════════════════
                    SECCIÓN 1 — Identificación de la vivienda
                    ════════════════════════════════════════════ */}
                <fieldset className="familia-fieldset">
                    <legend className="familia-fieldset__legend">
                        <span>🏠</span> Identificación de la Vivienda
                    </legend>

                    <div className="familia-form-row">

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
                                <p className="familia-field__error">{fieldError('codigo_vivienda')}</p>
                            )}
                        </div>

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
                                <p className="familia-field__error">{fieldError('nombre_responsable')}</p>
                            )}
                        </div>

                    </div>

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
                                    <option key={sede.id} value={sede.id}>{sede.nombre}</option>
                                ))}
                            </select>
                            {fieldError('sede_id') && (
                                <p className="familia-field__error">{fieldError('sede_id')}</p>
                            )}
                        </div>

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
                                    <option key={calle.id} value={calle.id}>{calle.nombre}</option>
                                ))}
                            </select>
                            {fieldError('calle_id') && (
                                <p className="familia-field__error">{fieldError('calle_id')}</p>
                            )}
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
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

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
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

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
                                <p className="familia-field__error">{fieldError('cantidad_bombonas')}</p>
                            )}
                        </div>

                    </div>

                    {/* Servicios básicos — toggles Agua / Luz / Aseo */}
                    <div className="familia-servicios-toggles">

                        <div className="familia-field familia-field--inline">
                            <label className="familia-toggle" htmlFor="posee_agua_potable">
                                <input
                                    id="posee_agua_potable" name="posee_agua_potable" type="checkbox"
                                    checked={form.posee_agua_potable} onChange={handleChange}
                                    className="familia-toggle__input" disabled={isSubmitting}
                                />
                                <span className="familia-toggle__track" aria-hidden="true" />
                                <span className="familia-toggle__label">
                                    {form.posee_agua_potable ? '💧 Tiene acceso a agua potable' : '🚫 Sin acceso a agua potable'}
                                </span>
                            </label>
                        </div>

                        <div className="familia-field familia-field--inline">
                            <label className="familia-toggle" htmlFor="posee_luz">
                                <input
                                    id="posee_luz" name="posee_luz" type="checkbox"
                                    checked={form.posee_luz} onChange={handleChange}
                                    className="familia-toggle__input" disabled={isSubmitting}
                                />
                                <span className="familia-toggle__track" aria-hidden="true" />
                                <span className="familia-toggle__label">
                                    {form.posee_luz ? '💡 Tiene servicio eléctrico' : '🚫 Sin servicio eléctrico'}
                                </span>
                            </label>
                        </div>

                        <div className="familia-field familia-field--inline">
                            <label className="familia-toggle" htmlFor="posee_aseo">
                                <input
                                    id="posee_aseo" name="posee_aseo" type="checkbox"
                                    checked={form.posee_aseo} onChange={handleChange}
                                    className="familia-toggle__input" disabled={isSubmitting}
                                />
                                <span className="familia-toggle__track" aria-hidden="true" />
                                <span className="familia-toggle__label">
                                    {form.posee_aseo ? '🗑️ Recibe recolección de aseo' : '🚫 Sin recolección de aseo'}
                                </span>
                            </label>
                        </div>

                    </div>

                </fieldset>

                {/* ════════════════════════════════════════════
                    SECCIÓN 4 — Habitantes de la familia (NUEVO)
                    ════════════════════════════════════════════ */}
                <fieldset className="familia-fieldset">
                    <legend className="familia-fieldset__legend">
                        <span>👨‍👩‍👧</span> Habitantes de la Familia
                    </legend>

                    {habitantes.length === 0 && (
                        <p className="familia-habitantes-empty">
                            Aún no has agregado habitantes. Usa el botón de abajo para añadir el primero.
                        </p>
                    )}

                    <div className="familia-habitantes-list">
                        {habitantes.map((h, idx) => (
                            <HabitanteFieldset
                                key={h._localId}
                                habitante={h}
                                index={idx}
                                errors={habitantesErrors[idx] ?? {}}
                                onChange={(field, value) => updateHabitante(h._localId, field, value)}
                                onRemove={() => removeHabitante(h._localId)}
                                disabled={isSubmitting}
                            />
                        ))}
                    </div>

                    <button
                        type="button"
                        className="familia-btn familia-btn--secondary familia-btn--add-habitante"
                        onClick={addHabitante}
                        disabled={isSubmitting}
                    >
                        + Agregar Habitante
                    </button>
                </fieldset>

                {/* ── Botones de acción ──────────────────────── */}
                <div className="familia-form-actions">
                    <button
                        type="button"
                        className="familia-btn familia-btn--secondary"
                        onClick={() => onCancel?.()}
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
                                {isEditing ? 'Guardando...' : 'Registrando...'}
                            </>
                        ) : (
                            isEditing ? 'Guardar Cambios' : '+ Registrar Familia'
                        )}
                    </button>
                </div>

            </form>
        </div>
    );
}

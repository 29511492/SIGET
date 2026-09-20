/**
 * resources/js/pages/familias/HabitanteFieldset.jsx
 *
 * Sub-formulario de UN habitante, reutilizado dentro del array
 * "habitantes" de FamiliaForm.jsx. Reemplaza al antiguo
 * HabitanteForm.jsx de página completa (ELIMINADO — sept-2026,
 * por instrucción del profesor: el registro de habitantes ya no
 * es un módulo independiente, vive exclusivamente dentro del
 * formulario de Familia).
 *
 * Este componente es "tonto" a propósito: no tiene estado propio,
 * no llama a la API. Todo el estado (incluida la lista completa
 * de habitantes) vive en FamiliaForm.jsx — este componente solo
 * renderiza un elemento de esa lista y notifica cambios hacia arriba.
 *
 * PROPS:
 *   habitante  → objeto con los campos de este habitante
 *   index      → posición en el array (para el título "Habitante N")
 *   errors     → objeto { campo: mensaje } de errores para ESTE habitante
 *   onChange(field, value) → notifica un cambio de campo al padre
 *   onRemove() → notifica que se debe quitar esta fila
 *   disabled   → true mientras se envía el formulario
 */

import './HabitanteFieldset.css';

const SEXO_OPTIONS = [
    { value: 'masculino', label: 'Masculino' },
    { value: 'femenino',  label: 'Femenino'  },
    { value: 'otro',      label: 'Otro'      },
];

const NIVEL_OPTIONS = [
    { value: 'ninguno',       label: 'Ninguno'       },
    { value: 'primaria',      label: 'Primaria'      },
    { value: 'bachillerato',  label: 'Bachillerato'  },
    { value: 'tecnico',       label: 'Técnico'       },
    { value: 'universitario', label: 'Universitario' },
    { value: 'postgrado',     label: 'Postgrado'     },
];

// ── Cálculo de edad (idéntico al que tenía HabitanteForm.jsx) ────
function calcularEdad(fechaStr) {
    if (!fechaStr) return null;
    const hoy = new Date();
    const nac = new Date(fechaStr + 'T00:00:00');
    if (isNaN(nac)) return null;
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad >= 0 ? edad : null;
}

export default function HabitanteFieldset({
    habitante,
    index,
    errors = {},
    onChange,
    onRemove,
    disabled,
}) {
    const edadCalculada = calcularEdad(habitante.fecha_nacimiento);
    const fieldError = (name) => errors[name] ?? '';

    const handleFieldChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newValue = type === 'checkbox' ? checked : value;

        // Nombres y apellidos: solo letras (con tildes/ñ), espacios,
        // apóstrofes y guiones — bloquea números mientras se escribe.
        if (name === 'nombres' || name === 'apellidos') {
            newValue = newValue.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü\s'-]/g, '');
        }

        onChange(name, newValue);
    };

    return (
        <div className="habitante-card">
            <div className="habitante-card__header">
                <span className="habitante-card__title">
                    👤 Habitante {index + 1}
                    {habitante.nombres && ` — ${habitante.nombres} ${habitante.apellidos}`}
                </span>
                <button
                    type="button"
                    className="habitante-card__remove"
                    onClick={onRemove}
                    disabled={disabled}
                >
                    🗑 Quitar
                </button>
            </div>

            {/* Datos personales */}
            <div className="habitante-form-row">
                <div className={`habitante-field ${fieldError('nombres') ? 'habitante-field--error' : ''}`}>
                    <label className="habitante-field__label">
                        Nombres <span className="required">*</span>
                    </label>
                    <input
                        name="nombres" type="text"
                        value={habitante.nombres} onChange={handleFieldChange}
                        placeholder="Ej: Carlos Alberto"
                        className="habitante-field__input"
                        maxLength={100} disabled={disabled}
                    />
                    {fieldError('nombres') && <p className="habitante-field__error">{fieldError('nombres')}</p>}
                </div>

                <div className={`habitante-field ${fieldError('apellidos') ? 'habitante-field--error' : ''}`}>
                    <label className="habitante-field__label">
                        Apellidos <span className="required">*</span>
                    </label>
                    <input
                        name="apellidos" type="text"
                        value={habitante.apellidos} onChange={handleFieldChange}
                        placeholder="Ej: Pérez González"
                        className="habitante-field__input"
                        maxLength={100} disabled={disabled}
                    />
                    {fieldError('apellidos') && <p className="habitante-field__error">{fieldError('apellidos')}</p>}
                </div>
            </div>

            <div className="habitante-form-row habitante-form-row--three">
                <div className={`habitante-field ${fieldError('cedula') ? 'habitante-field--error' : ''}`}>
                    <label className="habitante-field__label">
                        Cédula <span className="habitante-field__optional">(opcional)</span>
                    </label>
                    <input
                        name="cedula" type="text"
                        value={habitante.cedula} onChange={handleFieldChange}
                        placeholder="Ej: V-12345678"
                        className="habitante-field__input"
                        maxLength={15} disabled={disabled}
                    />
                    {fieldError('cedula') && <p className="habitante-field__error">{fieldError('cedula')}</p>}
                </div>

                <div className={`habitante-field ${fieldError('fecha_nacimiento') ? 'habitante-field--error' : ''}`}>
                    <label className="habitante-field__label">
                        Fecha de nacimiento <span className="required">*</span>
                    </label>
                    <div className="habitante-date-wrap">
                        <input
                            name="fecha_nacimiento" type="date"
                            value={habitante.fecha_nacimiento} onChange={handleFieldChange}
                            max={new Date().toISOString().split('T')[0]}
                            className="habitante-field__input"
                            disabled={disabled}
                        />
                        {edadCalculada !== null && edadCalculada >= 0 && (
                            <span className="edad-badge">{edadCalculada} años</span>
                        )}
                    </div>
                    {fieldError('fecha_nacimiento') && <p className="habitante-field__error">{fieldError('fecha_nacimiento')}</p>}
                </div>

                <div className={`habitante-field ${fieldError('sexo') ? 'habitante-field--error' : ''}`}>
                    <label className="habitante-field__label">
                        Sexo <span className="required">*</span>
                    </label>
                    <select
                        name="sexo" value={habitante.sexo} onChange={handleFieldChange}
                        className="habitante-field__select" disabled={disabled}
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
                <label className="habitante-field__label">
                    Nivel de instrucción <span className="required">*</span>
                </label>
                <div className="nivel-radio-group">
                    {NIVEL_OPTIONS.map(opt => (
                        <label
                            key={opt.value}
                            className={`nivel-radio ${habitante.nivel_educativo === opt.value ? 'nivel-radio--active' : ''}`}
                        >
                            <input
                                type="radio"
                                name="nivel_educativo"
                                value={opt.value}
                                checked={habitante.nivel_educativo === opt.value}
                                onChange={handleFieldChange}
                                disabled={disabled}
                            />
                            {opt.label}
                        </label>
                    ))}
                </div>
                {fieldError('nivel_educativo') && <p className="habitante-field__error">{fieldError('nivel_educativo')}</p>}
            </div>

            {/* Salud */}
            <div className="habitante-field">
                <label className="habitante-toggle">
                    <input
                        name="es_discapacitado" type="checkbox"
                        checked={habitante.es_discapacitado}
                        onChange={handleFieldChange}
                        className="habitante-toggle__input"
                        disabled={disabled}
                    />
                    <span className="habitante-toggle__track" aria-hidden="true" />
                    <span className="habitante-toggle__label">
                        {habitante.es_discapacitado
                            ? '♿ Tiene alguna discapacidad'
                            : '♿ Sin discapacidad registrada'}
                    </span>
                </label>
            </div>

            {habitante.es_discapacitado && (
                <div className={`habitante-field habitante-field--conditional ${fieldError('tipo_discapacidad') ? 'habitante-field--error' : ''}`}>
                    <label className="habitante-field__label">
                        Tipo de discapacidad <span className="required">*</span>
                    </label>
                    <input
                        name="tipo_discapacidad" type="text"
                        value={habitante.tipo_discapacidad} onChange={handleFieldChange}
                        placeholder="Ej: Motora, Visual, Auditiva, Cognitiva..."
                        className="habitante-field__input"
                        maxLength={100} disabled={disabled}
                        autoFocus
                    />
                    {fieldError('tipo_discapacidad') && (
                        <p className="habitante-field__error">{fieldError('tipo_discapacidad')}</p>
                    )}
                </div>
            )}

            <div className="habitante-field">
                <label className="habitante-field__label">
                    Enfermedad crónica
                    <span className="habitante-field__optional">(opcional)</span>
                </label>
                <input
                    name="enfermedad_cronica" type="text"
                    value={habitante.enfermedad_cronica} onChange={handleFieldChange}
                    placeholder="Ej: Diabetes, Hipertensión, Asma..."
                    className="habitante-field__input"
                    maxLength={150} disabled={disabled}
                />
            </div>
        </div>
    );
}

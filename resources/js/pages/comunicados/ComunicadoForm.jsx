import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../services/axios';
import './ComunicadoForm.css';

/**
 * ComunicadoForm
 * Página de redacción de un comunicado oficial.
 * Ruta: /comunicados/nuevo
 *
 * Flujo:
 *   1. Usuario redacta → guarda como borrador o marca como enviado
 *   2. Backend persiste en tabla `comunicados` y retorna el recurso
 *   3. Se habilita el botón de descarga PDF contra el endpoint /pdf
 */
function ComunicadoForm() {
    // ── Estado del formulario ──────────────────────────────────────────────
    const [form, setForm] = useState({
        destinatario:       '',
        cargo_destinatario: '',
        asunto:             '',
        cuerpo:             '',
        estado:             'borrador',
    });

    const [errores,            setErrores]            = useState({});
    const [enviando,           setEnviando]            = useState(false);
    const [mensajeExito,       setMensajeExito]        = useState('');
    const [comunicadoGuardado, setComunicadoGuardado]  = useState(null);
    const [descargandoPdf,     setDescargandoPdf]      = useState(false);

    // ── Handlers ──────────────────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        // Limpiar error del campo en cuanto el usuario escribe
        if (errores[name]) {
            setErrores((prev) => ({ ...prev, [name]: null }));
        }
    };

    const handleGuardar = async (estadoFinal = 'borrador') => {
        setEnviando(true);
        setErrores({});
        setMensajeExito('');

        try {
            const payload = { ...form, estado: estadoFinal };

            const response = await apiClient.post('/v1/comunicados', payload, {
                headers: { Accept: 'application/json' },
            });

            setComunicadoGuardado(response.data.data);
            setMensajeExito(
                estadoFinal === 'enviado'
                    ? `✅ Comunicado ${response.data.data.numero_oficio} marcado como enviado.`
                    : `✅ Borrador guardado como ${response.data.data.numero_oficio}.`
            );
        } catch (err) {
            if (err.response?.status === 422) {
                setErrores(err.response.data.errors ?? {});
            } else {
                setErrores({ general: ['Error inesperado. Intenta nuevamente.'] });
            }
        } finally {
            setEnviando(false);
        }
    };

    const handleDescargarPdf = async () => {
        if (!comunicadoGuardado) return;
        setDescargandoPdf(true);

        try {
            const response = await apiClient.get(
                `/v1/comunicados/${comunicadoGuardado.id}/pdf`,
                {
                    responseType: 'blob',
                    headers: { Accept: 'application/pdf' },
                }
            );

            const url = window.URL.createObjectURL(
                new Blob([response.data], { type: 'application/pdf' })
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = `comunicado_${comunicadoGuardado.numero_oficio}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('No se pudo generar el PDF. Intenta nuevamente.');
        } finally {
            setDescargandoPdf(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="com-form__page">

            {/* ── Header de sección ─────────────────────────────────── */}
            <div className="com-form__header">
                <div>
                    <h1 className="com-form__titulo">Nuevo Comunicado</h1>
                    <p className="com-form__subtitulo">
                        Redacta una carta u oficio oficial del Consejo Comunal
                    </p>
                </div>
                <Link to="/comunicados" className="com-form__btn-back">
                    ← Historial
                </Link>
            </div>

            {/* ── Mensaje de éxito + botón PDF ──────────────────────── */}
            {mensajeExito && (
                <div className="com-form__alerta com-form__alerta--exito">
                    <span>{mensajeExito}</span>
                    {comunicadoGuardado && (
                        <button
                            className="com-form__btn-pdf"
                            onClick={handleDescargarPdf}
                            disabled={descargandoPdf}
                        >
                            {descargandoPdf ? 'Generando PDF…' : '⬇ Descargar PDF'}
                        </button>
                    )}
                </div>
            )}

            {/* ── Error general ─────────────────────────────────────── */}
            {errores.general && (
                <div className="com-form__alerta com-form__alerta--error">
                    {errores.general[0]}
                </div>
            )}

            {/* ── Tarjeta del formulario ────────────────────────────── */}
            <div className="com-form__card">

                {/* Fila: Destinatario + Cargo */}
                <div className="com-form__fila-doble">
                    <div className="com-form__grupo">
                        <label className="com-form__label" htmlFor="destinatario">
                            Destinatario <span className="com-form__req">*</span>
                        </label>
                        <input
                            id="destinatario"
                            name="destinatario"
                            type="text"
                            className={`com-form__input${errores.destinatario ? ' com-form__input--error' : ''}`}
                            placeholder="Ej: Alcaldía del Municipio Libertador"
                            value={form.destinatario}
                            onChange={handleChange}
                            maxLength={200}
                        />
                        {errores.destinatario && (
                            <span className="com-form__error">{errores.destinatario[0]}</span>
                        )}
                    </div>

                    <div className="com-form__grupo">
                        <label className="com-form__label" htmlFor="cargo_destinatario">
                            Cargo del Destinatario
                        </label>
                        <input
                            id="cargo_destinatario"
                            name="cargo_destinatario"
                            type="text"
                            className="com-form__input"
                            placeholder="Ej: Alcalde / Gerente General"
                            value={form.cargo_destinatario}
                            onChange={handleChange}
                            maxLength={150}
                        />
                    </div>
                </div>

                {/* Asunto */}
                <div className="com-form__grupo">
                    <label className="com-form__label" htmlFor="asunto">
                        Asunto <span className="com-form__req">*</span>
                    </label>
                    <input
                        id="asunto"
                        name="asunto"
                        type="text"
                        className={`com-form__input${errores.asunto ? ' com-form__input--error' : ''}`}
                        placeholder="Ej: Solicitud de dotación de materiales de construcción"
                        value={form.asunto}
                        onChange={handleChange}
                        maxLength={300}
                    />
                    {errores.asunto && (
                        <span className="com-form__error">{errores.asunto[0]}</span>
                    )}
                </div>

                {/* Cuerpo */}
                <div className="com-form__grupo">
                    <label className="com-form__label" htmlFor="cuerpo">
                        Cuerpo del Comunicado <span className="com-form__req">*</span>
                    </label>
                    <p className="com-form__hint">
                        Redacta el contenido principal. El saludo y la despedida se generan automáticamente en el PDF.
                    </p>
                    <textarea
                        id="cuerpo"
                        name="cuerpo"
                        rows={12}
                        className={`com-form__textarea${errores.cuerpo ? ' com-form__input--error' : ''}`}
                        placeholder="Nos dirigimos a usted en la oportunidad de solicitar..."
                        value={form.cuerpo}
                        onChange={handleChange}
                    />
                    {errores.cuerpo && (
                        <span className="com-form__error">{errores.cuerpo[0]}</span>
                    )}
                    <span className="com-form__contador">{form.cuerpo.length} caracteres</span>
                </div>

                {/* ── Acciones ──────────────────────────────────────── */}
                <div className="com-form__acciones">
                    <button
                        className="com-form__btn com-form__btn--secundario"
                        onClick={() => handleGuardar('borrador')}
                        disabled={enviando}
                        type="button"
                    >
                        {enviando ? 'Guardando…' : '💾 Guardar Borrador'}
                    </button>

                    <button
                        className="com-form__btn com-form__btn--primario"
                        onClick={() => handleGuardar('enviado')}
                        disabled={enviando}
                        type="button"
                    >
                        {enviando ? 'Procesando…' : '📨 Guardar y Marcar como Enviado'}
                    </button>
                </div>

            </div>
        </div>
    );
}

export default ComunicadoForm;

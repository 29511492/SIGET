import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/axios';
import './ComunicadoForm.css'; // Reutiliza los estilos del formulario de creación

/**
 * ComunicadoEdit
 * Edición de un comunicado existente. Solo permitido si estado === 'borrador'.
 * Ruta: /comunicados/:id/editar
 */
function ComunicadoEdit() {
    const { id }   = useParams();
    const navigate = useNavigate();

    // ── Estado ─────────────────────────────────────────────────────────────
    const [form, setForm] = useState({
        destinatario:       '',
        cargo_destinatario: '',
        asunto:             '',
        cuerpo:             '',
        estado:             'borrador',
    });

    const [cargandoDatos, setCargandoDatos] = useState(true);
    const [errores,       setErrores]       = useState({});
    const [guardando,     setGuardando]     = useState(false);
    const [mensajeExito,  setMensajeExito]  = useState('');
    const [bloqueado,     setBloqueado]     = useState(false); // true si no es borrador

    // ── Cargar comunicado existente ────────────────────────────────────────
    useEffect(() => {
        const fetchComunicado = async () => {
            setCargandoDatos(true);
            try {
                const response = await apiClient.get(`/v1/comunicados/${id}`, {
                    headers: { Accept: 'application/json' },
                });
                const data = response.data.data;

                // Bloquear edición si no es borrador
                if (data.estado !== 'borrador') {
                    setBloqueado(true);
                    return;
                }

                setForm({
                    destinatario:       data.destinatario       ?? '',
                    cargo_destinatario: data.cargo_destinatario ?? '',
                    asunto:             data.asunto             ?? '',
                    cuerpo:             data.cuerpo             ?? '',
                    estado:             data.estado             ?? 'borrador',
                });
            } catch (err) {
                setErrores({ general: ['No se pudo cargar el comunicado.'] });
            } finally {
                setCargandoDatos(false);
            }
        };

        fetchComunicado();
    }, [id]);

    // ── Handlers ──────────────────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        if (errores[name]) {
            setErrores((prev) => ({ ...prev, [name]: null }));
        }
    };

    const handleGuardar = async (estadoFinal = 'borrador') => {
        setGuardando(true);
        setErrores({});
        setMensajeExito('');

        try {
            const payload = { ...form, estado: estadoFinal };

            await apiClient.put(`/v1/comunicados/${id}`, payload, {
                headers: { Accept: 'application/json' },
            });

            if (estadoFinal === 'enviado') {
                // Si se marcó como enviado, volver al detalle
                navigate(`/comunicados/${id}`);
            } else {
                setMensajeExito('✅ Borrador actualizado correctamente.');
            }
        } catch (err) {
            if (err.response?.status === 422) {
                setErrores(err.response.data.errors ?? {});
            } else {
                setErrores({ general: [err.response?.data?.message ?? 'Error inesperado.'] });
            }
        } finally {
            setGuardando(false);
        }
    };

    // ── Render: cargando ───────────────────────────────────────────────────
    if (cargandoDatos) {
        return (
            <div className="com-form__page">
                <div style={{ textAlign: 'center', padding: '60px', color: '#8898aa' }}>
                    <span className="spin">↻</span> Cargando comunicado…
                </div>
            </div>
        );
    }

    // ── Render: bloqueado (no es borrador) ────────────────────────────────
    if (bloqueado) {
        return (
            <div className="com-form__page">
                <div className="com-form__alerta com-form__alerta--error">
                    Este comunicado ya fue enviado o archivado y no puede modificarse.
                </div>
                <Link to={`/comunicados/${id}`} className="com-form__btn com-form__btn--secundario">
                    ← Ver detalle
                </Link>
            </div>
        );
    }

    // ── Render: formulario ─────────────────────────────────────────────────
    return (
        <div className="com-form__page">

            {/* ── Header ────────────────────────────────────────────── */}
            <div className="com-form__header">
                <div>
                    <h1 className="com-form__titulo">Editar Comunicado</h1>
                    <p className="com-form__subtitulo">
                        Modificando borrador — los cambios reemplazan el contenido anterior
                    </p>
                </div>
                <Link to={`/comunicados/${id}`} className="com-form__btn-back">
                    ← Ver detalle
                </Link>
            </div>

            {/* ── Mensaje de éxito ──────────────────────────────────── */}
            {mensajeExito && (
                <div className="com-form__alerta com-form__alerta--exito">
                    {mensajeExito}
                </div>
            )}

            {/* ── Error general ─────────────────────────────────────── */}
            {errores.general && (
                <div className="com-form__alerta com-form__alerta--error">
                    {errores.general[0]}
                </div>
            )}

            {/* ── Formulario ────────────────────────────────────────── */}
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
                    <textarea
                        id="cuerpo"
                        name="cuerpo"
                        rows={12}
                        className={`com-form__textarea${errores.cuerpo ? ' com-form__input--error' : ''}`}
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
                        disabled={guardando}
                        type="button"
                    >
                        {guardando ? 'Guardando…' : '💾 Guardar Cambios'}
                    </button>

                    <button
                        className="com-form__btn com-form__btn--primario"
                        onClick={() => handleGuardar('enviado')}
                        disabled={guardando}
                        type="button"
                    >
                        {guardando ? 'Procesando…' : '📨 Guardar y Marcar como Enviado'}
                    </button>
                </div>

            </div>
        </div>
    );
}

export default ComunicadoEdit;

/**
 * resources/js/pages/encuestas/RegistrarEntregaForm.jsx
 *
 * Registro de entregas por familia dentro de una encuesta (solo admin).
 *
 * CORRECCIONES respecto a la versión original (oct-2026):
 *  · La fecha de "hoy" se calcula en hora LOCAL. Con toISOString() daba la
 *    fecha UTC, que en Venezuela pasa a "mañana" después de las 8 p. m. y
 *    el backend rechaza fechas futuras.
 *  · Cantidad entre 1 y 99 y fecha no futura, validadas también en el cliente.
 *  · Si la encuesta está cerrada, el formulario se deshabilita con un aviso.
 *  · El historial está paginado y eliminar pide confirmación (ConfirmModal).
 *  · El buscador de familias ignora respuestas atrasadas (evita que un
 *    resultado viejo pise a uno más reciente).
 *
 * REGISTRO MASIVO (oct-2026, propuesta de la compañera): la pantalla tiene dos
 * modos. "Una familia" es el formulario de siempre; "Varias familias" abre
 * RegistroMasivo, que registra la misma entrega a toda una calle de una sola
 * vez. Ambos alimentan el mismo historial de abajo.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient    from '../../services/axios';
import ConfirmModal from '../../components/ui/ConfirmModal';
import RegistroMasivo from './RegistroMasivo';
import '../familias/FamiliaList.css';
import './RegistrarEntregaForm.css';

const TIPO_LABELS = {
    bombona_gas: 'Bombona de gas',
    bolsa_clap:  'Bolsa CLAP',
    otro:        'Otro',
};

const POR_PAGINA = 20;

// Fecha de hoy en hora local, formato YYYY-MM-DD
const hoyLocal = () => {
    const d   = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
};

const formatearFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');

export default function RegistrarEntregaForm() {
    const { id }   = useParams(); // id de la encuesta
    const navigate = useNavigate();

    const [encuesta,       setEncuesta]       = useState(null);
    const [respuestas,     setRespuestas]     = useState([]);
    const [meta,           setMeta]           = useState({ current_page: 1, last_page: 1, total: 0 });
    const [pagina,         setPagina]         = useState(1);
    const [cargandoResp,   setCargandoResp]   = useState(true);
    const [error,          setError]          = useState(null);

    // ── Buscador de familia ───────────────────────────────────
    const [busqueda,         setBusqueda]         = useState('');
    const [resultados,       setResultados]       = useState([]);
    const [familiaSel,       setFamiliaSel]       = useState(null);
    const [buscando,         setBuscando]         = useState(false);

    // ── Datos de la entrega ───────────────────────────────────
    const [cantidad,      setCantidad]      = useState('1');
    const [fechaEntrega,  setFechaEntrega]  = useState(hoyLocal);
    const [observaciones, setObservaciones] = useState('');
    const [errors,        setErrors]        = useState({});
    const [isSaving,      setIsSaving]      = useState(false);

    // ── Eliminar ──────────────────────────────────────────────
    const [aEliminar,  setAEliminar]  = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // 'individual' = una familia · 'masivo' = varias familias a la vez
    const [modo, setModo] = useState('individual');

    const cerrada = encuesta !== null && !encuesta.activa;

    // Datos de la encuesta
    useEffect(() => {
        let cancelado = false;
        apiClient.get(`/v1/encuestas/${id}`)
            .then(({ data }) => { if (!cancelado) setEncuesta(data.data); })
            .catch((err) => {
                if (!cancelado) setError(err.response?.data?.message ?? 'No se pudo cargar la encuesta.');
            });
        return () => { cancelado = true; };
    }, [id]);

    // Historial de entregas (paginado)
    const cargarRespuestas = useCallback(async (silencioso = false) => {
        if (!silencioso) setCargandoResp(true);
        try {
            const { data } = await apiClient.get(`/v1/encuestas/${id}/respuestas`, {
                params: { page: pagina, per_page: POR_PAGINA },
            });

            if (data.data.length === 0 && pagina > 1) {
                setPagina(pagina - 1);
                return;
            }

            setRespuestas(data.data);
            setMeta(data.meta);
        } catch (err) {
            setError(err.response?.data?.message ?? 'No se pudieron cargar las entregas registradas.');
        } finally {
            setCargandoResp(false);
        }
    }, [id, pagina]);

    useEffect(() => {
        cargarRespuestas();
    }, [cargarRespuestas]);

    // El registro masivo avisa cuando termina para refrescar el historial
    const refrescarHistorial = () => {
        if (pagina === 1) {
            cargarRespuestas(true);
        } else {
            setPagina(1);
        }
    };

    // Buscador de familia con debounce
    useEffect(() => {
        if (familiaSel || busqueda.trim().length < 2) {
            setResultados([]);
            return undefined;
        }

        let cancelado = false;

        const temporizador = setTimeout(() => {
            setBuscando(true);
            apiClient.get('/v1/familias', { params: { search: busqueda.trim(), sin_paginar: 1 } })
                .then(({ data }) => { if (!cancelado) setResultados(data.data); })
                .catch(() => { if (!cancelado) setResultados([]); })
                .finally(() => { if (!cancelado) setBuscando(false); });
        }, 400);

        return () => {
            cancelado = true;
            clearTimeout(temporizador);
        };
    }, [busqueda, familiaSel]);

    const seleccionarFamilia = (familia) => {
        setFamiliaSel(familia);
        setBusqueda(familia.nombre_responsable ?? `Familia #${familia.id}`);
        setResultados([]);
        setErrors((prev) => ({ ...prev, familia_id: undefined }));
    };

    const limpiarFormulario = () => {
        setFamiliaSel(null);
        setBusqueda('');
        setCantidad('1');
        setFechaEntrega(hoyLocal());
        setObservaciones('');
        setErrors({});
    };

    const validar = () => {
        const nuevos = {};
        const cant   = Number(cantidad);

        if (!familiaSel) {
            nuevos.familia_id = ['Selecciona una familia de la lista.'];
        }
        if (!Number.isInteger(cant) || cant < 1 || cant > 99) {
            nuevos.cantidad = ['La cantidad debe ser un número entero entre 1 y 99.'];
        }
        if (!fechaEntrega) {
            nuevos.fecha_entrega = ['Indica la fecha de entrega.'];
        } else if (fechaEntrega > hoyLocal()) {
            nuevos.fecha_entrega = ['La fecha de entrega no puede ser futura.'];
        }

        return nuevos;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const locales = validar();
        if (Object.keys(locales).length > 0) {
            setErrors(locales);
            return;
        }

        setIsSaving(true);
        setErrors({});

        try {
            await apiClient.post(`/v1/encuestas/${id}/respuestas`, {
                familia_id:    familiaSel.id,
                cantidad:      Number(cantidad),
                fecha_entrega: fechaEntrega,
                observaciones: observaciones.trim() || null,
            });

            limpiarFormulario();

            if (pagina === 1) {
                await cargarRespuestas(true);
            } else {
                setPagina(1);
            }
        } catch (err) {
            if (err.response?.status === 422) {
                setErrors(err.response.data.errors ?? {});
            } else {
                setError(err.response?.data?.message ?? 'No se pudo registrar la entrega.');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const eliminar = async () => {
        if (!aEliminar) return;
        setIsDeleting(true);
        try {
            await apiClient.delete(`/v1/encuesta-respuestas/${aEliminar.id}`);
            setAEliminar(null);
            await cargarRespuestas(true);
        } catch (err) {
            setAEliminar(null);
            setError(err.response?.data?.message ?? 'No se pudo eliminar el registro.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="list-page">

            <header className="list-topbar">
                <button type="button" className="list-topbar__back" onClick={() => navigate('/encuestas')}>
                    ← Encuestas
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Encuestas</span><span>›</span><span>Entregas</span>
                </div>
            </header>

            <main className="list-container regentrega">

                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">
                            {encuesta ? encuesta.nombre : 'Cargando…'}
                        </h1>
                        {encuesta && (
                            <p className="list-heading__subtitle">
                                {TIPO_LABELS[encuesta.tipo] ?? encuesta.tipo}
                                {' · '}
                                {encuesta.activa ? 'Activa' : 'Cerrada'}
                            </p>
                        )}
                        {!cargandoResp && (
                            <span className="list-heading__count">
                                {meta.total} {meta.total === 1 ? 'entrega' : 'entregas'}
                            </span>
                        )}
                    </div>
                    <Link to={`/mapa-calor?encuesta_id=${id}`} className="list-btn list-btn--primary regentrega-mapa-link">
                        🗺 Ver mapa de calor
                    </Link>
                </div>

                {error && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span>
                        <span>{error}</span>
                    </div>
                )}

                {cerrada && (
                    <div className="regentrega-aviso" role="status">
                        🔒 Esta encuesta está cerrada: no admite nuevas entregas. Puedes reabrirla
                        desde la lista de encuestas.
                    </div>
                )}

                <div className="regentrega-modos" role="group" aria-label="Modo de registro">
                    <button
                        type="button"
                        className={`regentrega-modos__btn ${modo === 'individual' ? 'regentrega-modos__btn--activo' : ''}`}
                        onClick={() => setModo('individual')}
                        aria-pressed={modo === 'individual'}
                    >
                        Una familia
                    </button>
                    <button
                        type="button"
                        className={`regentrega-modos__btn ${modo === 'masivo' ? 'regentrega-modos__btn--activo' : ''}`}
                        onClick={() => setModo('masivo')}
                        aria-pressed={modo === 'masivo'}
                    >
                        Varias familias
                    </button>
                </div>

                {modo === 'masivo' && (
                    <RegistroMasivo
                        encuestaId={id}
                        cerrada={cerrada}
                        onSuccess={refrescarHistorial}
                    />
                )}

                {modo === 'individual' && (
                    <form onSubmit={handleSubmit} className="regentrega-form" noValidate>
                        <fieldset disabled={cerrada || isSaving} className="regentrega-form__fieldset">
                            <legend className="regentrega-form__titulo">Registrar nueva entrega</legend>

                            <div className="regentrega-field regentrega-field--buscador">
                                <label htmlFor="regentrega-busqueda">Familia</label>
                                <input
                                    id="regentrega-busqueda"
                                    type="text"
                                    value={busqueda}
                                    onChange={(e) => {
                                        setBusqueda(e.target.value);
                                        setFamiliaSel(null);
                                    }}
                                    placeholder="Escribe el nombre del responsable o el código de vivienda…"
                                    autoComplete="off"
                                />
                                {buscando && <span className="regentrega-ayuda">Buscando…</span>}

                                {resultados.length > 0 && (
                                    <ul className="regentrega-dropdown">
                                        {resultados.map((f) => (
                                            <li key={f.id}>
                                                <button type="button" onClick={() => seleccionarFamilia(f)}>
                                                    {f.nombre_responsable ?? `Familia #${f.id}`}
                                                    {f.codigo_vivienda && <span> — {f.codigo_vivienda}</span>}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {!buscando && !familiaSel && busqueda.trim().length >= 2 && resultados.length === 0 && (
                                    <span className="regentrega-ayuda">Sin coincidencias.</span>
                                )}

                                {familiaSel && (
                                    <span className="regentrega-ok">
                                        ✓ Familia seleccionada: {familiaSel.nombre_responsable ?? `#${familiaSel.id}`}
                                    </span>
                                )}

                                {errors.familia_id && (
                                    <span className="regentrega-error">{errors.familia_id[0]}</span>
                                )}
                            </div>

                            <div className="regentrega-row">
                                <div className="regentrega-field">
                                    <label htmlFor="regentrega-cantidad">Cantidad</label>
                                    <input
                                        id="regentrega-cantidad"
                                        type="number"
                                        min={1}
                                        max={99}
                                        value={cantidad}
                                        onChange={(e) => setCantidad(e.target.value)}
                                    />
                                    {errors.cantidad && <span className="regentrega-error">{errors.cantidad[0]}</span>}
                                </div>

                                <div className="regentrega-field">
                                    <label htmlFor="regentrega-fecha">Fecha de entrega</label>
                                    <input
                                        id="regentrega-fecha"
                                        type="date"
                                        value={fechaEntrega}
                                        max={hoyLocal()}
                                        onChange={(e) => setFechaEntrega(e.target.value)}
                                    />
                                    {errors.fecha_entrega && <span className="regentrega-error">{errors.fecha_entrega[0]}</span>}
                                </div>
                            </div>

                            <div className="regentrega-field">
                                <label htmlFor="regentrega-obs">Observaciones (opcional)</label>
                                <textarea
                                    id="regentrega-obs"
                                    rows={2}
                                    maxLength={500}
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value)}
                                />
                                {errors.observaciones && <span className="regentrega-error">{errors.observaciones[0]}</span>}
                            </div>

                            {errors.encuesta && <span className="regentrega-error">{errors.encuesta[0]}</span>}

                            <button type="submit" className="list-btn list-btn--primary regentrega-submit">
                                {isSaving ? 'Guardando…' : 'Registrar entrega'}
                            </button>
                        </fieldset>
                    </form>
                )}

                <section className="regentrega-historial" aria-label="Entregas registradas">
                    <h2 className="regentrega-historial__titulo">Entregas registradas</h2>

                    {cargandoResp ? (
                        <div className="list-loading">
                            <div className="list-loading__spinner" />
                            <p>Cargando entregas…</p>
                        </div>
                    ) : respuestas.length === 0 ? (
                        <div className="list-empty">
                            <span aria-hidden="true">📦</span>
                            <p>Todavía no hay entregas registradas para esta encuesta.</p>
                        </div>
                    ) : (
                        <div className="list-table-wrap">
                            <table className="list-table">
                                <thead>
                                    <tr>
                                        <th>Familia</th>
                                        <th>Calle</th>
                                        <th className="td-center">Cantidad</th>
                                        <th>Fecha</th>
                                        <th className="th-actions">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {respuestas.map((r) => (
                                        <tr key={r.id}>
                                            <td>{r.familia_nombre ?? `Familia #${r.familia_id}`}</td>
                                            <td className="td-meta">{r.calle_nombre ?? '—'}</td>
                                            <td className="td-center">{r.cantidad}</td>
                                            <td className="td-meta">{formatearFecha(r.fecha_entrega)}</td>
                                            <td>
                                                <div className="td-actions">
                                                    <button
                                                        type="button"
                                                        className="action-btn action-btn--delete"
                                                        onClick={() => setAEliminar(r)}
                                                        aria-label="Eliminar esta entrega"
                                                    >
                                                        🗑
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!cargandoResp && meta.last_page > 1 && (
                        <nav className="list-pagination" aria-label="Paginación de entregas">
                            <button
                                type="button"
                                className="page-btn"
                                disabled={meta.current_page <= 1}
                                onClick={() => setPagina(meta.current_page - 1)}
                            >
                                ← Anterior
                            </button>
                            <span className="page-info">
                                Página {meta.current_page} de {meta.last_page}
                            </span>
                            <button
                                type="button"
                                className="page-btn"
                                disabled={meta.current_page >= meta.last_page}
                                onClick={() => setPagina(meta.current_page + 1)}
                            >
                                Siguiente →
                            </button>
                        </nav>
                    )}
                </section>
            </main>

            <ConfirmModal
                isOpen={!!aEliminar}
                title="Eliminar entrega"
                message={`¿Eliminar la entrega de ${aEliminar?.familia_nombre ?? 'esta familia'}?`}
                detail="Se conserva en el historial interno, pero deja de contar para el mapa de calor."
                confirmLabel="Sí, eliminar"
                variant="danger"
                onConfirm={eliminar}
                onCancel={() => setAEliminar(null)}
                isLoading={isDeleting}
            />
        </div>
    );
}

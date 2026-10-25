/**
 * resources/js/pages/mapa-calor/MapaCalorPage.jsx
 *
 * Mapa de calor territorial: estado de una encuesta (gas, CLAP…) por calle.
 * Accesible para admin y vocero (ver routes/api.php y app.jsx).
 *
 * ALCANCE POR ROL (lo impone el backend; aquí solo se refleja):
 *  · admin  → todas las calles y, al abrir una calle, el detalle por familia.
 *  · vocero → solo las calles de las sedes donde tiene un mandato activo y
 *             únicamente TOTALES por calle: nunca nombres de familias
 *             (instrucción del profesor: el vocero no accede al censo).
 *
 * CORRECCIONES respecto a la versión original (oct-2026):
 *  · Una calle sin datos suficientes se muestra en GRIS ("sin datos"), no
 *    en verde: verde significa "al día".
 *  · Cada color lleva además una etiqueta de texto (no depende solo del color).
 *  · Sin estilos en línea: las tarjetas y la leyenda se estilizan por clases.
 *  · Las peticiones atrasadas se descartan (cambiar rápido de encuesta o de
 *    calle no deja pintado un resultado viejo).
 *  · Ya no depende del rol 'operador', que se eliminará.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../services/axios';
import { useAuth } from '../../hooks/useAuth';
import { REDIRECT_BY_ROL } from '../../constants/roles';
import MapaLeaflet from './MapaLeaflet';
import '../familias/FamiliaList.css';
import './MapaCalorPage.css';

// ── Colores del mapa (los usa Leaflet, que no lee clases CSS) ──
const COLORES = {
    0:         '#639922',
    1:         '#EF9F27',
    2:         '#E24B4A',
    sin_datos: '#9AA3AF',
};

// riesgo: 0 = bien · 1 = atención · 2 = crítico · null = sin datos
const claveRiesgo = (riesgo) => (riesgo === null || riesgo === undefined ? 'sin_datos' : String(riesgo));
const colorDe     = (riesgo) => COLORES[claveRiesgo(riesgo)];

const ETIQUETAS = {
    prediccion_agotamiento: {
        0:         'Al día',
        1:         'Próximo a agotarse',
        2:         'Vencido',
        sin_datos: 'Sin datos suficientes',
    },
    cobertura: {
        0:         'Cobertura completa',
        1:         'Cobertura parcial',
        2:         'Sin cobertura',
        sin_datos: 'Sin familias',
    },
};

const ESTADO_FAMILIA = {
    al_dia:    'Al día',
    proximo:   'Próximo a agotarse',
    vencido:   'Vencido',
    sin_datos: 'Sin datos',
};

const formatearFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');

const textoDias = (dias) => {
    if (dias === null || dias === undefined) return '';
    if (dias === 0) return ' (hoy)';
    if (dias > 0) return ` (en ${dias} ${dias === 1 ? 'día' : 'días'})`;
    return ` (hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'})`;
};

const plural = (n, singular, pluralTxt) => `${n} ${n === 1 ? singular : pluralTxt}`;

export default function MapaCalorPage() {
    const { user }                           = useAuth();
    const navigate                           = useNavigate();
    const [searchParams, setSearchParams]    = useSearchParams();

    const [encuestas,         setEncuestas]         = useState([]);
    const [cargandoEncuestas, setCargandoEncuestas] = useState(true);
    const [encuestaId,        setEncuestaId]        = useState(searchParams.get('encuesta_id') ?? '');

    const [calles,    setCalles]    = useState([]);
    const [sedes,     setSedes]     = useState([]);
    const [modo,      setModo]      = useState(null);
    const [vista,     setVista]     = useState('mapa'); // 'mapa' | 'tarjetas'
    const [isLoading, setIsLoading] = useState(false);
    const [error,     setError]     = useState(null);

    const [calleSel,          setCalleSel]          = useState(null);
    const [detalle,           setDetalle]           = useState(null);
    const [isLoadingDetalle,  setIsLoadingDetalle]  = useState(false);
    const [errorDetalle,      setErrorDetalle]      = useState(null);
    const detalleReq                                = useRef(0);

    const puedeAsignar = Boolean(user?.permisos?.puede_gestionar_encuestas ?? user?.rol === 'admin');
    const etiquetas    = ETIQUETAS[modo] ?? ETIQUETAS.cobertura;
    const etiquetaDe   = (riesgo) => etiquetas[claveRiesgo(riesgo)];

    // ── Lista de encuestas para el selector ───────────────────
    useEffect(() => {
        let cancelado = false;

        apiClient.get('/v1/encuestas', { params: { per_page: 50 } })
            .then(({ data }) => {
                if (cancelado) return;
                setEncuestas(data.data);
                // Sin encuesta elegida: la más reciente que esté activa (o la más reciente)
                setEncuestaId((actual) => {
                    if (actual) return actual;
                    const elegida = data.data.find((e) => e.activa) ?? data.data[0];
                    return elegida ? String(elegida.id) : '';
                });
            })
            .catch((err) => {
                if (!cancelado) setError(err.response?.data?.message ?? 'No se pudieron cargar las encuestas.');
            })
            .finally(() => {
                if (!cancelado) setCargandoEncuestas(false);
            });

        return () => { cancelado = true; };
    }, []);

    // ── Datos del mapa al cambiar de encuesta ─────────────────
    useEffect(() => {
        if (!encuestaId) return undefined;

        let cancelado = false;
        setIsLoading(true);
        setError(null);
        setCalleSel(null);
        setDetalle(null);
        setErrorDetalle(null);

        apiClient.get('/v1/mapa-calor', { params: { encuesta_id: encuestaId } })
            .then(({ data }) => {
                if (cancelado) return;
                setCalles(data.data);
                setSedes(data.sedes ?? []);
                setModo(data.modo);
            })
            .catch((err) => {
                if (cancelado) return;
                setCalles([]);
                setSedes([]);
                setError(err.response?.data?.message ?? 'No se pudo cargar el mapa de calor.');
            })
            .finally(() => {
                if (!cancelado) setIsLoading(false);
            });

        return () => { cancelado = true; };
    }, [encuestaId]);

    const cambiarEncuesta = (valor) => {
        setEncuestaId(valor);
        setSearchParams(valor ? { encuesta_id: valor } : {}, { replace: true });
    };

    // ── Detalle de una calle ──────────────────────────────────
    const verDetalle = async (calle) => {
        const numero = ++detalleReq.current;
        setCalleSel(calle);
        setDetalle(null);
        setErrorDetalle(null);
        setIsLoadingDetalle(true);

        try {
            const { data } = await apiClient.get(`/v1/mapa-calor/calle/${calle.calle_id}`, {
                params: { encuesta_id: encuestaId },
            });
            if (numero === detalleReq.current) setDetalle(data.data);
        } catch (err) {
            if (numero === detalleReq.current) {
                setErrorDetalle(err.response?.data?.message ?? 'No se pudo cargar el detalle de esta calle.');
            }
        } finally {
            if (numero === detalleReq.current) setIsLoadingDetalle(false);
        }
    };

    const cerrarDetalle = () => {
        detalleReq.current += 1;
        setCalleSel(null);
        setDetalle(null);
        setErrorDetalle(null);
        setIsLoadingDetalle(false);
    };

    // ── Totales de calles por estado (chips de resumen) ───────
    const totales = useMemo(() => {
        const acc = { 0: 0, 1: 0, 2: 0, sin_datos: 0 };
        calles.forEach((c) => { acc[claveRiesgo(c.riesgo)] += 1; });
        return acc;
    }, [calles]);

    const hayEncuestas = encuestas.length > 0;
    const encuestaActual = encuestas.find((e) => String(e.id) === String(encuestaId));

    return (
        <div className="list-page">

            <header className="list-topbar">
                <button
                    type="button"
                    className="list-topbar__back"
                    onClick={() => navigate(REDIRECT_BY_ROL[user?.rol] ?? '/dashboard')}
                >
                    ← Volver
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Mapa de calor</span>
                </div>
            </header>

            <main className="list-container">

                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Mapa de calor territorial</h1>
                        <p className="list-heading__subtitle">
                            {user?.rol === 'vocero'
                                ? 'Estado de la encuesta en las calles de tu sector.'
                                : 'Estado de la encuesta elegida en cada calle del territorio.'}
                        </p>
                        {!isLoading && calles.length > 0 && (
                            <span className="list-heading__count">{plural(calles.length, 'calle', 'calles')}</span>
                        )}
                    </div>
                </div>

                {/* ── Controles ─────────────────────────────── */}
                <div className="mapa-controles">
                    <div className="mapa-controles__campo">
                        <label htmlFor="mapa-encuesta">Encuesta</label>
                        <select
                            id="mapa-encuesta"
                            className="mapa-select"
                            value={encuestaId}
                            onChange={(e) => cambiarEncuesta(e.target.value)}
                            disabled={!hayEncuestas}
                        >
                            {!hayEncuestas && <option value="">Sin encuestas</option>}
                            {hayEncuestas && !encuestaActual && encuestaId && (
                                <option value={encuestaId}>Encuesta #{encuestaId}</option>
                            )}
                            {encuestas.map((enc) => (
                                <option key={enc.id} value={enc.id}>
                                    {enc.nombre}{enc.activa ? '' : ' (cerrada)'}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mapa-toggle" role="group" aria-label="Tipo de vista">
                        <button
                            type="button"
                            className={`mapa-toggle__btn ${vista === 'mapa' ? 'mapa-toggle__btn--activo' : ''}`}
                            onClick={() => setVista('mapa')}
                            aria-pressed={vista === 'mapa'}
                        >
                            🗺 Mapa
                        </button>
                        <button
                            type="button"
                            className={`mapa-toggle__btn ${vista === 'tarjetas' ? 'mapa-toggle__btn--activo' : ''}`}
                            onClick={() => setVista('tarjetas')}
                            aria-pressed={vista === 'tarjetas'}
                        >
                            ▦ Tarjetas
                        </button>
                    </div>

                    {puedeAsignar && (
                        <Link to="/mapa-calor/coordenadas" className="mapa-btn-coordenadas">
                            📍 Asignar coordenadas
                        </Link>
                    )}
                </div>

                {error && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span>
                        <span>{error}</span>
                    </div>
                )}

                {cargandoEncuestas && (
                    <div className="list-loading">
                        <div className="list-loading__spinner" />
                        <p>Cargando encuestas…</p>
                    </div>
                )}

                {!cargandoEncuestas && !hayEncuestas && !error && (
                    <div className="list-empty">
                        <span aria-hidden="true">📝</span>
                        <p>Todavía no hay encuestas registradas.</p>
                        {puedeAsignar && (
                            <Link to="/encuestas" className="list-btn list-btn--primary mapa-link-btn">
                                Ir a Encuestas
                            </Link>
                        )}
                    </div>
                )}

                {isLoading && (
                    <div className="list-loading">
                        <div className="list-loading__spinner" />
                        <p>Calculando el mapa…</p>
                    </div>
                )}

                {!isLoading && !error && encuestaId && calles.length === 0 && hayEncuestas && (
                    <div className="list-empty">
                        <span aria-hidden="true">🏘️</span>
                        <p>No hay calles para mostrar.</p>
                    </div>
                )}

                {/* ── Resumen de calles por estado ──────────── */}
                {!isLoading && calles.length > 0 && (
                    <div className="mapa-resumen" aria-label="Resumen de calles por estado">
                        {[0, 1, 2, 'sin_datos'].map((clave) => (
                            <span key={clave} className={`mapa-chip mapa-chip--${clave}`}>
                                <i className={`mapa-swatch mapa-swatch--${clave}`} aria-hidden="true" />
                                <strong>{totales[clave]}</strong> {etiquetas[clave]}
                            </span>
                        ))}
                    </div>
                )}

                {/* ── Vista de mapa ─────────────────────────── */}
                {!isLoading && calles.length > 0 && vista === 'mapa' && (
                    <MapaLeaflet
                        calles={calles}
                        sedes={sedes}
                        colorDe={colorDe}
                        etiquetaDe={etiquetaDe}
                        onCalleClick={verDetalle}
                        puedeAsignar={puedeAsignar}
                    />
                )}

                {/* ── Vista de tarjetas ─────────────────────── */}
                {!isLoading && calles.length > 0 && vista === 'tarjetas' && (
                    <div className="mapa-grid">
                        {calles.map((c) => {
                            const clave = claveRiesgo(c.riesgo);
                            const detalleTexto = modo === 'prediccion_agotamiento'
                                ? `${plural(c.conteo?.vencido ?? 0, 'vencida', 'vencidas')} · ${c.conteo?.proximo ?? 0} por vencer`
                                : `${c.familias_con_respuesta ?? 0} de ${c.total_familias} con entrega`;

                            return (
                                <button
                                    key={c.calle_id}
                                    type="button"
                                    className={`mapa-card mapa-card--${clave} ${calleSel?.calle_id === c.calle_id ? 'mapa-card--seleccionada' : ''}`}
                                    onClick={() => verDetalle(c)}
                                >
                                    <span className="mapa-card__estado">{etiquetaDe(c.riesgo)}</span>
                                    <span className="mapa-card__calle">{c.calle}</span>
                                    <span className="mapa-card__sede">{c.sede}</span>
                                    <span className="mapa-card__familias">
                                        {plural(c.total_familias, 'familia', 'familias')}
                                        {c.total_familias > 0 && <> · {detalleTexto}</>}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ── Leyenda ───────────────────────────────── */}
                {!isLoading && calles.length > 0 && (
                    <div className="mapa-leyenda" aria-label="Leyenda">
                        {[0, 1, 2, 'sin_datos'].map((clave) => (
                            <span key={clave} className="mapa-leyenda__item">
                                <i className={`mapa-swatch mapa-swatch--${clave}`} aria-hidden="true" />
                                {etiquetas[clave]}
                            </span>
                        ))}
                    </div>
                )}

                {/* ── Detalle de la calle elegida ───────────── */}
                {(isLoadingDetalle || detalle || errorDetalle) && (
                    <section className="mapa-detalle" aria-live="polite">
                        <div className="mapa-detalle__cabecera">
                            <div>
                                <h2 className="mapa-detalle__titulo">{detalle?.calle ?? calleSel?.calle}</h2>
                                <p className="mapa-detalle__sede">{detalle?.sede ?? calleSel?.sede}</p>
                            </div>
                            <button type="button" className="mapa-detalle__cerrar" onClick={cerrarDetalle}>
                                ✕ Cerrar
                            </button>
                        </div>

                        {isLoadingDetalle && (
                            <div className="list-loading">
                                <div className="list-loading__spinner list-loading__spinner--sm" />
                                <p>Cargando detalle…</p>
                            </div>
                        )}

                        {errorDetalle && (
                            <div className="list-alert list-alert--error" role="alert">
                                <span>⚠</span>
                                <span>{errorDetalle}</span>
                            </div>
                        )}

                        {detalle && (
                            <>
                                <p className="mapa-detalle__total">
                                    {plural(detalle.total_familias, 'familia registrada', 'familias registradas')}
                                </p>

                                {modo === 'prediccion_agotamiento' ? (
                                    <div className="mapa-resumen">
                                        <span className="mapa-chip mapa-chip--0">
                                            <strong>{detalle.resumen.al_dia}</strong> al día
                                        </span>
                                        <span className="mapa-chip mapa-chip--1">
                                            <strong>{detalle.resumen.proximo}</strong> por vencer
                                        </span>
                                        <span className="mapa-chip mapa-chip--2">
                                            <strong>{detalle.resumen.vencido}</strong> vencidas
                                        </span>
                                        <span className="mapa-chip mapa-chip--sin_datos">
                                            <strong>{detalle.resumen.sin_datos}</strong> sin datos
                                        </span>
                                    </div>
                                ) : (
                                    <div className="mapa-resumen">
                                        <span className="mapa-chip mapa-chip--0">
                                            <strong>{detalle.resumen.con_respuesta}</strong> con entrega
                                        </span>
                                        <span className="mapa-chip mapa-chip--2">
                                            <strong>{detalle.resumen.pendientes}</strong> pendientes
                                        </span>
                                    </div>
                                )}

                                {Array.isArray(detalle.familias) ? (
                                    detalle.familias.length === 0 ? (
                                        <p className="mapa-detalle__nota">Esta calle no tiene familias registradas.</p>
                                    ) : (
                                        <div className="list-table-wrap">
                                            <table className="list-table">
                                                <thead>
                                                    <tr>
                                                        <th>Vivienda</th>
                                                        <th>Responsable</th>
                                                        {modo === 'prediccion_agotamiento' ? (
                                                            <>
                                                                <th>Última entrega</th>
                                                                <th>Agotamiento estimado</th>
                                                                <th>Estado</th>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <th>Recibió</th>
                                                                <th>Última entrega</th>
                                                            </>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {detalle.familias.map((f, i) => (
                                                        <tr key={f.familia_id ?? i}>
                                                            <td className="td-code">{f.codigo_vivienda ?? '—'}</td>
                                                            <td>{f.responsable ?? `Familia #${f.familia_id}`}</td>
                                                            {modo === 'prediccion_agotamiento' ? (
                                                                <>
                                                                    <td className="td-meta">{formatearFecha(f.ultima_entrega)}</td>
                                                                    <td className="td-meta">
                                                                        {formatearFecha(f.fecha_estimada_agotamiento)}
                                                                        {textoDias(f.dias_restantes)}
                                                                    </td>
                                                                    <td>
                                                                        <span className={`mapa-estado mapa-estado--${f.estado}`}>
                                                                            {ESTADO_FAMILIA[f.estado] ?? f.estado}
                                                                        </span>
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td>{f.recibio ? 'Sí' : 'No'}</td>
                                                                    <td className="td-meta">{formatearFecha(f.ultima_entrega)}</td>
                                                                </>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                                ) : (
                                    <p className="mapa-detalle__nota">
                                        🔒 Por privacidad, tu perfil solo ve los totales de la calle, sin
                                        el detalle de cada familia.
                                    </p>
                                )}
                            </>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
}

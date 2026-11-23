/**
 * resources/js/pages/mapa-calor/MapaCalorPage.jsx
 *
 * Mapa de calor territorial: estado de una encuesta (gas, CLAP, agua, vivienda…) por calle.
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
 *
 * MAPAS POR ENCUESTA (nov-2026):
 *  · Una pestaña por encuesta en lugar del <select>: al pulsarla se cambia de mapa.
 *  · Cada modo de cálculo del backend (campo `modo`) define en MODOS sus etiquetas,
 *    chips de detalle, texto de tarjeta y columnas de la tabla: agotamiento (gas),
 *    cobertura (CLAP, combo, otros), estado del agua y condición de vivienda
 *    (esta última sale del censo). Todos pintan con el mismo riesgo 0/1/2/null.
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

const formatearFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');

const textoDias = (dias) => {
    if (dias === null || dias === undefined) return '';
    if (dias === 0) return ' (hoy)';
    if (dias > 0) return ` (en ${dias} ${dias === 1 ? 'día' : 'días'})`;
    return ` (hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'})`;
};

const plural = (n, singular, pluralTxt) => `${n} ${n === 1 ? singular : pluralTxt}`;

// Texto de cada estado de una familia en la tabla de detalle
const ESTADO_FAMILIA = {
    al_dia:       'Al día',
    proximo:      'Próximo a agotarse',
    vencido:      'Vencido',
    sin_datos:    'Sin datos',
    llega:        'Llega agua',
    intermitente: 'Intermitente',
    no_llega:     'No llega agua',
    optima:       'Óptima',
    regular:      'Regular',
    critica:      'Crítica',
    pagado:       'Pagado',
    en_revision:  'En revisión',
    sin_pago:     'Sin pago',
};

function BadgeEstado({ valor }) {
    return (
        <span className={`mapa-estado mapa-estado--${valor}`}>
            {ESTADO_FAMILIA[valor] ?? valor}
        </span>
    );
}

// Icono de cada tipo de encuesta en su pestaña
const ICONO_TIPO = {
    bombona_gas:        '🔥',
    bolsa_clap:         '🧺',
    combo_alimenticio:  '🛒',
    agua:               '💧',
    condicion_vivienda: '🏠',
    pago_servicio:      '💳',
    otro:               '📋',
};

/**
 * Configuración por modo de cálculo (campo `modo` que devuelve el backend):
 *  · etiquetas  → texto de cada color en leyenda, chips y popups
 *  · textoCalle → línea de resumen de cada tarjeta de calle
 *  · chips      → totales de familias en el detalle de una calle
 *  · columnas   → columnas de la tabla de familias (solo la ve el admin)
 */
const MODOS = {
    prediccion_agotamiento: {
        etiquetas: {
            0:         'Al día',
            1:         'Próximo a agotarse',
            2:         'Vencido',
            sin_datos: 'Sin datos suficientes',
        },
        textoCalle: (c) => `${plural(c.conteo?.vencido ?? 0, 'vencida', 'vencidas')} · ${c.conteo?.proximo ?? 0} por vencer`,
        chips: (r) => [
            { clave: 0,           valor: r.al_dia,    texto: 'al día' },
            { clave: 1,           valor: r.proximo,   texto: 'por vencer' },
            { clave: 2,           valor: r.vencido,   texto: 'vencidas' },
            { clave: 'sin_datos', valor: r.sin_datos, texto: 'sin datos' },
        ],
        columnas: [
            { titulo: 'Última entrega', meta: true, celda: (f) => formatearFecha(f.ultima_entrega) },
            {
                titulo: 'Agotamiento estimado',
                meta:   true,
                celda:  (f) => (
                    <>
                        {formatearFecha(f.fecha_estimada_agotamiento)}
                        {textoDias(f.dias_restantes)}
                    </>
                ),
            },
            { titulo: 'Estado', celda: (f) => <BadgeEstado valor={f.estado} /> },
        ],
    },

    cobertura: {
        etiquetas: {
            0:         'Cobertura completa',
            1:         'Cobertura parcial',
            2:         'Sin cobertura',
            sin_datos: 'Sin familias',
        },
        textoCalle: (c) => `${c.familias_con_respuesta ?? 0} de ${c.total_familias} con entrega`,
        chips: (r) => [
            { clave: 0, valor: r.con_respuesta, texto: 'con entrega' },
            { clave: 2, valor: r.pendientes,    texto: 'pendientes' },
        ],
        columnas: [
            { titulo: 'Recibió',        celda: (f) => (f.recibio ? 'Sí' : 'No') },
            { titulo: 'Última entrega', meta: true, celda: (f) => formatearFecha(f.ultima_entrega) },
        ],
    },

    estado_agua: {
        etiquetas: {
            0:         'Agua continua',
            1:         'Agua intermitente',
            2:         'Sin agua',
            sin_datos: 'Sin registros',
        },
        textoCalle: (c) => `${c.conteo?.no_llega ?? 0} sin agua · ${c.conteo?.intermitente ?? 0} intermitente`,
        chips: (r) => [
            { clave: 0,           valor: r.llega,        texto: 'con agua continua' },
            { clave: 1,           valor: r.intermitente, texto: 'intermitente' },
            { clave: 2,           valor: r.no_llega,     texto: 'sin agua' },
            { clave: 'sin_datos', valor: r.sin_datos,    texto: 'sin registro' },
        ],
        columnas: [
            { titulo: 'Estado del agua',  celda: (f) => <BadgeEstado valor={f.estado} /> },
            { titulo: 'Último registro', meta: true, celda: (f) => formatearFecha(f.ultima_entrega) },
        ],
    },

    condicion_vivienda: {
        etiquetas: {
            0:         'Viviendas en buen estado',
            1:         'Con viviendas en riesgo',
            2:         'Zona crítica',
            sin_datos: 'Sin familias',
        },
        textoCalle: (c) => `${c.conteo?.critica ?? 0} críticas · ${c.conteo?.regular ?? 0} regulares`,
        chips: (r) => [
            { clave: 0, valor: r.optima,  texto: 'óptimas' },
            { clave: 1, valor: r.regular, texto: 'regulares' },
            { clave: 2, valor: r.critica, texto: 'críticas' },
        ],
        columnas: [
            { titulo: 'Condición', celda: (f) => <BadgeEstado valor={f.condicion} /> },
        ],
    },

    pago_servicio: {
        etiquetas: {
            0:         'Todas las familias al día',
            1:         'Con familias sin pagar',
            2:         'Mayoría sin pagar',
            sin_datos: 'Sin familias',
        },
        textoCalle: (c) => `${c.conteo?.sin_pago ?? 0} sin pagar · ${c.conteo?.en_revision ?? 0} en revisión`,
        chips: (r) => [
            { clave: 0, valor: r.pagado,      texto: 'pagaron' },
            { clave: 1, valor: r.en_revision, texto: 'en revisión' },
            { clave: 2, valor: r.sin_pago,    texto: 'sin pagar' },
        ],
        columnas: [
            { titulo: 'Estado del pago', celda: (f) => <BadgeEstado valor={f.estado} /> },
            { titulo: 'Último pago', meta: true, celda: (f) => formatearFecha(f.ultimo_pago) },
        ],
    },
};

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
    const [pagosSinFamilia, setPagosSinFamilia] = useState(null);
    const [vista,     setVista]     = useState('mapa'); // 'mapa' | 'tarjetas'
    const [isLoading, setIsLoading] = useState(false);
    const [error,     setError]     = useState(null);

    const [calleSel,          setCalleSel]          = useState(null);
    const [detalle,           setDetalle]           = useState(null);
    const [isLoadingDetalle,  setIsLoadingDetalle]  = useState(false);
    const [errorDetalle,      setErrorDetalle]      = useState(null);
    const detalleReq                                = useRef(0);
    const detalleRef                                = useRef(null);

    const puedeAsignar = Boolean(user?.permisos?.puede_gestionar_encuestas ?? user?.rol === 'admin');
    const cfg          = MODOS[modo] ?? MODOS.cobertura;
    const etiquetas    = cfg.etiquetas;
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
                setPagosSinFamilia(data.pagos_sin_familia ?? null);
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

    // Al elegir una calle, lleva la vista hasta su detalle: queda debajo del mapa
    // y de la leyenda y, si no, parece que el clic no hizo nada.
    useEffect(() => {
        if (isLoadingDetalle) {
            detalleRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        }
    }, [isLoadingDetalle]);

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

                {/* ── Selector de encuestas: una pestaña por mapa ── */}
                {hayEncuestas && (
                    <div className="mapa-tabs" role="group" aria-label="Encuesta que se muestra en el mapa">
                        {encuestas.map((enc) => {
                            const activa = String(enc.id) === String(encuestaId);

                            return (
                                <button
                                    key={enc.id}
                                    type="button"
                                    className={`mapa-tab ${activa ? 'mapa-tab--activo' : ''} ${enc.activa ? '' : 'mapa-tab--cerrada'}`}
                                    onClick={() => cambiarEncuesta(String(enc.id))}
                                    aria-pressed={activa}
                                >
                                    <span className="mapa-tab__icono" aria-hidden="true">{ICONO_TIPO[enc.tipo] ?? '📋'}</span>
                                    {enc.nombre}
                                    {!enc.activa && <span className="mapa-tab__cerrada">cerrada</span>}
                                </button>
                            );
                        })}
                    </div>
                )}

                {encuestaActual?.modo === 'pago_servicio' && (
                    <p className="mapa-descripcion">
                        Servicio: <strong>{encuestaActual.cuenta_pago_nombre ?? '—'}</strong> · Período: del{' '}
                        {formatearFecha(encuestaActual.fecha_inicio)} al {formatearFecha(encuestaActual.fecha_cierre)}
                    </p>
                )}

                {encuestaActual?.descripcion && (
                    <p className="mapa-descripcion">{encuestaActual.descripcion}</p>
                )}

                {/* ── Controles ─────────────────────────────── */}
                <div className="mapa-controles">
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

                {/* ── Aviso de pagos sin familia (solo administrador) ── */}
                {!isLoading && modo === 'pago_servicio' && pagosSinFamilia > 0 && (
                    <p className="mapa-nota" role="status">
                        ⚠ {plural(pagosSinFamilia, 'pago del período no se pudo', 'pagos del período no se pudieron')}{' '}
                        asignar a una familia (el usuario que pagó no está vinculado a un habitante) y no se cuentan en el mapa.
                    </p>
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
                            const detalleTexto = cfg.textoCalle(c);

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
                    <section className="mapa-detalle" aria-live="polite" ref={detalleRef}>
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

                                <div className="mapa-resumen">
                                    {cfg.chips(detalle.resumen).map((chip) => (
                                        <span key={chip.clave} className={`mapa-chip mapa-chip--${chip.clave}`}>
                                            <strong>{chip.valor}</strong> {chip.texto}
                                        </span>
                                    ))}
                                </div>

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
                                                        {cfg.columnas.map((col) => (
                                                            <th key={col.titulo}>{col.titulo}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {detalle.familias.map((f, i) => (
                                                        <tr key={f.familia_id ?? i}>
                                                            <td className="td-code">{f.codigo_vivienda ?? '—'}</td>
                                                            <td>{f.responsable ?? `Familia #${f.familia_id}`}</td>
                                                            {cfg.columnas.map((col) => (
                                                                <td key={col.titulo} className={col.meta ? 'td-meta' : undefined}>
                                                                    {col.celda(f)}
                                                                </td>
                                                            ))}
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

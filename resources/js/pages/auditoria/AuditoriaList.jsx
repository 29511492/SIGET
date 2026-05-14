/**
 * Importar en app.jsx:
 *   import AuditoriaList from './pages/auditoria/AuditoriaList';
 *   <Route path="/auditoria" element={<AuditoriaList />} />
 *
 * Solo accesible para rol 'admin' — la protección existe en dos capas:
 *   1. Middleware role:admin en api.php (backend)
 *   2. isAdmin en el sidebar de DashboardPage.jsx (frontend, UX)
 *
 * Campos del AuditoriaResource:
 *   id, operador, operador_email, accion, tabla_afectada, registro_id,
 *   direccion_ip, user_agent, valor_anterior, valor_nuevo,
 *   fecha_legible, fecha_iso
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate }  from 'react-router-dom';
import { useAuth }      from '../../hooks/useAuth';
import apiClient        from '../../services/axios';
import './AuditoriaList.css';

// ── Mapeo de acciones a badge ──────────────────────────────────
const ACCION_BADGE = {
    creado:         { label: 'Creado',       cls: 'badge--green'  },
    actualizado:    { label: 'Actualizado',  cls: 'badge--blue'   },
    soft_eliminado: { label: 'Eliminado',    cls: 'badge--red'    },
    eliminado:      { label: 'Eliminado',    cls: 'badge--red'    },
};

// ── Filtros disponibles por tabla ──────────────────────────────
const TABLA_OPTIONS = [
    { value: '',            label: 'Todas las tablas' },
    { value: 'familias',   label: 'Familias'   },
    { value: 'habitantes', label: 'Habitantes' },
    { value: 'voceros',    label: 'Voceros'    },
    { value: 'proyectos',  label: 'Proyectos'  },
    { value: 'beneficios', label: 'Beneficios' },
];

const ACCION_OPTIONS = [
    { value: '',              label: 'Todas las acciones' },
    { value: 'creado',        label: 'Creado'       },
    { value: 'actualizado',   label: 'Actualizado'  },
    { value: 'soft_eliminado',label: 'Eliminado'    },
];

export default function AuditoriaList() {
    const navigate        = useNavigate();
    const { isAdmin }     = useAuth();

    // ── Estado de listado ──────────────────────────────────────
    const [registros,   setRegistros]   = useState([]);
    const [pagination,  setPagination]  = useState(null);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState(null);
    const [page,        setPage]        = useState(1);

    // ── Filtros ────────────────────────────────────────────────
    const [filtroTabla,  setFiltroTabla]  = useState('');
    const [filtroAccion, setFiltroAccion] = useState('');
    const [filtroDesde,  setFiltroDesde]  = useState('');
    const [filtroHasta,  setFiltroHasta]  = useState('');

    // ── Modal de detalle ───────────────────────────────────────
    const [modalRegistro, setModalRegistro] = useState(null);

    // ── Carga de datos ─────────────────────────────────────────
    const fetchAuditorias = useCallback(async (p = page) => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                page,
                per_page: 15,
                ...(filtroTabla  && { tabla:  filtroTabla  }),
                ...(filtroAccion && { accion: filtroAccion }),
                ...(filtroDesde  && { desde:  filtroDesde  }),
                ...(filtroHasta  && { hasta:  filtroHasta  }),
            };
            const res = await apiClient.get('/v1/auditorias', { params });
            setRegistros(res.data.data);
            setPagination(res.data.meta);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al cargar el historial de auditoría.');
        } finally {
            setLoading(false);
        }
    }, [page, filtroTabla, filtroAccion, filtroDesde, filtroHasta]);

    useEffect(() => { fetchAuditorias(); }, [page]);

    // Aplicar filtros reinicia a página 1
    const aplicarFiltros = () => {
        setPage(1);
        fetchAuditorias(1);
    };

    const limpiarFiltros = () => {
        setFiltroTabla('');
        setFiltroAccion('');
        setFiltroDesde('');
        setFiltroHasta('');
        setPage(1);
    };

    // ── Paginación ─────────────────────────────────────────────
    const buildPageNumbers = () => {
        if (!pagination) return [];
        return Array.from({ length: pagination.last_page }, (_, i) => i + 1)
            .filter(p =>
                p === 1 || p === pagination.last_page ||
                (p >= page - 1 && p <= page + 1)
            )
            .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                acc.push(p);
                return acc;
            }, []);
    };

    // ─────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────
    return (
        <div className="list-page">

            {/* ── Topbar ────────────────────────────────────── */}
            <header className="list-topbar">
                <button
                    className="list-topbar__back"
                    onClick={() => navigate('/dashboard')}
                >
                    ← Dashboard
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Auditoría</span>
                </div>
            </header>

            <div className="list-container">

                {/* ── Encabezado ────────────────────────────── */}
                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Historial de Auditoría</h1>
                        <p className="list-heading__subtitle">
                            {pagination
                                ? `${pagination.total} eventos registrados`
                                : 'Cargando...'}
                            {' — '}Solo acciones de administradores
                        </p>
                    </div>
                </div>

                {/* ── Panel de filtros ──────────────────────── */}
                <div className="audit-filters">
                    <select
                        value={filtroTabla}
                        onChange={e => setFiltroTabla(e.target.value)}
                        className="audit-filter__select"
                        aria-label="Filtrar por tabla"
                    >
                        {TABLA_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>

                    <select
                        value={filtroAccion}
                        onChange={e => setFiltroAccion(e.target.value)}
                        className="audit-filter__select"
                        aria-label="Filtrar por acción"
                    >
                        {ACCION_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>

                    <input
                        type="date"
                        value={filtroDesde}
                        onChange={e => setFiltroDesde(e.target.value)}
                        className="audit-filter__date"
                        aria-label="Desde"
                        title="Desde"
                    />
                    <input
                        type="date"
                        value={filtroHasta}
                        onChange={e => setFiltroHasta(e.target.value)}
                        className="audit-filter__date"
                        aria-label="Hasta"
                        title="Hasta"
                    />

                    <button
                        className="list-btn list-btn--primary"
                        onClick={aplicarFiltros}
                        type="button"
                    >
                        Filtrar
                    </button>
                    <button
                        className="list-btn list-btn--ghost"
                        onClick={limpiarFiltros}
                        type="button"
                    >
                        Limpiar
                    </button>
                </div>

                {/* ── Error global ──────────────────────────── */}
                {error && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span> {error}
                        <button
                            onClick={() => fetchAuditorias()}
                            className="list-alert__retry"
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                {/* ── Tabla ─────────────────────────────────── */}
                <div className="list-table-wrap">
                    {loading ? (
                        <div className="list-loading">
                            <span className="list-loading__spinner" />
                            <p>Cargando historial...</p>
                        </div>
                    ) : registros.length === 0 ? (
                        <div className="list-empty">
                            <span>🔍</span>
                            <p>No hay eventos de auditoría con los filtros seleccionados.</p>
                        </div>
                    ) : (
                        <table className="list-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Administrador</th>
                                    <th>Acción</th>
                                    <th>Tabla</th>
                                    <th className="td-center">ID Registro</th>
                                    <th>IP</th>
                                    <th className="th-actions">Detalles</th>
                                </tr>
                            </thead>
                            <tbody>
                                {registros.map((reg) => {
                                    const badge = ACCION_BADGE[reg.accion] ?? {
                                        label: reg.accion,
                                        cls:   'badge--blue',
                                    };
                                    return (
                                        <tr key={reg.id}>
                                            {/* Fecha legible con ISO en title para tooltip */}
                                            <td className="td-meta">
                                                <time
                                                    dateTime={reg.fecha_iso}
                                                    title={reg.fecha_iso}
                                                >
                                                    {reg.fecha_legible}
                                                </time>
                                            </td>

                                            {/* Operador — string plano del Resource */}
                                            <td>
                                                <span className="audit-operador">
                                                    {reg.operador ?? '—'}
                                                </span>
                                                {reg.operador_email && (
                                                    <span className="td-meta__sub audit-email">
                                                        {reg.operador_email}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Badge de acción */}
                                            <td>
                                                <span className={`badge ${badge.cls}`}>
                                                    {badge.label}
                                                </span>
                                            </td>

                                            {/* Tabla afectada */}
                                            <td className="td-code">{reg.tabla_afectada}</td>

                                            {/* ID del registro afectado */}
                                            <td className="td-center td-meta">
                                                #{reg.registro_id}
                                            </td>

                                            {/* IP */}
                                            <td className="td-meta">
                                                {reg.direccion_ip ?? '—'}
                                            </td>

                                            {/* Botón de detalle */}
                                            <td>
                                                <div className="td-actions">
                                                    <button
                                                        className="action-btn action-btn--edit"
                                                        onClick={() => setModalRegistro(reg)}
                                                        title="Ver cambios en detalle"
                                                        type="button"
                                                    >
                                                        👁 Ver
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Paginación ────────────────────────────── */}
                {pagination && pagination.last_page > 1 && (
                    <div className="list-pagination">
                        <button
                            className="page-btn"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                        >
                            ← Anterior
                        </button>

                        <div className="page-numbers">
                            {buildPageNumbers().map((p, idx) =>
                                p === '...' ? (
                                    <span key={`e-${idx}`} className="page-ellipsis">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        className={`page-btn page-btn--num ${p === page ? 'page-btn--active' : ''}`}
                                        onClick={() => setPage(p)}
                                        disabled={loading}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                        </div>

                        <button
                            className="page-btn"
                            onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))}
                            disabled={page === pagination.last_page || loading}
                        >
                            Siguiente →
                        </button>

                        <span className="page-info">
                            Página {page} de {pagination.last_page}
                            {' '}({pagination.total} registros)
                        </span>
                    </div>
                )}
            </div>

            {/* ════════════════════════════════════════════════
             *  MODAL DE DETALLE — valor_anterior / valor_nuevo
             * ════════════════════════════════════════════════ */}
            {modalRegistro && (
                <div
                    className="audit-modal-overlay"
                    onClick={() => setModalRegistro(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Detalle del evento de auditoría"
                >
                    <div
                        className="audit-modal"
                        onClick={e => e.stopPropagation()} // evitar cierre al clicar dentro
                    >
                        {/* Encabezado del modal */}
                        <div className="audit-modal__header">
                            <div>
                                <h2 className="audit-modal__title">
                                    Detalle del Evento #{modalRegistro.id}
                                </h2>
                                <p className="audit-modal__meta">
                                    <span className={`badge ${ACCION_BADGE[modalRegistro.accion]?.cls ?? 'badge--blue'}`}>
                                        {ACCION_BADGE[modalRegistro.accion]?.label ?? modalRegistro.accion}
                                    </span>
                                    {' '}en <strong>{modalRegistro.tabla_afectada}</strong>
                                    {' '}· Registro #{modalRegistro.registro_id}
                                    {' '}· {modalRegistro.fecha_legible}
                                </p>
                            </div>
                            <button
                                className="audit-modal__close"
                                onClick={() => setModalRegistro(null)}
                                aria-label="Cerrar modal"
                                type="button"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Operador */}
                        <div className="audit-modal__operador">
                            <span className="audit-modal__label">Realizado por</span>
                            <span>{modalRegistro.operador}</span>
                            {modalRegistro.operador_email && (
                                <span className="td-meta__sub"> ({modalRegistro.operador_email})</span>
                            )}
                            {modalRegistro.direccion_ip && (
                                <span className="audit-modal__ip">
                                    · IP: {modalRegistro.direccion_ip}
                                </span>
                            )}
                        </div>

                        {/* Diff: valor anterior / nuevo */}
                        <div className="audit-modal__diff">
                            <div className="audit-diff__panel audit-diff__panel--before">
                                <h3 className="audit-diff__title">Valor Anterior</h3>
                                <pre className="audit-diff__json">
                                    {modalRegistro.valor_anterior
                                        ? JSON.stringify(modalRegistro.valor_anterior, null, 2)
                                        : '(sin datos previos — registro nuevo)'}
                                </pre>
                            </div>
                            <div className="audit-diff__panel audit-diff__panel--after">
                                <h3 className="audit-diff__title">Valor Nuevo</h3>
                                <pre className="audit-diff__json">
                                    {modalRegistro.valor_nuevo
                                        ? JSON.stringify(modalRegistro.valor_nuevo, null, 2)
                                        : '(registro eliminado — sin valores nuevos)'}
                                </pre>
                            </div>
                        </div>

                        {/* User agent */}
                        {modalRegistro.user_agent && (
                            <p className="audit-modal__useragent" title={modalRegistro.user_agent}>
                                🌐 {modalRegistro.user_agent}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

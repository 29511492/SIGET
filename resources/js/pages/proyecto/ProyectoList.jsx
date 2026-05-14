/**
 * resources/js/pages/proyectos/ProyectoList.jsx
 *
 * CORRECCIÓN: navigate(`/proyectos/editar/${p.id}`)
 * La ruta dinámica en app.jsx es /proyectos/editar/:id,
 * por lo que el segmento estático 'editar' va ANTES del parámetro.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../../hooks/useAuth';
import apiClient       from '../../services/axios';
import ConfirmModal    from '../../components/ui/ConfirmModal';
import './ProyectoList.css';

const BADGE = {
    presentado:   { cls: 'badge--gray',  label: 'Presentado'   },
    aprobado:     { cls: 'badge--blue',  label: 'Aprobado'     },
    en_ejecucion: { cls: 'badge--amber', label: 'En Ejecución' },
    finalizado:   { cls: 'badge--green', label: 'Finalizado'   },
    paralizado:   { cls: 'badge--red',   label: 'Paralizado'   },
};

const ESTATUS_OPTS = [
    { value: '',             label: 'Todos los estatus'  },
    { value: 'presentado',   label: 'Presentado'         },
    { value: 'aprobado',     label: 'Aprobado'           },
    { value: 'en_ejecucion', label: 'En ejecución'       },
    { value: 'finalizado',   label: 'Finalizado'         },
    { value: 'paralizado',   label: 'Paralizado'         },
];

const fmt = (v) =>
    v != null && v !== ''
        ? new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
        : '—';

export default function ProyectoList() {
    const navigate              = useNavigate();
    const { isAdmin, canWrite } = useAuth();

    const [proyectos,  setProyectos]  = useState([]);
    const [pagination, setPagination] = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState(null);
    const [search,     setSearch]     = useState('');
    const [estatus,    setEstatus]    = useState('');
    const [page,       setPage]       = useState(1);
    const searchTimer = useRef(null);

    const [toDelete, setToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchProyectos = useCallback(async (q = search, p = page, e = estatus) => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/v1/proyectos', {
                params: {
                    search:   q || undefined,
                    page:     p,
                    per_page: 10,
                    estatus:  e || undefined,
                },
            });
            setProyectos(res.data.data);
            setPagination(res.data.meta);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al cargar proyectos.');
        } finally {
            setLoading(false);
        }
    }, [search, page, estatus]);

    useEffect(() => { fetchProyectos(); }, [page]);

    const handleSearch = (value) => {
        setSearch(value);
        setPage(1);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => fetchProyectos(value, 1, estatus), 400);
    };

    const handleEstatus = (value) => {
        setEstatus(value);
        setPage(1);
        fetchProyectos(search, 1, value);
    };

    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await apiClient.delete(`/v1/proyectos/${toDelete.id}`);
            setProyectos(prev => prev.filter(p => p.id !== toDelete.id));
            setPagination(prev => prev ? { ...prev, total: prev.total - 1 } : prev);
            setToDelete(null);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al eliminar el proyecto.');
            setToDelete(null);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="list-page">

            <header className="list-topbar">
                <button
                    className="list-topbar__back"
                    onClick={() => navigate('/dashboard')}
                >
                    ← Dashboard
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Proyectos</span>
                </div>
            </header>

            <div className="list-container">

                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Proyectos</h1>
                        <p className="list-heading__subtitle">
                            {pagination
                                ? `${pagination.total} proyecto${pagination.total !== 1 ? 's' : ''} registrado${pagination.total !== 1 ? 's' : ''}`
                                : 'Cargando...'}
                        </p>
                    </div>
                    {canWrite && (
                        <button
                            className="list-btn list-btn--primary"
                            onClick={() => navigate('/proyectos/crear')}
                        >
                            + Nuevo Proyecto
                        </button>
                    )}
                </div>

                <div className="proyecto-toolbar">
                    <div className="list-search">
                        <span className="list-search__icon">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Buscar por nombre de proyecto..."
                            className="list-search__input"
                        />
                        {search && (
                            <button
                                className="list-search__clear"
                                onClick={() => handleSearch('')}
                            >✕</button>
                        )}
                    </div>
                    <select
                        className="proyecto-filter-select"
                        value={estatus}
                        onChange={(e) => handleEstatus(e.target.value)}
                    >
                        {ESTATUS_OPTS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>

                {error && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span> {error}
                        <button onClick={() => fetchProyectos()} className="list-alert__retry">
                            Reintentar
                        </button>
                    </div>
                )}

                <div className="list-table-wrap">
                    {loading ? (
                        <div className="list-loading">
                            <span className="list-loading__spinner" />
                            <p>Cargando proyectos...</p>
                        </div>
                    ) : proyectos.length === 0 ? (
                        <div className="list-empty">
                            <span>📋</span>
                            <p>{search
                                ? `Sin resultados para "${search}"`
                                : 'No hay proyectos registrados.'}</p>
                        </div>
                    ) : (
                        <table className="list-table">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Sede</th>
                                    <th>Comité</th>
                                    <th>Fuente</th>
                                    <th style={{ textAlign: 'right' }}>Monto (Bs.)</th>
                                    <th>Estatus</th>
                                    <th>Inicio</th>
                                    <th>Fin</th>
                                    {(canWrite || isAdmin) && (
                                        <th className="th-actions">Acciones</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {proyectos.map(p => {
                                    const badge = BADGE[p.estatus] ?? { cls: 'badge--gray', label: p.estatus };
                                    return (
                                        <tr key={p.id}>
                                            <td className="td-nombre" title={p.nombre_proyecto}>
                                                {p.nombre_proyecto}
                                            </td>
                                            <td className="td-meta">
                                                {p.sede_nombre ?? <span className="td-none">—</span>}
                                            </td>
                                            <td className="td-meta">
                                                {p.comite_nombre ?? <span className="td-none">—</span>}
                                            </td>
                                            <td>{p.fuente_financiamiento}</td>
                                            <td className="td-monto">{fmt(p.monto_aprobado)}</td>
                                            <td>
                                                <span className={`badge ${badge.cls}`}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td className="td-fecha">
                                                {p.fecha_inicio ?? <span className="td-none">—</span>}
                                            </td>
                                            <td className="td-fecha">
                                                {p.fecha_fin ?? <span className="td-none">—</span>}
                                            </td>
                                            {(canWrite || isAdmin) && (
                                                <td>
                                                    <div className="td-actions">
                                                        {canWrite && (
                                                            <button
                                                                className="action-btn action-btn--edit"
                                                                onClick={() => navigate(`/proyectos/editar/${p.id}`)}
                                                                title="Editar proyecto"
                                                            >
                                                                ✏
                                                            </button>
                                                        )}
                                                        {isAdmin && (
                                                            <button
                                                                className="action-btn action-btn--delete"
                                                                onClick={() => setToDelete(p)}
                                                                title="Eliminar proyecto"
                                                            >
                                                                🗑
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

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
                            {Array.from({ length: pagination.last_page }, (_, i) => i + 1)
                                .filter(p =>
                                    p === 1 ||
                                    p === pagination.last_page ||
                                    (p >= page - 1 && p <= page + 1)
                                )
                                .reduce((acc, p, idx, arr) => {
                                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                                    acc.push(p);
                                    return acc;
                                }, [])
                                .map((p, idx) =>
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
                                )
                            }
                        </div>

                        <button
                            className="page-btn"
                            onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))}
                            disabled={page === pagination.last_page || loading}
                        >
                            Siguiente →
                        </button>

                        <span className="page-info">
                            Página {page} de {pagination.last_page} ({pagination.total} registros)
                        </span>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={!!toDelete}
                title="Eliminar proyecto"
                message={`¿Eliminar "${toDelete?.nombre_proyecto}"?`}
                detail="El registro se marcará como eliminado (soft delete). El contador del Dashboard se actualizará automáticamente."
                confirmLabel="Sí, eliminar"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setToDelete(null)}
                isLoading={deleting}
            />
        </div>
    );
}

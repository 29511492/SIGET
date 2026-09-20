/**
 * Imports relativos desde pages/familias/:
 *   apiClient    → '../../services/axios'
 *   useAuth      → '../../hooks/useAuth'
 *   ConfirmModal → '../../components/ui/ConfirmModal'
 *   FormModal    → '../../components/ui/FormModal'
 *   FamiliaForm  → './FamiliaForm'
 *   CSS          → './FamiliaList.css'
 */

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }      from '../../hooks/useAuth';
import apiClient        from '../../services/axios';
import ConfirmModal     from '../../components/ui/ConfirmModal';
import FormModal        from '../../components/ui/FormModal';
import FamiliaForm      from './FamiliaForm';
import './FamiliaList.css';

const CONDICION_LABEL = {
    optima:  { label: 'Óptima',  cls: 'badge--green'  },
    regular: { label: 'Regular', cls: 'badge--amber'  },
    critica: { label: 'Crítica', cls: 'badge--red'    },
};

const SEXO_LABEL = {
    masculino: 'Masculino',
    femenino:  'Femenino',
    otro:      'Otro',
};

const NIVEL_LABEL = {
    ninguno:       'Ninguno',
    primaria:      'Primaria',
    bachillerato:  'Bachillerato',
    tecnico:       'Técnico',
    universitario: 'Universitario',
    postgrado:     'Postgrado',
};

export default function FamiliaList() {
    const navigate        = useNavigate();
    const { isAdmin, canWrite } = useAuth();

    // ── Estado de listado ─────────────────────────────────────────
    const [familias,    setFamilias]    = useState([]);
    const [pagination,  setPagination]  = useState(null);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState(null);
    const [search,      setSearch]      = useState('');
    const [page,        setPage]        = useState(1);
    const searchTimer = useRef(null);

    // ── Estado de eliminación ─────────────────────────────────────
    const [toDelete,    setToDelete]    = useState(null);  // Familia a eliminar
    const [deleting,    setDeleting]    = useState(false);

    // ── Estado del modal de registro/edición ────────────────────────
    // showCreateModal: abre FamiliaForm en modo creación.
    // editingFamilia: familia completa (con habitantes) para editar;
    // null = modal de edición cerrado.
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingFamilia,  setEditingFamilia]  = useState(null);
    const [loadingEditId,   setLoadingEditId]   = useState(null);

    // ── Estado del menú plegable de habitantes por familia ──────────
    // expandedId: id de la familia actualmente desplegada (o null).
    // habitantesCache: { [familiaId]: [habitantes] } — evita repetir
    // la petición si se colapsa y se vuelve a expandir la misma fila.
    const [expandedId,       setExpandedId]       = useState(null);
    const [habitantesCache,  setHabitantesCache]  = useState({});
    const [loadingExpandId,  setLoadingExpandId]  = useState(null);

    const showActionsCol = canWrite || isAdmin;
    const totalCols = 6 + (showActionsCol ? 1 : 0); // toggle + 5 columnas + acciones

    // ── Carga de datos ────────────────────────────────────────────
    const fetchFamilias = useCallback(async (q = search, p = page) => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/v1/familias', {
                params: { search: q || undefined, page: p, per_page: 10 },
            });
            setFamilias(res.data.data);
            setPagination(res.data.meta);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al cargar familias.');
        } finally {
            setLoading(false);
        }
    }, [search, page]);

    useEffect(() => { fetchFamilias(); }, [page]);

    // Debounce de búsqueda
    const handleSearch = (value) => {
        setSearch(value);
        setPage(1);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => fetchFamilias(value, 1), 400);
    };

    // ── Menú plegable de habitantes ─────────────────────────────────
    const toggleExpand = async (familia) => {
        if (expandedId === familia.id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(familia.id);

        if (habitantesCache[familia.id]) return; // ya está en caché

        setLoadingExpandId(familia.id);
        try {
            const res = await apiClient.get(`/v1/familias/${familia.id}`);
            setHabitantesCache(prev => ({ ...prev, [familia.id]: res.data.data.habitantes ?? [] }));
        } catch {
            setHabitantesCache(prev => ({ ...prev, [familia.id]: [] }));
        } finally {
            setLoadingExpandId(null);
        }
    };

    // ── Edición (modal completo, con habitantes) ────────────────────
    const openEditModal = async (familia) => {
        setLoadingEditId(familia.id);
        try {
            const res = await apiClient.get(`/v1/familias/${familia.id}`);
            setEditingFamilia(res.data.data);
        } catch (err) {
            setError(err.response?.data?.message ?? 'No se pudo cargar la familia para editar.');
        } finally {
            setLoadingEditId(null);
        }
    };

    const closeEditModal = () => setEditingFamilia(null);

    const handleEditSuccess = () => {
        const idEditado = editingFamilia?.id;
        setEditingFamilia(null);
        fetchFamilias();

        // Invalidar el caché de habitantes de esa familia: si estaba
        // expandida, la próxima vez que se abra debe traer datos frescos.
        if (idEditado) {
            setHabitantesCache(prev => {
                const next = { ...prev };
                delete next[idEditado];
                return next;
            });
        }
    };

    // ── Eliminación con confirmación ──────────────────────────────
    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await apiClient.delete(`/v1/familias/${toDelete.id}`);
            setFamilias(prev => prev.filter(f => f.id !== toDelete.id));
            setPagination(prev => prev ? { ...prev, total: prev.total - 1 } : prev);

            if (expandedId === toDelete.id) setExpandedId(null);
            setHabitantesCache(prev => {
                const next = { ...prev };
                delete next[toDelete.id];
                return next;
            });

            setToDelete(null);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al dar de baja la familia.');
            setToDelete(null);
        } finally {
            setDeleting(false);
        }
    };

    // ── Registro de familia (modal) ────────────────────────────────
    const closeCreateModal = () => setShowCreateModal(false);

    const handleCreateSuccess = () => {
        setShowCreateModal(false);
        // Recarga la página actual del listado para reflejar la nueva familia.
        // La URL nunca cambió de /familias durante todo el flujo.
        fetchFamilias();
    };

    // ─────────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="list-page">

            <header className="list-topbar">
                <button className="list-topbar__back" onClick={() => navigate('/dashboard')}>
                    ← Dashboard
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Familias</span>
                </div>
            </header>

            <div className="list-container">

                {/* ── Encabezado y acciones ───────────────────── */}
                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Familias del Censo</h1>
                        <p className="list-heading__subtitle">
                            {pagination ? `${pagination.total} familias registradas` : 'Cargando...'}
                        </p>
                    </div>
                    {canWrite && (
                        <button
                            className="list-btn list-btn--primary"
                            onClick={() => setShowCreateModal(true)}
                        >
                            + Registrar Familia
                        </button>
                    )}
                </div>

                {/* ── Buscador ────────────────────────────────── */}
                <div className="list-toolbar">
                    <div className="list-search">
                        <span className="list-search__icon">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Buscar por código o responsable..."
                            className="list-search__input"
                        />
                        {search && (
                            <button className="list-search__clear" onClick={() => handleSearch('')}>✕</button>
                        )}
                    </div>
                </div>

                {/* ── Error global ────────────────────────────── */}
                {error && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span> {error}
                        <button onClick={() => fetchFamilias()} className="list-alert__retry">Reintentar</button>
                    </div>
                )}

                {/* ── Tabla ───────────────────────────────────── */}
                <div className="list-table-wrap">
                    {loading ? (
                        <div className="list-loading">
                            <span className="list-loading__spinner" />
                            <p>Cargando familias...</p>
                        </div>
                    ) : familias.length === 0 ? (
                        <div className="list-empty">
                            <span>🏠</span>
                            <p>{search ? `Sin resultados para "${search}"` : 'No hay familias registradas.'}</p>
                        </div>
                    ) : (
                        <table className="list-table">
                            <thead>
                                <tr>
                                    <th className="th-toggle" aria-hidden="true"></th>
                                    <th>Código</th>
                                    <th>Responsable</th>
                                    <th>Condición</th>
                                    <th>Servicios</th>
                                    <th>Sede / Calle</th>
                                    {showActionsCol && <th className="th-actions">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {familias.map((familia) => {
                                    const isExpanded = expandedId === familia.id;
                                    const habitantesDeEstaFamilia = habitantesCache[familia.id];

                                    return (
                                        <Fragment key={familia.id}>
                                            <tr className={isExpanded ? 'tr-expanded-parent' : ''}>
                                                <td className="td-toggle">
                                                    <button
                                                        type="button"
                                                        className="toggle-expand-btn"
                                                        onClick={() => toggleExpand(familia)}
                                                        aria-label={isExpanded ? 'Ocultar habitantes' : 'Ver habitantes'}
                                                        aria-expanded={isExpanded}
                                                    >
                                                        {isExpanded ? '▾' : '▸'}
                                                    </button>
                                                </td>
                                                <td className="td-code">{familia.codigo_vivienda}</td>
                                                <td>{familia.nombre_responsable ?? '—'}</td>
                                                <td>
                                                    <span className={`badge ${CONDICION_LABEL[familia.condicion_vivienda]?.cls}`}>
                                                        {CONDICION_LABEL[familia.condicion_vivienda]?.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    {/* ── Servicios: gas + agua + luz + aseo ── */}
                                                    <div className="servicios-list">
                                                        <span className="servicio-chip servicio-chip--gas" title="Gas doméstico">
                                                            🔥 {familia.cantidad_bombonas}×{familia.capacidad_bombona}
                                                        </span>
                                                        <span
                                                            className={`servicio-chip ${familia.posee_agua_potable ? 'servicio-chip--activo' : 'servicio-chip--inactivo'}`}
                                                            title={familia.posee_agua_potable ? 'Con agua potable' : 'Sin agua potable'}
                                                        >
                                                            💧 Agua
                                                        </span>
                                                        <span
                                                            className={`servicio-chip ${familia.posee_luz ? 'servicio-chip--activo' : 'servicio-chip--inactivo'}`}
                                                            title={familia.posee_luz ? 'Con servicio eléctrico' : 'Sin servicio eléctrico'}
                                                        >
                                                            💡 Luz
                                                        </span>
                                                        <span
                                                            className={`servicio-chip ${familia.posee_aseo ? 'servicio-chip--activo' : 'servicio-chip--inactivo'}`}
                                                            title={familia.posee_aseo ? 'Con recolección de aseo' : 'Sin recolección de aseo'}
                                                        >
                                                            🗑️ Aseo
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="td-meta">
                                                    {familia.sede?.nombre ?? '—'}
                                                    {familia.calle?.nombre && <span className="td-meta__sub"> · {familia.calle.nombre}</span>}
                                                </td>
                                                {showActionsCol && (
                                                    <td>
                                                        <div className="td-actions">
                                                            {canWrite && (
                                                                <button
                                                                    className="action-btn action-btn--edit"
                                                                    onClick={() => openEditModal(familia)}
                                                                    disabled={loadingEditId === familia.id}
                                                                >
                                                                    {loadingEditId === familia.id ? '⏳' : '✏'}
                                                                </button>
                                                            )}
                                                            {isAdmin && (
                                                                <button
                                                                    className="action-btn action-btn--delete"
                                                                    onClick={() => setToDelete(familia)}
                                                                >
                                                                    🗑
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>

                                            {/* ── Fila plegable: habitantes de la familia ──── */}
                                            {isExpanded && (
                                                <tr className="tr-expanded" key={`${familia.id}-habitantes`}>
                                                    <td colSpan={totalCols}>
                                                        <div className="habitantes-expand">
                                                            {loadingExpandId === familia.id ? (
                                                                <div className="habitantes-expand__loading">
                                                                    <span className="list-loading__spinner list-loading__spinner--sm" />
                                                                    Cargando habitantes...
                                                                </div>
                                                            ) : !habitantesDeEstaFamilia || habitantesDeEstaFamilia.length === 0 ? (
                                                                <div className="habitantes-expand__empty">
                                                                    Esta familia no tiene habitantes registrados.
                                                                </div>
                                                            ) : (
                                                                <ul className="habitantes-expand__list">
                                                                    {habitantesDeEstaFamilia.map(h => (
                                                                        <li key={h.id} className="habitantes-expand__item">
                                                                            <span className="habitantes-expand__name">
                                                                                👤 {h.nombre_completo}
                                                                            </span>
                                                                            <span className="habitantes-expand__meta">
                                                                                {h.edad !== null ? `${h.edad} años` : 'Edad —'}
                                                                                {' · '}
                                                                                {SEXO_LABEL[h.sexo] ?? h.sexo}
                                                                                {' · '}
                                                                                {NIVEL_LABEL[h.nivel_educativo] ?? h.nivel_educativo}
                                                                            </span>
                                                                            <span className="habitantes-expand__extra">
                                                                                {h.cedula && (
                                                                                    <span className="habitantes-expand__cedula">{h.cedula}</span>
                                                                                )}
                                                                                {h.es_discapacitado && (
                                                                                    <span className="badge badge--purple">♿ Discapacidad</span>
                                                                                )}
                                                                            </span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Paginación ──────────────────────────────── */}
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
                                .filter(p => p === 1 || p === pagination.last_page ||
                                    (p >= page - 1 && p <= page + 1))
                                .reduce((acc, p, idx, arr) => {
                                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                                    acc.push(p);
                                    return acc;
                                }, [])
                                .map((p, idx) =>
                                    p === '...' ? (
                                        <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
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
                            Página {page} de {pagination.last_page}
                            {' '}({pagination.total} registros)
                        </span>
                    </div>
                )}
            </div>

            {/* ── Modal de registro de familia ─────────────────
                Ya no navega a /familias/crear: se abre encima de
                /familias sin cambiar la URL.                     */}
            <FormModal
                isOpen={showCreateModal}
                title="Registrar Nueva Familia"
                onClose={closeCreateModal}
            >
                <FamiliaForm
                    onCancel={closeCreateModal}
                    onSuccess={handleCreateSuccess}
                />
            </FormModal>

            {/* ── Modal de edición de familia (con sus habitantes) ── */}
            <FormModal
                isOpen={!!editingFamilia}
                title="Editar Familia"
                onClose={closeEditModal}
            >
                {editingFamilia && (
                    <FamiliaForm
                        key={editingFamilia.id}
                        familiaExistente={editingFamilia}
                        onCancel={closeEditModal}
                        onSuccess={handleEditSuccess}
                    />
                )}
            </FormModal>

            {/* ── Modal de confirmación de baja ──────────────── */}
            <ConfirmModal
                isOpen={!!toDelete}
                title="Dar de baja familia"
                message={`¿Dar de baja la vivienda ${toDelete?.codigo_vivienda} — ${toDelete?.nombre_responsable}?`}
                detail="El registro se conserva en la base de datos (soft delete). Puede recuperarse desde Auditoría."
                confirmLabel="Sí, dar de baja"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setToDelete(null)}
                isLoading={deleting}
            />
        </div>
    );
}

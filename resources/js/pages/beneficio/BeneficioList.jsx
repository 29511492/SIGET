/**
 * resources/js/pages/beneficios/BeneficioList.jsx
 *
 * Clon de HabitanteList.jsx con los datos de Beneficios.
 * Edición inline de nombre_beneficio, fecha_entrega y observaciones.
 *
 * Imports — misma ruta relativa que HabitanteList:
 *   apiClient    → '../../services/axios'
 *   useAuth      → '../../hooks/useAuth'
 *   ConfirmModal → '../../components/ui/ConfirmModal'
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../../hooks/useAuth';
import apiClient       from '../../services/axios';
import ConfirmModal    from '../../components/ui/ConfirmModal';
import './BeneficioList.css';

export default function BeneficioList() {
    const navigate              = useNavigate();
    const { isAdmin, canWrite } = useAuth();

    // ── Estado de listado ────────────────────────────────────────────────────
    const [beneficios,  setBeneficios]  = useState([]);
    const [pagination,  setPagination]  = useState(null);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState(null);
    const [search,      setSearch]      = useState('');
    const [page,        setPage]        = useState(1);
    const searchTimer = useRef(null);

    // ── Estado de edición inline ─────────────────────────────────────────────
    const [editingId,  setEditingId]  = useState(null);
    const [editForm,   setEditForm]   = useState({});
    const [editErrors, setEditErrors] = useState({});
    const [saving,     setSaving]     = useState(false);

    // ── Estado de eliminación ────────────────────────────────────────────────
    const [toDelete, setToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // ── Carga — misma estructura que fetchHabitantes ─────────────────────────
    const fetchBeneficios = useCallback(async (q = search, p = page) => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/v1/beneficios', {
                params: { search: q || undefined, page: p, per_page: 10 },
            });
            setBeneficios(res.data.data);
            setPagination(res.data.meta);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al cargar beneficios.');
        } finally {
            setLoading(false);
        }
    }, [search, page]);

    useEffect(() => { fetchBeneficios(); }, [page]);

    // ── Búsqueda debounce 400ms — idéntico a HabitanteList ───────────────────
    const handleSearch = (value) => {
        setSearch(value);
        setPage(1);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => fetchBeneficios(value, 1), 400);
    };

    // ── Edición inline — misma lógica que startEdit en HabitanteList ─────────
    const startEdit = (b) => {
        setEditingId(b.id);
        setEditForm({
            nombre_beneficio: b.nombre_beneficio,
            fecha_entrega:    b.fecha_entrega ?? '',
            observaciones:    b.observaciones ?? '',
        });
        setEditErrors({});
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
        setEditErrors({});
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditForm(prev => ({ ...prev, [name]: value }));
        if (editErrors[name]) setEditErrors(prev => ({ ...prev, [name]: '' }));
    };

    const saveEdit = async (beneficioId) => {
        setSaving(true);
        try {
            const payload = {
                nombre_beneficio: editForm.nombre_beneficio.trim(),
                fecha_entrega:    editForm.fecha_entrega    || null,
                observaciones:    editForm.observaciones.trim() || null,
            };
            const res = await apiClient.put(`/v1/beneficios/${beneficioId}`, payload);
            setBeneficios(prev =>
                prev.map(b => b.id === beneficioId ? res.data.data : b)
            );
            setEditingId(null);
        } catch (err) {
            if (err.response?.status === 422) {
                setEditErrors(err.response.data.errors ?? {});
            }
        } finally {
            setSaving(false);
        }
    };

    // ── Eliminación — misma lógica que confirmDelete en HabitanteList ────────
    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await apiClient.delete(`/v1/beneficios/${toDelete.id}`);
            setBeneficios(prev => prev.filter(b => b.id !== toDelete.id));
            setPagination(prev => prev ? { ...prev, total: prev.total - 1 } : prev);
            setToDelete(null);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al eliminar el beneficio.');
            setToDelete(null);
        } finally {
            setDeleting(false);
        }
    };

    const fieldErr = (name) => editErrors[name]?.[0] ?? editErrors[name] ?? '';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="list-page">

            {/* Topbar — idéntico a HabitanteList */}
            <header className="list-topbar">
                <button className="list-topbar__back" onClick={() => navigate('/dashboard')}>
                    ← Dashboard
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Beneficios</span>
                </div>
            </header>

            <div className="list-container">

                {/* Encabezado con DM Serif Display */}
                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Beneficios Entregados</h1>
                        <p className="list-heading__subtitle">
                            {pagination
                                ? `${pagination.total} beneficio${pagination.total !== 1 ? 's' : ''} registrado${pagination.total !== 1 ? 's' : ''}`
                                : 'Cargando...'}
                        </p>
                    </div>
                    {canWrite && (
                        <button
                            className="list-btn list-btn--primary"
                            onClick={() => navigate('/beneficios/crear')}
                        >
                            + Registrar Beneficio
                        </button>
                    )}
                </div>

                {/* Búsqueda */}
                <div className="list-toolbar">
                    <div className="list-search">
                        <span className="list-search__icon">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Buscar por beneficio o responsable de familia..."
                            className="list-search__input"
                        />
                        {search && (
                            <button className="list-search__clear" onClick={() => handleSearch('')}>✕</button>
                        )}
                    </div>
                </div>

                {/* Alerta */}
                {error && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span> {error}
                        <button onClick={() => fetchBeneficios()} className="list-alert__retry">
                            Reintentar
                        </button>
                    </div>
                )}

                {/* Tabla */}
                <div className="list-table-wrap">
                    {loading ? (
                        <div className="list-loading">
                            <span className="list-loading__spinner" />
                            <p>Cargando beneficios...</p>
                        </div>
                    ) : beneficios.length === 0 ? (
                        <div className="list-empty">
                            <span>🎁</span>
                            <p>{search
                                ? `Sin resultados para "${search}"`
                                : 'No hay beneficios registrados aún.'}</p>
                        </div>
                    ) : (
                        <table className="list-table">
                            <thead>
                                <tr>
                                    <th>Familia (Responsable)</th>
                                    <th>Código</th>
                                    <th>Beneficio</th>
                                    <th>Fecha de Entrega</th>
                                    <th>Observaciones</th>
                                    <th>Registrado por</th>
                                    {(canWrite || isAdmin) && <th className="th-actions">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {beneficios.map(b =>
                                    editingId === b.id ? (
                                        /* ── Fila en edición — mismo patrón que HabitanteList ── */
                                        <tr key={b.id} className="tr-editing">
                                            {/* Familia (no editable en inline — solo en el Form) */}
                                            <td className="td-meta">
                                                {b.familia_responsable ?? '—'}
                                            </td>
                                            <td className="td-code">
                                                {b.familia_codigo ?? '—'}
                                            </td>
                                            <td>
                                                <input
                                                    name="nombre_beneficio"
                                                    value={editForm.nombre_beneficio}
                                                    onChange={handleEditChange}
                                                    className={`edit-input ${fieldErr('nombre_beneficio') ? 'edit-input--error' : ''}`}
                                                    maxLength={200}
                                                    placeholder="Nombre del beneficio..."
                                                />
                                                {fieldErr('nombre_beneficio') && (
                                                    <span className="edit-error">{fieldErr('nombre_beneficio')}</span>
                                                )}
                                            </td>
                                            <td>
                                                <input
                                                    type="date"
                                                    name="fecha_entrega"
                                                    value={editForm.fecha_entrega}
                                                    onChange={handleEditChange}
                                                    className={`edit-input ${fieldErr('fecha_entrega') ? 'edit-input--error' : ''}`}
                                                />
                                                {fieldErr('fecha_entrega') && (
                                                    <span className="edit-error">{fieldErr('fecha_entrega')}</span>
                                                )}
                                            </td>
                                            <td>
                                                <input
                                                    name="observaciones"
                                                    value={editForm.observaciones}
                                                    onChange={handleEditChange}
                                                    className="edit-input"
                                                    maxLength={500}
                                                    placeholder="Observaciones..."
                                                />
                                            </td>
                                            <td className="td-meta">{b.registrado_por ?? '—'}</td>
                                            <td>
                                                <div className="td-actions">
                                                    <button
                                                        className="action-btn action-btn--save"
                                                        onClick={() => saveEdit(b.id)}
                                                        disabled={saving}
                                                    >
                                                        {saving ? '⏳' : '✓ Guardar'}
                                                    </button>
                                                    <button
                                                        className="action-btn action-btn--cancel"
                                                        onClick={cancelEdit}
                                                        disabled={saving}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        /* ── Fila en lectura ── */
                                        <tr key={b.id}>
                                            <td>{b.familia_responsable ?? <span className="td-none">—</span>}</td>
                                            <td className="td-code">{b.familia_codigo ?? <span className="td-none">—</span>}</td>
                                            <td className="td-beneficio" title={b.nombre_beneficio}>
                                                {b.nombre_beneficio}
                                            </td>
                                            <td className="td-fecha">
                                                {b.fecha_entrega
                                                    ? new Date(b.fecha_entrega + 'T00:00:00').toLocaleDateString('es-VE', { day:'2-digit', month:'short', year:'numeric' })
                                                    : <span className="td-none">—</span>}
                                            </td>
                                            <td className="td-obs" title={b.observaciones ?? ''}>
                                                {b.observaciones ?? <span className="td-none">—</span>}
                                            </td>
                                            <td className="td-meta">
                                                {b.registrado_por
                                                    ? <span className="badge badge--teal">{b.registrado_por}</span>
                                                    : <span className="td-none">—</span>}
                                            </td>
                                            {(canWrite || isAdmin) && (
                                                <td>
                                                    <div className="td-actions">
                                                        {canWrite && (
                                                            <button
                                                                className="action-btn action-btn--edit"
                                                                onClick={() => startEdit(b)}
                                                                title="Editar beneficio"
                                                            >
                                                                ✏
                                                            </button>
                                                        )}
                                                        {isAdmin && (
                                                            <button
                                                                className="action-btn action-btn--delete"
                                                                onClick={() => setToDelete(b)}
                                                                title="Eliminar beneficio"
                                                            >
                                                                🗑
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Paginación — algoritmo ellipsis idéntico a HabitanteList */}
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

            {/* Modal de eliminación — mismas props que HabitanteList */}
            <ConfirmModal
                isOpen={!!toDelete}
                title="Eliminar beneficio"
                message={`¿Eliminar el beneficio "${toDelete?.nombre_beneficio}"?`}
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

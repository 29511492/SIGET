/**
 * Imports relativos desde pages/familias/:
 *   apiClient    → '../../services/axios'
 *   useAuth      → '../../hooks/useAuth'
 *   ConfirmModal → '../../components/ui/ConfirmModal'
 *   CSS          → './FamiliaList.css'
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }      from '../../hooks/useAuth';
import apiClient        from '../../services/axios';
import ConfirmModal     from '../../components/ui/ConfirmModal';
import './FamiliaList.css';

const CONDICION_LABEL = {
    optima:  { label: 'Óptima',  cls: 'badge--green'  },
    regular: { label: 'Regular', cls: 'badge--amber'  },
    critica: { label: 'Crítica', cls: 'badge--red'    },
};

const CONDICION_OPTIONS = [
    { value: 'optima',  label: 'Óptima'  },
    { value: 'regular', label: 'Regular' },
    { value: 'critica', label: 'Crítica' },
];

const CAPACIDAD_OPTIONS = ['10kg', '18kg', '43kg'];

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

    // ── Estado de edición inline ──────────────────────────────────
    const [editingId,   setEditingId]   = useState(null);
    const [editForm,    setEditForm]    = useState({});
    const [editErrors,  setEditErrors]  = useState({});
    const [saving,      setSaving]      = useState(false);

    // ── Estado de eliminación ─────────────────────────────────────
    const [toDelete,    setToDelete]    = useState(null);  // Familia a eliminar
    const [deleting,    setDeleting]    = useState(false);

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

    // ── Edición inline ────────────────────────────────────────────
    const startEdit = (familia) => {
        setEditingId(familia.id);
        setEditForm({
            codigo_vivienda:    familia.codigo_vivienda,
            nombre_responsable: familia.nombre_responsable ?? '',
            condicion_vivienda: familia.condicion_vivienda,
            cantidad_bombonas:  familia.cantidad_bombonas,
            capacidad_bombona:  familia.capacidad_bombona,
            posee_agua_potable: familia.posee_agua_potable,
        });
        setEditErrors({});
    };

    const cancelEdit = () => { setEditingId(null); setEditForm({}); setEditErrors({}); };

    const handleEditChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEditForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (editErrors[name]) setEditErrors(prev => ({ ...prev, [name]: '' }));
    };

    const saveEdit = async (familiaId) => {
        setSaving(true);
        try {
            const res = await apiClient.put(`/v1/familias/${familiaId}`, editForm);
            // Actualizar el registro en la lista local sin recargar todo
            setFamilias(prev =>
                prev.map(f => f.id === familiaId ? res.data.data : f)
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

    // ── Eliminación con confirmación ──────────────────────────────
    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await apiClient.delete(`/v1/familias/${toDelete.id}`);
            setFamilias(prev => prev.filter(f => f.id !== toDelete.id));
            // Actualizar paginación local
            setPagination(prev => prev ? { ...prev, total: prev.total - 1 } : prev);
            setToDelete(null);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al dar de baja la familia.');
            setToDelete(null);
        } finally {
            setDeleting(false);
        }
    };

    const fieldErr = (name) => editErrors[name]?.[0] ?? editErrors[name] ?? '';

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
                            onClick={() => navigate('/familias/crear')}
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
                                    <th>Código</th>
                                    <th>Responsable</th>
                                    <th>Condición</th>
                                    <th>Bombonas</th>
                                    <th>Agua</th>
                                    <th>Sede / Calle</th>
                                    {(canWrite || isAdmin) && <th className="th-actions">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {familias.map((familia) =>
                                    editingId === familia.id ? (
                                        /* ── Fila en modo edición ──────────────────── */
                                        <tr key={familia.id} className="tr-editing">
                                            <td>
                                                <input
                                                    name="codigo_vivienda"
                                                    value={editForm.codigo_vivienda}
                                                    onChange={handleEditChange}
                                                    className={`edit-input ${fieldErr('codigo_vivienda') ? 'edit-input--error' : ''}`}
                                                    maxLength={20}
                                                />
                                                {fieldErr('codigo_vivienda') && <span className="edit-error">{fieldErr('codigo_vivienda')}</span>}
                                            </td>
                                            <td>
                                                <input
                                                    name="nombre_responsable"
                                                    value={editForm.nombre_responsable}
                                                    onChange={handleEditChange}
                                                    className="edit-input"
                                                    maxLength={100}
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    name="condicion_vivienda"
                                                    value={editForm.condicion_vivienda}
                                                    onChange={handleEditChange}
                                                    className={`edit-select edit-select--${editForm.condicion_vivienda}`}
                                                >
                                                    {CONDICION_OPTIONS.map(o => (
                                                        <option key={o.value} value={o.value}>{o.label}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <div className="edit-row">
                                                    <input
                                                        name="cantidad_bombonas"
                                                        type="number" min={0} max={99}
                                                        value={editForm.cantidad_bombonas}
                                                        onChange={handleEditChange}
                                                        className="edit-input edit-input--sm"
                                                    />
                                                    <select
                                                        name="capacidad_bombona"
                                                        value={editForm.capacidad_bombona}
                                                        onChange={handleEditChange}
                                                        className="edit-select"
                                                    >
                                                        {CAPACIDAD_OPTIONS.map(c => (
                                                            <option key={c} value={c}>{c}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </td>
                                            <td>
                                                <label className="edit-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        name="posee_agua_potable"
                                                        checked={editForm.posee_agua_potable}
                                                        onChange={handleEditChange}
                                                    />
                                                    <span>{editForm.posee_agua_potable ? '💧 Sí' : '🚫 No'}</span>
                                                </label>
                                            </td>
                                            <td className="td-meta">—</td>
                                            <td>
                                                <div className="td-actions">
                                                    <button
                                                        className="action-btn action-btn--save"
                                                        onClick={() => saveEdit(familia.id)}
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
                                        /* ── Fila en modo lectura ──────────────────── */
                                        <tr key={familia.id}>
                                            <td className="td-code">{familia.codigo_vivienda}</td>
                                            <td>{familia.nombre_responsable ?? '—'}</td>
                                            <td>
                                                <span className={`badge ${CONDICION_LABEL[familia.condicion_vivienda]?.cls}`}>
                                                    {CONDICION_LABEL[familia.condicion_vivienda]?.label}
                                                </span>
                                            </td>
                                            <td className="td-center">
                                                {familia.cantidad_bombonas} × {familia.capacidad_bombona}
                                            </td>
                                            <td className="td-center">
                                                {familia.posee_agua_potable ? '💧' : '🚫'}
                                            </td>
                                            <td className="td-meta">
                                                {familia.sede?.nombre ?? '—'}
                                                {familia.calle?.nombre && <span className="td-meta__sub"> · {familia.calle.nombre}</span>}
                                            </td>
                                            {(canWrite || isAdmin) && (
                                                <td>
                                                    <div className="td-actions">
                                                        {canWrite && (
                                                            <button
                                                                className="action-btn action-btn--edit"
                                                                onClick={() => startEdit(familia)}
                                                            >
                                                                ✏
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
                                    )
                                )}
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

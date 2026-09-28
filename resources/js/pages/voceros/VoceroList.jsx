/**
 * Imports desde pages/voceros/:
 *   apiClient    → '../../services/axios'
 *   useAuth      → '../../hooks/useAuth'
 *   ConfirmModal → '../../components/ui/ConfirmModal'
 *   CSS          → './VoceroList.css'
 *
 * DECISIÓN — Modal de edición en vez de edición inline:
 * FamiliaList y HabitanteList usan edición inline porque sus campos
 * caben en celdas de tabla (texto, select corto, checkbox).
 * Los voceros necesitan selects de habitante, sede y comité con
 * muchas opciones. Meter eso en una fila de tabla haría la UX
 * terrible. Un modal es el patrón correcto aquí y es consistente
 * con sistemas de gestión institucional (patrón CRUD modal).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate }  from 'react-router-dom';
import { useAuth }             from '../../hooks/useAuth';
import apiClient               from '../../services/axios';
import ConfirmModal            from '../../components/ui/ConfirmModal';
import './VoceroList.css';

// ── Debounce hook local ───────────────────────────────────────────
function useDebounce(value, delay = 400) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

// ── Formulario de edición inicial vacío ──────────────────────────
const EDIT_INITIAL = {
    habitante_id:   '',
    sede_id:        '',
    comite_id:      '',
    unidad_comunal: '',
    fecha_eleccion: '',
    fecha_fin:      '',
    esta_activo:    true,
};

export default function VoceroList() {
    const navigate              = useNavigate();
    const { isAdmin, canWrite } = useAuth();

    // ── Estado del listado ────────────────────────────────────────
    const [voceros,    setVoceros]    = useState([]);
    const [pagination, setPagination] = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState(null);
    const [search,     setSearch]     = useState('');
    const [page,       setPage]       = useState(1);
    const debouncedSearch = useDebounce(search, 400);

    // ── Estado del modal de edición ───────────────────────────────
    const [editModal,   setEditModal]   = useState(false);
    const [editingId,   setEditingId]   = useState(null);
    const [editForm,    setEditForm]    = useState(EDIT_INITIAL);
    const [editErrors,  setEditErrors]  = useState({});
    const [formData,    setFormData]    = useState(null);  // listas de selects
    const [saving,      setSaving]      = useState(false);

    // ── Estado de desactivación ───────────────────────────────────
    const [toDeactivate, setToDeactivate] = useState(null);
    const [deactivating, setDeactivating] = useState(false);

    // ─────────────────────────────────────────────────────────────
    //  Carga del listado
    // ─────────────────────────────────────────────────────────────
    const fetchVoceros = useCallback(async (q = search, p = page) => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/v1/voceros', {
                params: { search: q || undefined, page: p, per_page: 10 },
            });
            setVoceros(res.data.data);
            setPagination(res.data.meta);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al cargar voceros.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Recarga cuando cambia la página
    useEffect(() => { fetchVoceros(debouncedSearch, page); }, [page, debouncedSearch]);

    const handleSearch = (value) => {
        setSearch(value);
        setPage(1);
    };

    // ─────────────────────────────────────────────────────────────
    //  Modal de edición — abrir y cargar datos
    // ─────────────────────────────────────────────────────────────
    const openEditModal = async (vocero) => {
        setEditingId(vocero.id);
        setEditErrors({});
        setEditForm({
            habitante_id:   vocero.habitante?.id   ?? '',
            sede_id:        vocero.sede?.id        ?? '',
            comite_id:      vocero.comite?.id      ?? '',
            unidad_comunal: vocero.unidad_comunal  ?? '',
            fecha_eleccion: vocero.fecha_eleccion  ?? '',
            fecha_fin:      vocero.fecha_fin       ?? '',
            esta_activo:    vocero.esta_activo,
        });

        // Cargar listas de selects si aún no se han cargado
        if (!formData) {
            try {
                const res = await apiClient.get('/v1/voceros/form-data');
                setFormData(res.data.data);
            } catch {
                setError('No se pudo cargar los datos para editar.');
                return;
            }
        }
        setEditModal(true);
    };

    const closeEditModal = () => {
        setEditModal(false);
        setEditingId(null);
        setEditForm(EDIT_INITIAL);
        setEditErrors({});
    };

    const handleEditChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEditForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (editErrors[name]) setEditErrors(prev => ({ ...prev, [name]: '' }));
    };

    const saveEdit = async () => {
        setSaving(true);
        try {
            const payload = {
                ...editForm,
                habitante_id: parseInt(editForm.habitante_id),
                sede_id:      parseInt(editForm.sede_id),
                comite_id:    editForm.comite_id ? parseInt(editForm.comite_id) : null,
                fecha_fin:    editForm.fecha_fin || null,
                esta_activo:  Boolean(editForm.esta_activo),
            };

            const res = await apiClient.put(`/v1/voceros/${editingId}`, payload);

            // Actualizar la fila en la lista local sin recargar todo
            setVoceros(prev =>
                prev.map(v => v.id === editingId ? res.data.data : v)
            );
            closeEditModal();
        } catch (err) {
            if (err.response?.status === 422) {
                setEditErrors(err.response.data.errors ?? {});
            }
        } finally {
            setSaving(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    //  Desactivación con confirmación
    // ─────────────────────────────────────────────────────────────
    const confirmDeactivate = async () => {
        if (!toDeactivate) return;
        setDeactivating(true);
        try {
            await apiClient.delete(`/v1/voceros/${toDeactivate.id}`);
            // Actualizar esta_activo en la lista local
            setVoceros(prev =>
                prev.map(v => v.id === toDeactivate.id
                    ? { ...v, esta_activo: false, fecha_fin: new Date().toISOString().split('T')[0] }
                    : v
                )
            );
            setToDeactivate(null);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al dar de baja al vocero.');
            setToDeactivate(null);
        } finally {
            setDeactivating(false);
        }
    };

    const fErr = (name) => editErrors[name]?.[0] ?? editErrors[name] ?? '';

    // ─────────────────────────────────────────────────────────────
    //  RENDER PRINCIPAL
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="list-page">

            {/* ── Topbar ─────────────────────────────────────── */}
            <header className="list-topbar">
                <button className="list-topbar__back" onClick={() => navigate('/dashboard')}>
                    ← Dashboard
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Voceros</span>
                </div>
            </header>

            <div className="list-container">

                {/* ── Encabezado ─────────────────────────────── */}
                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Voceros Comunales</h1>
                        <p className="list-heading__subtitle">
                            {pagination ? (
                                <span className="list-heading__count">
                                    🎙 {pagination.total} voceros registrados
                                </span>
                            ) : 'Cargando...'}
                        </p>
                    </div>
                    {canWrite && (
                        <Link to="/voceros/crear" className="list-btn list-btn--primary">
                            + Registrar Vocero
                        </Link>
                    )}
                </div>

                {/* ── Buscador ───────────────────────────────── */}
                <div className="list-toolbar">
                    <div className="list-search">
                        <span className="list-search__icon">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Buscar por nombre, apellido o cédula..."
                            className="list-search__input"
                        />
                        {search && (
                            <button
                                className="list-search__clear"
                                onClick={() => handleSearch('')}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Error ──────────────────────────────────── */}
                {error && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span> {error}
                        <button
                            onClick={() => fetchVoceros()}
                            className="list-alert__retry"
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                {/* ── Tabla ──────────────────────────────────── */}
                <div className="list-table-wrap">
                    {loading ? (
                        <div className="list-loading">
                            <span className="list-loading__spinner" />
                            <p>Cargando voceros...</p>
                        </div>
                    ) : voceros.length === 0 ? (
                        <div className="list-empty">
                            <span>🎙</span>
                            <p>
                                {search
                                    ? `Sin resultados para "${search}"`
                                    : 'No hay voceros registrados.'}
                            </p>
                        </div>
                    ) : (
                        <table className="list-table">
                            <thead>
                                <tr>
                                    <th>Vocero</th>
                                    <th>Comité</th>
                                    <th>Sede</th>
                                    <th>Unidad Comunal</th>
                                    <th>Elección</th>
                                    <th>Estatus</th>
                                    {(canWrite || isAdmin) && (
                                        <th className="th-actions">Acciones</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {voceros.map((v) => (
                                    <tr key={v.id} className={!v.esta_activo ? 'tr-inactive' : ''}>

                                        {/* Nombre del habitante */}
                                        <td>
                                            <div className="vocero-name">
                                                <span className="vocero-name__main">
                                                    {v.habitante?.nombre_vocero ?? '—'}
                                                </span>
                                                {v.habitante?.cedula && (
                                                    <span className="vocero-name__cedula">
                                                        {v.habitante.cedula}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Comité */}
                                        <td>
                                            {v.comite
                                                ? <span className="badge badge--purple">
                                                    {v.comite.nombre}
                                                    </span>
                                                : <span className="td-none">—</span>
                                            }
                                        </td>

                                        {/* Sede */}
                                        <td className="td-meta">
                                            {v.sede?.nombre ?? '—'}
                                        </td>

                                        {/* Unidad comunal */}
                                        <td className="td-meta td-unidad">
                                            {v.unidad_comunal}
                                        </td>

                                        {/* Fecha de elección */}
                                        <td className="td-center td-fecha">
                                            {v.fecha_eleccion
                                                ? new Date(v.fecha_eleccion + 'T00:00:00')
                                                    .toLocaleDateString('es-VE')
                                                : '—'}
                                        </td>

                                        {/* Estatus activo/inactivo */}
                                        <td className="td-center">
                                            {v.esta_activo
                                                ? <span className="badge badge--green">Activo</span>
                                                : <span className="badge badge--gray">Inactivo</span>
                                            }
                                        </td>

                                        {/* Acciones */}
                                        {(canWrite || isAdmin) && (
                                            <td>
                                                <div className="td-actions">
                                                    {canWrite && (
                                                        <button
                                                            className="action-btn action-btn--edit"
                                                            onClick={() => openEditModal(v)}
                                                            title="Editar vocero"
                                                        >
                                                            ✏
                                                        </button>
                                                    )}
                                                    {/* Solo mostrar "Dar de baja" si está activo */}
                                                    {isAdmin && v.esta_activo && (
                                                        <button
                                                            className="action-btn action-btn--delete"
                                                            onClick={() => setToDeactivate(v)}
                                                            title="Dar de baja"
                                                        >
                                                            🗑
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Paginación ─────────────────────────────── */}
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
                            Página {page} de {pagination.last_page}
                            {' '}({pagination.total} registros)
                        </span>
                    </div>
                )}
            </div>

            {/* ════════════════════════════════════════════════════
                MODAL DE EDICIÓN
                ════════════════════════════════════════════════════ */}
            {editModal && (
                <div
                    className="edit-modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !saving) closeEditModal();
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="edit-modal-title"
                >
                    <div className="edit-modal">

                        <header className="edit-modal__header">
                            <h2 id="edit-modal-title" className="edit-modal__title">
                                Editar Vocero
                            </h2>
                            <button
                                className="edit-modal__close"
                                onClick={closeEditModal}
                                disabled={saving}
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </header>

                        <div className="edit-modal__body">

                            {/* Habitante */}
                            <div className={`vocero-field ${fErr('habitante_id') ? 'vocero-field--error' : ''}`}>
                                <label className="vocero-label">
                                    Habitante <span className="req">*</span>
                                </label>
                                <select
                                    name="habitante_id"
                                    value={editForm.habitante_id}
                                    onChange={handleEditChange}
                                    className="vocero-select"
                                    disabled={saving}
                                >
                                    <option value="">— Selecciona —</option>
                                    {formData?.habitantes?.map(h => (
                                        <option key={h.id} value={h.id}>{h.label}</option>
                                    ))}
                                </select>
                                {fErr('habitante_id') && (
                                    <p className="vocero-error">{fErr('habitante_id')}</p>
                                )}
                            </div>

                            {/* Unidad comunal */}
                            <div className={`vocero-field ${fErr('unidad_comunal') ? 'vocero-field--error' : ''}`}>
                                <label className="vocero-label">
                                    Unidad Comunal <span className="req">*</span>
                                </label>
                                <input
                                    name="unidad_comunal"
                                    type="text"
                                    value={editForm.unidad_comunal}
                                    onChange={handleEditChange}
                                    className="vocero-input"
                                    maxLength={150}
                                    disabled={saving}
                                />
                                {fErr('unidad_comunal') && (
                                    <p className="vocero-error">{fErr('unidad_comunal')}</p>
                                )}
                            </div>

                            {/* Sede y Comité en fila */}
                            <div className="vocero-row">
                                <div className={`vocero-field ${fErr('sede_id') ? 'vocero-field--error' : ''}`}>
                                    <label className="vocero-label">
                                        Sede <span className="req">*</span>
                                    </label>
                                    <select
                                        name="sede_id"
                                        value={editForm.sede_id}
                                        onChange={handleEditChange}
                                        className="vocero-select"
                                        disabled={saving}
                                    >
                                        <option value="">— Seleccionar —</option>
                                        {formData?.sedes?.map(s => (
                                            <option key={s.id} value={s.id}>{s.label}</option>
                                        ))}
                                    </select>
                                    {fErr('sede_id') && (
                                        <p className="vocero-error">{fErr('sede_id')}</p>
                                    )}
                                </div>

                                <div className="vocero-field">
                                    <label className="vocero-label">
                                        Comité
                                        <span className="vocero-optional">(opcional)</span>
                                    </label>
                                    <select
                                        name="comite_id"
                                        value={editForm.comite_id}
                                        onChange={handleEditChange}
                                        className="vocero-select"
                                        disabled={saving}
                                    >
                                        <option value="">— Sin comité —</option>
                                        {formData?.comites?.map(c => (
                                            <option key={c.id} value={c.id}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Fechas en fila */}
                            <div className="vocero-row">
                                <div className={`vocero-field ${fErr('fecha_eleccion') ? 'vocero-field--error' : ''}`}>
                                    <label className="vocero-label">
                                        Fecha de elección <span className="req">*</span>
                                    </label>
                                    <input
                                        name="fecha_eleccion"
                                        type="date"
                                        value={editForm.fecha_eleccion}
                                        onChange={handleEditChange}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="vocero-input"
                                        disabled={saving}
                                    />
                                    {fErr('fecha_eleccion') && (
                                        <p className="vocero-error">{fErr('fecha_eleccion')}</p>
                                    )}
                                </div>

                                <div className="vocero-field">
                                    <label className="vocero-label">
                                        Fin de mandato
                                        <span className="vocero-optional">(opcional)</span>
                                    </label>
                                    <input
                                        name="fecha_fin"
                                        type="date"
                                        value={editForm.fecha_fin}
                                        onChange={handleEditChange}
                                        min={editForm.fecha_eleccion || undefined}
                                        className="vocero-input"
                                        disabled={saving}
                                    />
                                </div>
                            </div>

                            {/* Toggle esta_activo */}
                            <div className="vocero-field">
                                <label className="vocero-toggle">
                                    <input
                                        name="esta_activo"
                                        type="checkbox"
                                        checked={editForm.esta_activo}
                                        onChange={handleEditChange}
                                        className="vocero-toggle__input"
                                        disabled={saving}
                                    />
                                    <span className="vocero-toggle__track" aria-hidden="true" />
                                    <span className="vocero-toggle__label">
                                        {editForm.esta_activo
                                            ? '✅ Cargo activo'
                                            : '⏸ Cargo inactivo'}
                                    </span>
                                </label>
                            </div>

                        </div>

                        {/* Footer del modal */}
                        <footer className="edit-modal__footer">
                            <button
                                type="button"
                                className="list-btn vocero-btn-cancel"
                                onClick={closeEditModal}
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="list-btn list-btn--primary"
                                onClick={saveEdit}
                                disabled={saving}
                                style={{ minWidth: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            >
                                {saving ? (
                                    <><span className="list-loading__spinner"
                                        style={{ width: '14px', height: '14px', borderWidth: '2px' }}
                                    /> Guardando...</>
                                ) : '✓ Guardar cambios'}
                            </button>
                        </footer>
                    </div>
                </div>
            )}

            {/* ── Modal de confirmación de baja ──────────────── */}
            <ConfirmModal
                isOpen={!!toDeactivate}
                title="Dar de baja vocero"
                message={`¿Dar de baja a ${toDeactivate?.habitante?.nombre_vocero}?`}
                detail="El vocero quedará como inactivo. Su historial de mandato se conserva. El contador del Dashboard se actualizará automáticamente."
                confirmLabel="Sí, dar de baja"
                variant="danger"
                onConfirm={confirmDeactivate}
                onCancel={() => setToDeactivate(null)}
                isLoading={deactivating}
            />
        </div>
    );
}

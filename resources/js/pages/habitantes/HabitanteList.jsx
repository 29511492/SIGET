/**
 * resources/js/pages/habitantes/HabitanteList.jsx
 *
 * Imports relativos desde pages/habitantes/:
 *   apiClient    → '../../services/axios'          (2 niveles)
 *   useAuth      → '../../hooks/useAuth'            (2 niveles)
 *   ConfirmModal → '../../components/ui/ConfirmModal'
 *   CSS          → './HabitanteList.css'
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate }  from 'react-router-dom';
import { useAuth }      from '../../hooks/useAuth';
import apiClient        from '../../services/axios';
import ConfirmModal     from '../../components/ui/ConfirmModal';
import './HabitanteList.css';

const SEXO_LABEL = {
    masculino: 'Masculino',
    femenino:  'Femenino',
    otro:      'Otro',
};

const NIVEL_OPTIONS = [
    { value: 'ninguno',       label: 'Ninguno'      },
    { value: 'primaria',      label: 'Primaria'      },
    { value: 'bachillerato',  label: 'Bachillerato'  },
    { value: 'tecnico',       label: 'Técnico'       },
    { value: 'universitario', label: 'Universitario' },
    { value: 'postgrado',     label: 'Postgrado'     },
];

export default function HabitanteList() {
    const navigate              = useNavigate();
    const { isAdmin, canWrite } = useAuth();

    // ── Estado de listado ─────────────────────────────────────────
    const [habitantes,  setHabitantes]  = useState([]);
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
    const [toDelete,    setToDelete]    = useState(null);
    const [deleting,    setDeleting]    = useState(false);

    // ── Carga ─────────────────────────────────────────────────────
    const fetchHabitantes = useCallback(async (q = search, p = page) => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/v1/habitantes', {
                params: { search: q || undefined, page: p, per_page: 10 },
            });
            setHabitantes(res.data.data);
            setPagination(res.data.meta);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al cargar habitantes.');
        } finally {
            setLoading(false);
        }
    }, [search, page]);

    useEffect(() => { fetchHabitantes(); }, [page]);

    const handleSearch = (value) => {
        setSearch(value);
        setPage(1);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => fetchHabitantes(value, 1), 400);
    };

    // ── Edición inline ────────────────────────────────────────────
    const startEdit = (h) => {
        setEditingId(h.id);
        setEditForm({
            nombres:            h.nombres,
            apellidos:          h.apellidos,
            cedula:             h.cedula ?? '',
            nivel_educativo:    h.nivel_educativo,
            es_discapacitado:   h.es_discapacitado,
            tipo_discapacidad:  h.tipo_discapacidad ?? '',
            enfermedad_cronica: h.enfermedad_cronica ?? '',
        });
        setEditErrors({});
    };

    const cancelEdit = () => { setEditingId(null); setEditForm({}); setEditErrors({}); };

    const handleEditChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;
        setEditForm(prev => ({
            ...prev,
            [name]: newValue,
            // Limpiar tipo_discapacidad al desmarcar
            ...(name === 'es_discapacitado' && !checked ? { tipo_discapacidad: '' } : {}),
        }));
        if (editErrors[name]) setEditErrors(prev => ({ ...prev, [name]: '' }));
    };

    const saveEdit = async (habitanteId) => {
        setSaving(true);
        try {
            const payload = {
                ...editForm,
                cedula:             editForm.cedula.trim()             || null,
                tipo_discapacidad:  editForm.tipo_discapacidad.trim()  || null,
                enfermedad_cronica: editForm.enfermedad_cronica.trim() || null,
            };
            const res = await apiClient.put(`/v1/habitantes/${habitanteId}`, payload);
            setHabitantes(prev =>
                prev.map(h => h.id === habitanteId ? res.data.data : h)
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

    // ── Eliminación ───────────────────────────────────────────────
    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await apiClient.delete(`/v1/habitantes/${toDelete.id}`);
            setHabitantes(prev => prev.filter(h => h.id !== toDelete.id));
            setPagination(prev => prev ? { ...prev, total: prev.total - 1 } : prev);
            setToDelete(null);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al dar de baja al habitante.');
            setToDelete(null);
        } finally {
            setDeleting(false);
        }
    };

    const fieldErr = (name) => editErrors[name]?.[0] ?? editErrors[name] ?? '';

    return (
        <div className="list-page">

            <header className="list-topbar">
                <button className="list-topbar__back" onClick={() => navigate('/dashboard')}>
                    ← Dashboard
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Habitantes</span>
                </div>
            </header>

            <div className="list-container">

                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Padrón de Habitantes</h1>
                        <p className="list-heading__subtitle">
                            {pagination ? `${pagination.total} habitantes registrados` : 'Cargando...'}
                        </p>
                    </div>
                    {canWrite && (
                        <button
                            className="list-btn list-btn--primary"
                            onClick={() => navigate('/habitantes/crear')}
                        >
                            + Registrar Habitante
                        </button>
                    )}
                </div>

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
                            <button className="list-search__clear" onClick={() => handleSearch('')}>✕</button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span> {error}
                        <button onClick={() => fetchHabitantes()} className="list-alert__retry">Reintentar</button>
                    </div>
                )}

                <div className="list-table-wrap">
                    {loading ? (
                        <div className="list-loading">
                            <span className="list-loading__spinner" />
                            <p>Cargando padrón...</p>
                        </div>
                    ) : habitantes.length === 0 ? (
                        <div className="list-empty">
                            <span>👥</span>
                            <p>{search ? `Sin resultados para "${search}"` : 'No hay habitantes registrados.'}</p>
                        </div>
                    ) : (
                        <table className="list-table">
                            <thead>
                                <tr>
                                    <th>Cédula</th>
                                    <th>Nombres</th>
                                    <th>Apellidos</th>
                                    <th>Edad</th>
                                    <th>Sexo</th>
                                    <th>Nivel</th>
                                    <th>Salud</th>
                                    <th>Familia</th>
                                    {(canWrite || isAdmin) && <th className="th-actions">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {habitantes.map(h =>
                                    editingId === h.id ? (
                                        /* ── Fila en edición ───────────────────────── */
                                        <tr key={h.id} className="tr-editing">
                                            <td>
                                                <input
                                                    name="cedula"
                                                    value={editForm.cedula}
                                                    onChange={handleEditChange}
                                                    className={`edit-input ${fieldErr('cedula') ? 'edit-input--error' : ''}`}
                                                    placeholder="V-12345678"
                                                    maxLength={15}
                                                />
                                                {fieldErr('cedula') && <span className="edit-error">{fieldErr('cedula')}</span>}
                                            </td>
                                            <td>
                                                <input
                                                    name="nombres"
                                                    value={editForm.nombres}
                                                    onChange={handleEditChange}
                                                    className={`edit-input ${fieldErr('nombres') ? 'edit-input--error' : ''}`}
                                                    maxLength={100}
                                                />
                                                {fieldErr('nombres') && <span className="edit-error">{fieldErr('nombres')}</span>}
                                            </td>
                                            <td>
                                                <input
                                                    name="apellidos"
                                                    value={editForm.apellidos}
                                                    onChange={handleEditChange}
                                                    className={`edit-input ${fieldErr('apellidos') ? 'edit-input--error' : ''}`}
                                                    maxLength={100}
                                                />
                                                {fieldErr('apellidos') && <span className="edit-error">{fieldErr('apellidos')}</span>}
                                            </td>
                                            <td className="td-center">{h.edad ?? '—'}</td>
                                            <td className="td-center">{SEXO_LABEL[h.sexo]}</td>
                                            <td>
                                                <select
                                                    name="nivel_educativo"
                                                    value={editForm.nivel_educativo}
                                                    onChange={handleEditChange}
                                                    className="edit-select"
                                                >
                                                    {NIVEL_OPTIONS.map(o => (
                                                        <option key={o.value} value={o.value}>{o.label}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <div className="edit-health">
                                                    <label className="edit-checkbox">
                                                        <input
                                                            type="checkbox"
                                                            name="es_discapacitado"
                                                            checked={editForm.es_discapacitado}
                                                            onChange={handleEditChange}
                                                        />
                                                        <span>Disc.</span>
                                                    </label>
                                                    {editForm.es_discapacitado && (
                                                        <input
                                                            name="tipo_discapacidad"
                                                            value={editForm.tipo_discapacidad}
                                                            onChange={handleEditChange}
                                                            placeholder="Tipo..."
                                                            className={`edit-input edit-input--sm ${fieldErr('tipo_discapacidad') ? 'edit-input--error' : ''}`}
                                                            maxLength={100}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="td-meta">{h.familia?.codigo_vivienda ?? '—'}</td>
                                            <td>
                                                <div className="td-actions">
                                                    <button
                                                        className="action-btn action-btn--save"
                                                        onClick={() => saveEdit(h.id)}
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
                                        /* ── Fila en lectura ───────────────────────── */
                                        <tr key={h.id}>
                                            <td className="td-code">{h.cedula ?? '—'}</td>
                                            <td>{h.nombres}</td>
                                            <td>{h.apellidos}</td>
                                            <td className="td-center">
                                                {h.edad !== null ? `${h.edad} a.` : '—'}
                                            </td>
                                            <td className="td-center">
                                                <span className="badge badge--blue">
                                                    {SEXO_LABEL[h.sexo] ?? h.sexo}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="badge badge--purple">
                                                    {NIVEL_OPTIONS.find(n => n.value === h.nivel_educativo)?.label ?? h.nivel_educativo}
                                                </span>
                                            </td>
                                            <td className="td-health">
                                                {h.es_discapacitado && (
                                                    <span className="health-tag health-tag--disc" title={h.tipo_discapacidad ?? ''}>
                                                        ♿ {h.tipo_discapacidad ? h.tipo_discapacidad.substring(0, 10) : 'Disc.'}
                                                    </span>
                                                )}
                                                {h.enfermedad_cronica && (
                                                    <span className="health-tag health-tag--enf" title={h.enfermedad_cronica}>
                                                        🏥 {h.enfermedad_cronica.substring(0, 10)}
                                                    </span>
                                                )}
                                                {!h.es_discapacitado && !h.enfermedad_cronica && (
                                                    <span className="td-none">—</span>
                                                )}
                                            </td>
                                            <td className="td-meta">
                                                {h.familia?.codigo_vivienda ?? '—'}
                                            </td>
                                            {(canWrite || isAdmin) && (
                                                <td>
                                                    <div className="td-actions">
                                                        {canWrite && (
                                                            <button
                                                                className="action-btn action-btn--edit"
                                                                onClick={() => startEdit(h)}
                                                                title="Editar habitante"
                                                            >
                                                                ✏
                                                            </button>
                                                        )}
                                                        {isAdmin && (
                                                            <button
                                                                className="action-btn action-btn--delete"
                                                                onClick={() => setToDelete(h)}
                                                                title="Dar de baja"
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

                {/* ── Paginación ──────────────────────────────────── */}
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

            {/* ── Modal de baja ─────────────────────────────────── */}
            <ConfirmModal
                isOpen={!!toDelete}
                title="Dar de baja habitante"
                message={`¿Dar de baja a ${toDelete?.nombres} ${toDelete?.apellidos}?`}
                detail="El registro se conserva en la base de datos (soft delete). El contador del Dashboard se actualizará automáticamente."
                confirmLabel="Sí, dar de baja"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setToDelete(null)}
                isLoading={deleting}
            />
        </div>
    );
}

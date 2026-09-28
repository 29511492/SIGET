/**
 * CuentaPagoList.jsx — SIGET
 * Ruta física: resources/js/pages/pagos/CuentaPagoList.jsx
 *
 * Registrar en app.jsx:
 *   import CuentaPagoList from './pages/pagos/CuentaPagoList';
 *   <Route path="/cuentas-pago" element={
 *       <ProtectedRoute><CuentaPagoList /></ProtectedRoute>
 *   } />
 *
 * Permite al admin/operador gestionar las cuentas de pago (servicio +
 * datos bancarios) que el ciudadano ve al pagar desde el Portal
 * Ciudadano. Solo admin puede crear/editar/eliminar (mismo patrón
 * de OrganizacionList: edición inline en la tabla, sin Form aparte
 * para editar — CuentaPagoForm.jsx se usa solo para CREAR).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../../hooks/useAuth';
import apiClient       from '../../services/axios';
import './CuentaPagoList.css';

export default function CuentaPagoList() {
    const navigate              = useNavigate();
    const { isAdmin, canWrite } = useAuth();

    // ── Estado — inicializado con [] para evitar crash en .length/.map ──
    const [cuentas,    setCuentas]    = useState([]);
    const [pagination, setPagination] = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState(null);
    const [search,     setSearch]     = useState('');
    const [filtroActiva, setFiltroActiva] = useState('');
    const [page,       setPage]       = useState(1);
    const searchTimer = useRef(null);

    // ── Estado de edición inline (solo admin/operador) ─────────
    const [editingId,  setEditingId]  = useState(null);
    const [editForm,   setEditForm]   = useState({});
    const [editErrors, setEditErrors] = useState({});
    const [saving,     setSaving]     = useState(false);

    // ── Estado de eliminación ──────────────────────────────────
    const [deleting,   setDeleting]   = useState(false);

    // ── Carga de datos ─────────────────────────────────────────
    const fetchCuentas = useCallback(async (q = search, activa = filtroActiva, p = page) => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/v1/cuentas-pago', {
                params: {
                    search:   q      || undefined,
                    activa:   activa || undefined,
                    page:     p,
                    per_page: 15,
                },
            });
            setCuentas(Array.isArray(res.data?.data) ? res.data.data : []);
            setPagination(res.data?.meta ?? null);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al cargar las cuentas de pago.');
            setCuentas([]);
        } finally {
            setLoading(false);
        }
    }, [search, filtroActiva, page]);

    useEffect(() => { fetchCuentas(); }, [page]);

    // Debounce de búsqueda
    const handleSearch = (value) => {
        setSearch(value);
        setPage(1);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => fetchCuentas(value, filtroActiva, 1), 400);
    };

    const handleFiltroActiva = (value) => {
        setFiltroActiva(value);
        setPage(1);
        fetchCuentas(search, value, 1);
    };

    // ── Edición inline ─────────────────────────────────────────
    const startEdit = (cuenta) => {
        setEditingId(cuenta.id);
        setEditForm({
            nombre_servicio: cuenta.nombre_servicio ?? '',
            banco:           cuenta.banco           ?? '',
            telefono:        cuenta.telefono         ?? '',
            cedula_rif:      cuenta.cedula_rif        ?? '',
            titular:         cuenta.titular           ?? '',
            descripcion:     cuenta.descripcion       ?? '',
            activa:          cuenta.activa            ?? true,
        });
        setEditErrors({});
    };

    const cancelEdit = () => { setEditingId(null); setEditForm({}); setEditErrors({}); };

    const handleEditChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEditForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (editErrors[name]) setEditErrors(prev => ({ ...prev, [name]: '' }));
    };

    const saveEdit = async (cuentaId) => {
        setSaving(true);
        try {
            const res = await apiClient.put(`/v1/cuentas-pago/${cuentaId}`, editForm);
            const updated = res.data?.data ?? { id: cuentaId, ...editForm };
            setCuentas(prev => prev.map(c => c.id === cuentaId ? { ...c, ...updated } : c));
            setEditingId(null);
        } catch (err) {
            if (err.response?.status === 422) {
                setEditErrors(err.response.data?.errors ?? {});
            }
        } finally {
            setSaving(false);
        }
    };

    // ── Eliminación ────────────────────────────────────────────
    const handleDelete = async (cuenta) => {
        if (!window.confirm(`¿Eliminar la cuenta "${cuenta.nombre_servicio}"? El registro se conserva en la base de datos.`)) return;
        setDeleting(true);
        try {
            await apiClient.delete(`/v1/cuentas-pago/${cuenta.id}`);
            setCuentas(prev => prev.filter(c => c.id !== cuenta.id));
            setPagination(prev => prev ? { ...prev, total: (prev.total ?? 1) - 1 } : prev);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al eliminar la cuenta de pago.');
        } finally {
            setDeleting(false);
        }
    };

    const fieldErr = (name) => editErrors[name]?.[0] ?? '';

    // ── Paginación ─────────────────────────────────────────────
    const buildPageNumbers = () => {
        if (!pagination?.last_page) return [];
        return Array.from({ length: pagination.last_page }, (_, i) => i + 1)
            .filter(p => p === 1 || p === pagination.last_page || (p >= page - 1 && p <= page + 1))
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
                <button className="list-topbar__back" onClick={() => navigate('/dashboard')}>
                    ← Dashboard
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Cuentas de Pago</span>
                </div>
            </header>

            <div className="list-container">

                {/* ── Encabezado ────────────────────────────── */}
                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Cuentas de Pago</h1>
                        <p className="list-heading__subtitle">
                            {pagination ? (
                                <span className="list-heading__count">
                                    🏦 {pagination.total ?? cuentas.length} cuenta{(pagination.total ?? cuentas.length) !== 1 ? 's' : ''} registrada{(pagination.total ?? cuentas.length) !== 1 ? 's' : ''}
                                </span>
                            ) : 'Cargando...'}
                        </p>
                    </div>
                    {/* Botón de crear: admin y operador */}
                    {canWrite && (
                        <button
                            className="list-btn list-btn--primary"
                            onClick={() => navigate('/cuentas-pago/crear')}
                            type="button"
                        >
                            + Nueva Cuenta de Pago
                        </button>
                    )}
                </div>

                {/* ── Toolbar ───────────────────────────────── */}
                <div className="list-toolbar cp-toolbar">
                    <div className="list-search">
                        <span className="list-search__icon">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                            placeholder="Buscar por servicio o banco..."
                            className="list-search__input"
                        />
                        {search && (
                            <button
                                className="list-search__clear"
                                onClick={() => handleSearch('')}
                                type="button"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <select
                        value={filtroActiva}
                        onChange={e => handleFiltroActiva(e.target.value)}
                        className="cp-filter__select"
                        aria-label="Filtrar por estatus"
                    >
                        <option value="">Todas las cuentas</option>
                        <option value="true">Activas</option>
                        <option value="false">Inactivas</option>
                    </select>
                </div>

                {/* ── Error global ──────────────────────────── */}
                {error && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span> {error}
                        <button onClick={() => fetchCuentas()} className="list-alert__retry" type="button">
                            Reintentar
                        </button>
                    </div>
                )}

                {/* ── Tabla ─────────────────────────────────── */}
                <div className="list-table-wrap">
                    {loading ? (
                        <div className="list-loading">
                            <span className="list-loading__spinner" />
                            <p>Cargando cuentas de pago...</p>
                        </div>
                    ) : (cuentas?.length ?? 0) === 0 ? (
                        <div className="list-empty">
                            <span>💳</span>
                            <p>{search || filtroActiva
                                ? 'Sin resultados para los filtros aplicados.'
                                : 'No hay cuentas de pago registradas.'
                            }</p>
                        </div>
                    ) : (
                        <table className="list-table">
                            <thead>
                                <tr>
                                    <th>Servicio</th>
                                    <th>Banco</th>
                                    <th>Teléfono</th>
                                    <th>Cédula/RIF</th>
                                    <th>Titular</th>
                                    <th className="td-center">Estatus</th>
                                    {canWrite && <th className="th-actions">Gestión</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {(cuentas ?? []).map(cuenta =>
                                    editingId === cuenta.id ? (

                                        /* ── Fila edición — admin/operador ────── */
                                        <tr key={cuenta.id} className="tr-editing">
                                            <td>
                                                <input
                                                    name="nombre_servicio"
                                                    value={editForm.nombre_servicio}
                                                    onChange={handleEditChange}
                                                    className={`edit-input ${fieldErr('nombre_servicio') ? 'edit-input--error' : ''}`}
                                                    maxLength={100}
                                                />
                                                {fieldErr('nombre_servicio') && (
                                                    <span className="edit-error">{fieldErr('nombre_servicio')}</span>
                                                )}
                                            </td>
                                            <td>
                                                <input
                                                    name="banco"
                                                    value={editForm.banco}
                                                    onChange={handleEditChange}
                                                    className={`edit-input ${fieldErr('banco') ? 'edit-input--error' : ''}`}
                                                    maxLength={100}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    name="telefono"
                                                    value={editForm.telefono}
                                                    onChange={handleEditChange}
                                                    className="edit-input"
                                                    placeholder="0412-1234567"
                                                    maxLength={20}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    name="cedula_rif"
                                                    value={editForm.cedula_rif}
                                                    onChange={handleEditChange}
                                                    className="edit-input"
                                                    placeholder="V-12345678"
                                                    maxLength={20}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    name="titular"
                                                    value={editForm.titular}
                                                    onChange={handleEditChange}
                                                    className="edit-input"
                                                    maxLength={150}
                                                />
                                            </td>
                                            <td>
                                                <label className="edit-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        name="activa"
                                                        checked={editForm.activa}
                                                        onChange={handleEditChange}
                                                    />
                                                    <span>{editForm.activa ? 'Activa' : 'Inactiva'}</span>
                                                </label>
                                            </td>
                                            <td>
                                                <div className="td-actions">
                                                    <button
                                                        className="action-btn action-btn--save"
                                                        onClick={() => saveEdit(cuenta.id)}
                                                        disabled={saving}
                                                        type="button"
                                                    >
                                                        {saving ? '⏳' : '✓ Guardar'}
                                                    </button>
                                                    <button
                                                        className="action-btn action-btn--cancel"
                                                        onClick={cancelEdit}
                                                        disabled={saving}
                                                        type="button"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                    ) : (

                                        /* ── Fila lectura — todos los roles ───── */
                                        <tr key={cuenta.id} className={!cuenta.activa ? 'tr-inactive' : ''}>
                                            <td className="td-code">{cuenta.nombre_servicio || '—'}</td>
                                            <td className="td-meta">{cuenta.banco || '—'}</td>
                                            <td className="td-meta">{cuenta.telefono || '—'}</td>
                                            <td className="td-meta">{cuenta.cedula_rif || '—'}</td>
                                            <td className="td-meta">{cuenta.titular || '—'}</td>

                                            <td className="td-center">
                                                <span className={`badge ${cuenta.activa ? 'badge--green' : 'badge--gray'}`}>
                                                    {cuenta.activa ? 'Activa' : 'Inactiva'}
                                                </span>
                                            </td>

                                            {/* Columna de gestión — admin y operador */}
                                            {canWrite && (
                                                <td>
                                                    <div className="td-actions">
                                                        <button
                                                            className="action-btn action-btn--edit"
                                                            onClick={() => startEdit(cuenta)}
                                                            title="Editar cuenta de pago"
                                                            type="button"
                                                        >
                                                            ✏
                                                        </button>
                                                        {isAdmin && (
                                                            <button
                                                                className="action-btn action-btn--delete"
                                                                onClick={() => handleDelete(cuenta)}
                                                                title="Eliminar"
                                                                disabled={deleting}
                                                                type="button"
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

                {/* ── Paginación ────────────────────────────── */}
                {pagination && (pagination.last_page ?? 0) > 1 && (
                    <div className="list-pagination">
                        <button
                            className="page-btn"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                            type="button"
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
                                        type="button"
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
                            type="button"
                        >
                            Siguiente →
                        </button>

                        <span className="page-info">
                            Página {page} de {pagination.last_page} ({pagination.total ?? cuentas.length} registros)
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * OrganizacionList.jsx — SIGET
 * Ruta física: resources/js/pages/organizaciones/OrganizacionList.jsx
 *
 * Registrar en app.jsx:
 *   import OrganizacionList from './pages/organizaciones/OrganizacionList';
 *   <Route path="/organizaciones" element={
 *       <ProtectedRoute><OrganizacionList /></ProtectedRoute>
 *   } />
 *
 * Añadir en NAV_ITEMS de DashboardPage.jsx (dentro del componente):
 *   { label: 'Organizaciones', icon: '🏛️', href: '/organizaciones', permiso: null }
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../../hooks/useAuth';
import apiClient       from '../../services/axios';
import './OrganizacionList.css';

// ── Mapeo visual de tipos de servicio ─────────────────────────
const TIPO_BADGE = {
    agua:         { label: 'Agua',         cls: 'badge--blue',   icon: '💧' },
    electricidad: { label: 'Electricidad', cls: 'badge--amber',  icon: '⚡' },
    gas:          { label: 'Gas',          cls: 'badge--purple', icon: '🔥' },
    salud:        { label: 'Salud',        cls: 'badge--red',    icon: '🏥' },
    educacion:    { label: 'Educación',    cls: 'badge--teal',   icon: '📚' },
    seguridad:    { label: 'Seguridad',    cls: 'badge--navy',   icon: '🛡️' },
    transporte:   { label: 'Transporte',   cls: 'badge--green',  icon: '🚌' },
    otro:         { label: 'Otro',         cls: 'badge--gray',   icon: '🏛️' },
};

const TIPO_OPTIONS = [
    { value: '',             label: 'Todos los servicios'  },
    { value: 'agua',         label: '💧 Agua'              },
    { value: 'electricidad', label: '⚡ Electricidad'      },
    { value: 'gas',          label: '🔥 Gas'               },
    { value: 'salud',        label: '🏥 Salud'             },
    { value: 'educacion',    label: '📚 Educación'         },
    { value: 'seguridad',    label: '🛡️ Seguridad'        },
    { value: 'transporte',   label: '🚌 Transporte'        },
    { value: 'otro',         label: '🏛️ Otro'             },
];

// ── Detecta tipo de contacto y construye el href ──────────────
function buildContactoHref(contacto) {
    if (!contacto) return null;
    if (contacto.includes('@')) return `mailto:${contacto}`;
    if (contacto.startsWith('http')) return contacto;
    // Teléfono/WhatsApp: limpiar y construir enlace wa.me
    const digits = contacto.replace(/\D/g, '');
    return `https://wa.me/${digits}`;
}

function contactoLabel(contacto) {
    if (!contacto) return null;
    if (contacto.includes('@')) return '✉️ Email';
    return '💬 WhatsApp';
}

export default function OrganizacionList() {
    const navigate              = useNavigate();
    const { isAdmin, canWrite } = useAuth();

    // ── Estado — inicializado con [] para evitar crash en .length/.map ──
    const [orgs,       setOrgs]       = useState([]);
    const [pagination, setPagination] = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState(null);
    const [search,     setSearch]     = useState('');
    const [filtroTipo, setFiltroTipo] = useState('');
    const [page,       setPage]       = useState(1);
    const searchTimer = useRef(null);

    // ── Estado de edición inline (solo admin) ─────────────────
    const [editingId,  setEditingId]  = useState(null);
    const [editForm,   setEditForm]   = useState({});
    const [editErrors, setEditErrors] = useState({});
    const [saving,     setSaving]     = useState(false);

    // ── Estado de eliminación ──────────────────────────────────
    const [toDelete,   setToDelete]   = useState(null);
    const [deleting,   setDeleting]   = useState(false);

    // ── Carga de datos ─────────────────────────────────────────
    const fetchOrgs = useCallback(async (q = search, tipo = filtroTipo, p = page) => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/v1/organizaciones', {
                params: {
                    search:        q    || undefined,
                    tipo_servicio: tipo || undefined,
                    page:          p,
                    per_page:      15,
                },
            });
            // Guardia: garantiza que setOrgs siempre recibe un array
            setOrgs(Array.isArray(res.data?.data) ? res.data.data : []);
            setPagination(res.data?.meta ?? null);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al cargar organizaciones.');
            setOrgs([]);      // reset a array vacío en caso de error
        } finally {
            setLoading(false);
        }
    }, [search, filtroTipo, page]);

    useEffect(() => { fetchOrgs(); }, [page]);

    // Debounce de búsqueda
    const handleSearch = (value) => {
        setSearch(value);
        setPage(1);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => fetchOrgs(value, filtroTipo, 1), 400);
    };

    const handleFiltroTipo = (value) => {
        setFiltroTipo(value);
        setPage(1);
        fetchOrgs(search, value, 1);
    };

    // ── Edición inline ─────────────────────────────────────────
    const startEdit = (org) => {
        setEditingId(org.id);
        setEditForm({
            nombre:        org.nombre        ?? '',
            tipo_servicio: org.tipo_servicio ?? 'otro',
            contacto:      org.contacto      ?? '',
            descripcion:   org.descripcion   ?? '',
            estatus:       org.estatus       ?? true,
        });
        setEditErrors({});
    };

    const cancelEdit = () => { setEditingId(null); setEditForm({}); setEditErrors({}); };

    const handleEditChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEditForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (editErrors[name]) setEditErrors(prev => ({ ...prev, [name]: '' }));
    };

    const saveEdit = async (orgId) => {
        setSaving(true);
        try {
            const res = await apiClient.put(`/v1/organizaciones/${orgId}`, editForm);
            const updated = res.data?.data ?? { id: orgId, ...editForm };
            setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, ...updated } : o));
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
    const handleDelete = async (org) => {
        if (!window.confirm(`¿Dar de baja "${org.nombre}"? El registro se conserva en la base de datos.`)) return;
        setDeleting(true);
        try {
            await apiClient.delete(`/v1/organizaciones/${org.id}`);
            setOrgs(prev => prev.filter(o => o.id !== org.id));
            setPagination(prev => prev ? { ...prev, total: (prev.total ?? 1) - 1 } : prev);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al dar de baja la organización.');
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
                    <span>SIGET</span><span>›</span><span>Organizaciones</span>
                </div>
            </header>

            <div className="list-container">

                {/* ── Encabezado ────────────────────────────── */}
                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Directorio de Servicios Públicos</h1>
                        <p className="list-heading__subtitle">
                            {pagination
                                ? `${pagination.total ?? orgs.length} organizaciones registradas`
                                : 'Cargando...'}
                        </p>
                    </div>
                    {/* Botón de crear: solo admin */}
                    {isAdmin && (
                        <button
                            className="list-btn list-btn--primary"
                            onClick={() => navigate('/organizaciones/crear')}
                            type="button"
                        >
                            + Nueva Organización
                        </button>
                    )}
                </div>

                {/* ── Toolbar ───────────────────────────────── */}
                <div className="list-toolbar org-toolbar">
                    <div className="list-search">
                        <span className="list-search__icon">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                            placeholder="Buscar por nombre o descripción..."
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
                        value={filtroTipo}
                        onChange={e => handleFiltroTipo(e.target.value)}
                        className="org-filter__select"
                        aria-label="Filtrar por tipo de servicio"
                    >
                        {TIPO_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>

                {/* ── Error global ──────────────────────────── */}
                {error && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span> {error}
                        <button onClick={() => fetchOrgs()} className="list-alert__retry" type="button">
                            Reintentar
                        </button>
                    </div>
                )}

                {/* ── Tabla ─────────────────────────────────── */}
                <div className="list-table-wrap">
                    {loading ? (
                        <div className="list-loading">
                            <span className="list-loading__spinner" />
                            <p>Cargando directorio...</p>
                        </div>
                    ) : (orgs?.length ?? 0) === 0 ? (
                        <div className="list-empty">
                            <span>🏛️</span>
                            <p>{search || filtroTipo
                                ? 'Sin resultados para los filtros aplicados.'
                                : 'No hay organizaciones registradas.'
                            }</p>
                        </div>
                    ) : (
                        <table className="list-table">
                            <thead>
                                <tr>
                                    <th>Organización</th>
                                    <th>Tipo de Servicio</th>
                                    <th>Contacto</th>
                                    <th>Descripción</th>
                                    <th className="td-center">Estatus</th>
                                    {isAdmin && <th className="th-actions">Gestión</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {(orgs ?? []).map(org =>
                                    editingId === org.id ? (

                                        /* ── Fila edición — solo admin ────────── */
                                        <tr key={org.id} className="tr-editing">
                                            <td>
                                                <input
                                                    name="nombre"
                                                    value={editForm.nombre}
                                                    onChange={handleEditChange}
                                                    className={`edit-input ${fieldErr('nombre') ? 'edit-input--error' : ''}`}
                                                    maxLength={150}
                                                />
                                                {fieldErr('nombre') && (
                                                    <span className="edit-error">{fieldErr('nombre')}</span>
                                                )}
                                            </td>
                                            <td>
                                                <select
                                                    name="tipo_servicio"
                                                    value={editForm.tipo_servicio}
                                                    onChange={handleEditChange}
                                                    className="edit-select"
                                                >
                                                    {TIPO_OPTIONS.filter(o => o.value).map(o => (
                                                        <option key={o.value} value={o.value}>{o.label}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    name="contacto"
                                                    value={editForm.contacto}
                                                    onChange={handleEditChange}
                                                    className="edit-input"
                                                    placeholder="+58 412…"
                                                    maxLength={100}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    name="descripcion"
                                                    value={editForm.descripcion}
                                                    onChange={handleEditChange}
                                                    className="edit-input"
                                                    maxLength={200}
                                                />
                                            </td>
                                            <td>
                                                <label className="edit-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        name="estatus"
                                                        checked={editForm.estatus}
                                                        onChange={handleEditChange}
                                                    />
                                                    <span>{editForm.estatus ? 'Activo' : 'Inactivo'}</span>
                                                </label>
                                            </td>
                                            <td>
                                                <div className="td-actions">
                                                    <button
                                                        className="action-btn action-btn--save"
                                                        onClick={() => saveEdit(org.id)}
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
                                        <tr key={org.id}>
                                            <td className="td-code">{org.nombre || '—'}</td>

                                            {/* Badge de tipo de servicio */}
                                            <td>
                                                {(() => {
                                                    const t = TIPO_BADGE[org.tipo_servicio] ?? TIPO_BADGE.otro;
                                                    return (
                                                        <span className={`badge ${t.cls}`}>
                                                            {t.icon} {t.label}
                                                        </span>
                                                    );
                                                })()}
                                            </td>

                                            {/* Botón contacto — visible para TODOS los roles */}
                                            <td>
                                                {org.contacto ? (
                                                    <a
                                                        href={buildContactoHref(org.contacto)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="org-contacto-btn"
                                                        title={org.contacto}
                                                    >
                                                        {contactoLabel(org.contacto)}
                                                    </a>
                                                ) : (
                                                    <span className="td-meta">—</span>
                                                )}
                                            </td>

                                            <td className="org-descripcion td-meta">
                                                {org.descripcion || '—'}
                                            </td>

                                            <td className="td-center">
                                                <span className={`badge ${org.estatus ? 'badge--green' : 'badge--gray'}`}>
                                                    {org.estatus_label || (org.estatus ? 'Activo' : 'Inactivo')}
                                                </span>
                                            </td>

                                            {/* Columna de gestión — SOLO ADMIN */}
                                            {isAdmin && (
                                                <td>
                                                    <div className="td-actions">
                                                        <button
                                                            className="action-btn action-btn--edit"
                                                            onClick={() => startEdit(org)}
                                                            title="Editar organización"
                                                            type="button"
                                                        >
                                                            ✏
                                                        </button>
                                                        <button
                                                            className="action-btn action-btn--delete"
                                                            onClick={() => handleDelete(org)}
                                                            title="Dar de baja"
                                                            disabled={deleting}
                                                            type="button"
                                                        >
                                                            🗑
                                                        </button>
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
                            Página {page} de {pagination.last_page} ({pagination.total ?? orgs.length} registros)
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

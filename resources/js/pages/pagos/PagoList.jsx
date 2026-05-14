
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../../hooks/useAuth';
import apiClient       from '../../services/axios';
import './PagoQr.css';

// ── Mapeo visual de estados ────────────────────────────────────
const ESTADO_BADGE = {
    pendiente:  { label: 'Pendiente',  cls: 'badge--amber' },
    verificado: { label: 'Verificado', cls: 'badge--green' },
    rechazado:  { label: 'Rechazado',  cls: 'badge--red'   },
};

const ESTADO_OPTIONS = [
    { value: 'pendiente',  label: '⏳ Pendientes'  },
    { value: 'verificado', label: '✅ Verificados' },
    { value: 'rechazado',  label: '❌ Rechazados'  },
    { value: '',           label: 'Todos'           },
];

export default function PagoList() {
    const navigate         = useNavigate();
    const { isAdmin, user } = useAuth();

    // ── Estado listado ─────────────────────────────────────────
    const [pagos,       setPagos]       = useState([]);
    const [pagination,  setPagination]  = useState(null);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState(null);
    const [filtroEstado,setFiltroEstado]= useState('pendiente'); // por defecto pendientes
    const [search,      setSearch]      = useState('');
    const [page,        setPage]        = useState(1);
    const searchTimer = useRef(null);

    // ── Estado modal ───────────────────────────────────────────
    const [modalPago,     setModalPago]     = useState(null);
    const [motivoRechazo, setMotivoRechazo] = useState('');
    const [validando,     setValidando]     = useState(false);
    const [modalError,    setModalError]    = useState('');

    // ── Toast ──────────────────────────────────────────────────
    const [toast, setToast] = useState(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // ── Carga ──────────────────────────────────────────────────
    const fetchPagos = useCallback(async (estado = filtroEstado, q = search, p = page) => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/v1/pagos', {
                params: {
                    estado:  estado || undefined,
                    search:  q      || undefined,
                    page:    p,
                    per_page: 20,
                },
            });
            setPagos(Array.isArray(res.data?.data) ? res.data.data : []);
            setPagination(res.data?.meta ?? null);
        } catch (err) {
            setError(err.response?.data?.message ?? 'Error al cargar pagos.');
            setPagos([]);
        } finally {
            setLoading(false);
        }
    }, [filtroEstado, search, page]);

    useEffect(() => { fetchPagos(); }, [page]);

    const handleFiltroEstado = (v) => { setFiltroEstado(v); setPage(1); fetchPagos(v, search, 1); };
    const handleSearch = (v) => {
        setSearch(v); setPage(1);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => fetchPagos(filtroEstado, v, 1), 400);
    };

    // ── Modal: abrir / cerrar ──────────────────────────────────
    const abrirModal  = (pago) => { setModalPago(pago); setMotivoRechazo(''); setModalError(''); };
    const cerrarModal = () => { setModalPago(null); setMotivoRechazo(''); setModalError(''); };

    // ── Validar pago ───────────────────────────────────────────
    const handleValidar = async (nuevoEstado) => {
        if (nuevoEstado === 'rechazado' && !motivoRechazo.trim()) {
            setModalError('El motivo del rechazo es obligatorio.');
            return;
        }
        setValidando(true);
        setModalError('');
        try {
            const res = await apiClient.patch(`/v1/pagos/${modalPago.id}/validar`, {
                estado:         nuevoEstado,
                motivo_rechazo: nuevoEstado === 'rechazado' ? motivoRechazo : null,
            });
            const actualizado = res.data?.data;
            setPagos(prev => prev.map(p => p.id === modalPago.id ? { ...p, ...actualizado } : p));
            cerrarModal();
            showToast(res.data?.message ?? 'Pago actualizado.');
        } catch (err) {
            setModalError(err.response?.data?.message ?? 'Error al validar el pago.');
        } finally {
            setValidando(false);
        }
    };

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

            {toast && (
                <div className={`pago-toast pago-toast--${toast.type}`} role="alert">
                    {toast.type === 'success' ? '✓' : '⚠'} {toast.msg}
                </div>
            )}

            <header className="list-topbar">
                <button className="list-topbar__back" onClick={() => navigate('/dashboard')}>
                    ← Dashboard
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Validación de Pagos</span>
                </div>
            </header>

            <div className="list-container">

                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Panel de Pagos QR</h1>
                        <p className="list-heading__subtitle">
                            {pagination
                                ? `${pagination.total ?? pagos.length} pagos encontrados`
                                : 'Cargando...'}
                        </p>
                    </div>
                </div>

                {/* ── Toolbar ───────────────────────────────── */}
                <div className="list-toolbar pago-toolbar">
                    <div className="pago-estado-tabs">
                        {ESTADO_OPTIONS.map(o => (
                            <button
                                key={o.value}
                                type="button"
                                className={`pago-tab ${filtroEstado === o.value ? 'pago-tab--active' : ''}`}
                                onClick={() => handleFiltroEstado(o.value)}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                    <div className="list-search">
                        <span className="list-search__icon">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                            placeholder="Buscar por referencia..."
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
                        <button onClick={() => fetchPagos()} className="list-alert__retry">Reintentar</button>
                    </div>
                )}

                <div className="list-table-wrap">
                    {loading ? (
                        <div className="list-loading">
                            <span className="list-loading__spinner" />
                            <p>Cargando pagos...</p>
                        </div>
                    ) : (pagos?.length ?? 0) === 0 ? (
                        <div className="list-empty">
                            <span>💳</span>
                            <p>No hay pagos {filtroEstado ? ESTADO_BADGE[filtroEstado]?.label.toLowerCase() + 's' : ''} en este momento.</p>
                        </div>
                    ) : (
                        <table className="list-table">
                            <thead>
                                <tr>
                                    <th>Referencia</th>
                                    <th>Habitante</th>
                                    <th>Servicio</th>
                                    <th className="td-center">Monto</th>
                                    <th>Fecha Pago</th>
                                    <th className="td-center">Estado</th>
                                    <th className="th-actions">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(pagos ?? []).map(pago => {
                                    const badge = ESTADO_BADGE[pago.estado] ?? { label: pago.estado, cls: 'badge--gray' };
                                    return (
                                        <tr
                                            key={pago.id}
                                            className={pago.estado === 'pendiente' ? 'pago-row--pendiente' : ''}
                                        >
                                            <td className="td-code">{pago.referencia_bancaria}</td>
                                            <td>
                                                <span>{pago.habitante_nombre || '—'}</span>
                                                {pago.familia_responsable && (
                                                    <span className="td-meta__sub">
                                                        Familia: {pago.familia_responsable}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="td-meta">{pago.organizacion_nombre || '—'}</td>
                                            <td className="td-center pago-monto">
                                                Bs. {Number(pago.monto).toFixed(2)}
                                            </td>
                                            <td className="td-meta">{pago.fecha_pago || '—'}</td>
                                            <td className="td-center">
                                                <span className={`badge ${badge.cls}`}>{badge.label}</span>
                                            </td>
                                            <td>
                                                <div className="td-actions">
                                                    <button
                                                        type="button"
                                                        className="action-btn action-btn--edit"
                                                        onClick={() => abrirModal(pago)}
                                                        title="Ver comprobante y validar"
                                                    >
                                                        👁 Revisar
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

                {/* Paginación */}
                {pagination && (pagination.last_page ?? 0) > 1 && (
                    <div className="list-pagination">
                        <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>← Anterior</button>
                        <div className="page-numbers">
                            {buildPageNumbers().map((p, idx) =>
                                p === '...'
                                    ? <span key={`e${idx}`} className="page-ellipsis">…</span>
                                    : <button key={p} className={`page-btn page-btn--num ${p === page ? 'page-btn--active' : ''}`} onClick={() => setPage(p)} disabled={loading}>{p}</button>
                            )}
                        </div>
                        <button className="page-btn" onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))} disabled={page === pagination.last_page || loading}>Siguiente →</button>
                        <span className="page-info">Página {page} de {pagination.last_page}</span>
                    </div>
                )}
            </div>

            {/* ════════════════════════════════════════════════
             *  MODAL DE REVISIÓN Y VALIDACIÓN
             * ════════════════════════════════════════════════ */}
            {modalPago && (
                <div className="pago-modal-overlay" onClick={cerrarModal} role="dialog" aria-modal="true">
                    <div className="pago-modal" onClick={e => e.stopPropagation()}>

                        <div className="pago-modal__header">
                            <div>
                                <h2 className="pago-modal__title">Revisión de Pago</h2>
                                <p className="pago-modal__ref">Ref: {modalPago.referencia_bancaria}</p>
                            </div>
                            <button className="pago-modal__close" onClick={cerrarModal} type="button">✕</button>
                        </div>

                        <div className="pago-modal__body">
                            {/* Datos del pago */}
                            <div className="pago-modal__datos">
                                <div className="pago-dato">
                                    <span className="pago-dato__label">Habitante</span>
                                    <span className="pago-dato__value">{modalPago.habitante_nombre || '—'}</span>
                                </div>
                                <div className="pago-dato">
                                    <span className="pago-dato__label">Familia</span>
                                    <span className="pago-dato__value">{modalPago.familia_responsable || '—'}</span>
                                </div>
                                <div className="pago-dato">
                                    <span className="pago-dato__label">Servicio</span>
                                    <span className="pago-dato__value">{modalPago.organizacion_nombre || '—'}</span>
                                </div>
                                <div className="pago-dato">
                                    <span className="pago-dato__label">Monto</span>
                                    <span className="pago-dato__value pago-dato__value--monto">
                                        Bs. {Number(modalPago.monto).toFixed(2)}
                                    </span>
                                </div>
                                <div className="pago-dato">
                                    <span className="pago-dato__label">Concepto</span>
                                    <span className="pago-dato__value">{modalPago.concepto_pago}</span>
                                </div>
                                <div className="pago-dato">
                                    <span className="pago-dato__label">Fecha pago</span>
                                    <span className="pago-dato__value">{modalPago.fecha_pago}</span>
                                </div>
                                <div className="pago-dato">
                                    <span className="pago-dato__label">Estado actual</span>
                                    <span className={`badge ${ESTADO_BADGE[modalPago.estado]?.cls}`}>
                                        {ESTADO_BADGE[modalPago.estado]?.label}
                                    </span>
                                </div>
                                {modalPago.motivo_rechazo && (
                                    <div className="pago-dato pago-dato--full">
                                        <span className="pago-dato__label">Motivo rechazo</span>
                                        <span className="pago-dato__value pago-dato__value--error">
                                            {modalPago.motivo_rechazo}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Imagen del comprobante */}
                            <div className="pago-modal__comprobante">
                                {modalPago.comprobante_url ? (
                                    <a href={modalPago.comprobante_url} target="_blank" rel="noopener noreferrer">
                                        <img
                                            src={modalPago.comprobante_url}
                                            alt="Comprobante de pago"
                                            className="pago-comprobante-img"
                                        />
                                        <span className="pago-comprobante-hint">Clic para ampliar</span>
                                    </a>
                                ) : (
                                    <div className="pago-comprobante-vacio">
                                        <span>📄</span>
                                        <p>Sin comprobante adjunto</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sección de validación — solo si está pendiente */}
                        {modalPago.estado === 'pendiente' && (
                            <div className="pago-modal__validacion">
                                <div className="pago-campo">
                                    <label className="pago-campo__label" htmlFor="motivo_rechazo">
                                        Motivo de rechazo
                                        <span className="pago-campo__hint"> (obligatorio si rechazas)</span>
                                    </label>
                                    <input
                                        id="motivo_rechazo"
                                        type="text"
                                        value={motivoRechazo}
                                        onChange={e => { setMotivoRechazo(e.target.value); setModalError(''); }}
                                        placeholder="Ej. La referencia no coincide con los registros bancarios..."
                                        className="pago-campo__input"
                                        maxLength={255}
                                    />
                                    {modalError && (
                                        <span className="pago-campo__error">⚠ {modalError}</span>
                                    )}
                                </div>

                                <div className="pago-modal__botones">
                                    <button
                                        type="button"
                                        className="pago-btn pago-btn--rechazar"
                                        onClick={() => handleValidar('rechazado')}
                                        disabled={validando}
                                    >
                                        {validando ? '⏳' : '❌'} Rechazar
                                    </button>
                                    <button
                                        type="button"
                                        className="pago-btn pago-btn--verificar"
                                        onClick={() => handleValidar('verificado')}
                                        disabled={validando}
                                    >
                                        {validando ? '⏳' : '✅'} Verificar pago
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Si ya fue procesado, mostrar quién lo hizo */}
                        {modalPago.estado !== 'pendiente' && (
                            <div className="pago-modal__procesado">
                                <span>
                                    {modalPago.estado === 'verificado' ? '✅' : '❌'} Procesado por{' '}
                                    <strong>{modalPago.verificador_nombre || 'operador'}</strong>
                                    {modalPago.fecha_verificacion ? ` el ${modalPago.fecha_verificacion}` : ''}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

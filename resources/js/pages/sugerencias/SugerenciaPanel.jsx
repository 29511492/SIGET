/**
 * resources/js/pages/sugerencias/SugerenciaPanel.jsx
 *
 * Panel de gestión de sugerencias para admin, operador y vocero.
 * Admin y operador pueden revisar y responder.
 * Vocero solo puede leer.
 *
 * Consume:
 *   GET   /api/v1/sugerencias                    → listado con filtros
 *   PATCH /api/v1/sugerencias/{id}/revisar        → marcar revisada + responder
 *   DELETE /api/v1/sugerencias/{id}               → eliminar (solo admin)
 *
 * FIX: Al actualizar el estado local tras revisar, se fusionan solo los
 *      campos que devuelve el backend (respuesta, revisada, revisada_en,
 *      revisor) sin sobreescribir 'autor', que el Resource devuelve con
 *      whenLoaded y puede llegar vacío si no se cargó en esa petición.
 *
 * CAMBIOS (oct-2026, unificación de la pantalla de inicio del vocero):
 *  · /mi-comunidad se retiró: el botón de volver va siempre a /dashboard.
 *  · El formulario de envío (SugerenciaWidget) vivía en MiComunidad. Para
 *    que el vocero siga pudiendo enviar sugerencias (POST /sugerencias está
 *    permitido a todos los roles), se muestra aquí, arriba del listado,
 *    solo cuando el usuario es vocero.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate }                       from 'react-router-dom';
import { useAuth }                           from '../../hooks/useAuth';
import apiClient                             from '../../services/axios';
import SugerenciaWidget                      from '../../components/sugerencias/SugerenciaWidget';
import './SugerenciaPanel.css';

const CATEGORIAS = [
    { value: '',           label: 'Todas las categorías' },
    { value: 'consulta',   label: '❓ Consulta'   },
    { value: 'mejora',     label: '💡 Mejora'     },
    { value: 'queja',      label: '⚠️ Queja'      },
    { value: 'emergencia', label: '🚨 Emergencia'  },
];

const CAT_CONFIG = {
    consulta:   { icon: '❓', color: 'blue'  },
    mejora:     { icon: '💡', color: 'teal'  },
    queja:      { icon: '⚠️', color: 'amber' },
    emergencia: { icon: '🚨', color: 'red'   },
};

export default function SugerenciaPanel() {
    const { user, isAdmin, canWrite } = useAuth();
    const navigate    = useNavigate();
    const adminBool   = Boolean(isAdmin  ?? (user?.rol === 'admin'));
    const writeBool   = Boolean(canWrite ?? (user?.rol === 'admin' || user?.rol === 'operador'));

    // ── Estado listado ─────────────────────────────────────────
    const [sugerencias,  setSugerencias]  = useState([]);
    const [isLoading,    setIsLoading]    = useState(true);
    const [error,        setError]        = useState('');
    const [pagination,   setPagination]   = useState({ current_page: 1, last_page: 1, total: 0, pendientes: 0 });

    // ── Filtros ────────────────────────────────────────────────
    const [filtroRevisada,  setFiltroRevisada]  = useState('');
    const [filtroCategoria, setFiltroCategoria] = useState('');
    const [filtroPrioridad, setFiltroPrioridad] = useState('');

    // ── Estado revisión ────────────────────────────────────────
    const [revisorId,    setRevisorId]    = useState(null);
    const [respuesta,    setRespuesta]    = useState('');
    const [isRevisando,  setIsRevisando]  = useState(false);
    const [confirmDel,   setConfirmDel]   = useState(null);
    const [isDeleting,   setIsDeleting]   = useState(null);

    // ── Carga de datos ─────────────────────────────────────────
    const cargar = useCallback((page = 1) => {
        setIsLoading(true);
        setError('');

        const params = new URLSearchParams({ page });
        if (filtroRevisada  !== '') params.append('revisada',  filtroRevisada);
        if (filtroCategoria !== '') params.append('categoria', filtroCategoria);
        if (filtroPrioridad !== '') params.append('prioridad', filtroPrioridad);

        apiClient.get(`/v1/sugerencias?${params}`)
            .then(({ data }) => {
                setSugerencias(data.data);
                setPagination(data.meta);
            })
            .catch(() => setError('No se pudieron cargar las sugerencias.'))
            .finally(() => setIsLoading(false));
    }, [filtroRevisada, filtroCategoria, filtroPrioridad]);

    useEffect(() => { cargar(1); }, [cargar]);

    // ── Revisar ────────────────────────────────────────────────
    const handleRevisar = async (id) => {
        setIsRevisando(true);
        try {
            const { data } = await apiClient.patch(
                `/v1/sugerencias/${id}/revisar`,
                { respuesta: respuesta.trim() || null }
            );

            // FIX: Fusión quirúrgica — solo actualizamos los campos que
            // cambian al revisar. No sobreescribimos 'autor' porque el
            // Resource lo devuelve con whenLoaded y puede llegar undefined
            // si la relación no estaba cargada en la respuesta del PATCH.
            setSugerencias(prev =>
                prev.map(s => {
                    if (s.id !== id) return s;
                    return {
                        ...s,                          // preserva autor y demás campos locales
                        revisada:    data.data.revisada,
                        revisada_en: data.data.revisada_en,
                        respuesta:   data.data.respuesta,
                        revisor:     data.data.revisor ?? s.revisor,
                        prioridad:   data.data.prioridad ?? s.prioridad,
                    };
                })
            );

            setRevisorId(null);
            setRespuesta('');
            setPagination(prev => ({
                ...prev,
                pendientes: Math.max(0, prev.pendientes - 1),
            }));
        } catch {
            setError('No se pudo marcar como revisada.');
        } finally {
            setIsRevisando(false);
        }
    };

    // ── Eliminar ───────────────────────────────────────────────
    const handleEliminar = async (id) => {
        setIsDeleting(id);
        setConfirmDel(null);
        try {
            await apiClient.delete(`/v1/sugerencias/${id}`);
            setSugerencias(prev => prev.filter(s => s.id !== id));
            setPagination(prev => ({ ...prev, total: prev.total - 1 }));
        } catch {
            setError('No se pudo eliminar la sugerencia.');
        } finally {
            setIsDeleting(null);
        }
    };

    // ── Render ─────────────────────────────────────────────────
    return (
        <div className="list-page">

            <div className="list-topbar">
                <button
                    className="list-topbar__back"
                    onClick={() => navigate('/dashboard')}
                >
                    ← Dashboard
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span>
                    <span>›</span>
                    <span>Sugerencias</span>
                </div>
            </div>

            <div className="list-container">

                {/* Encabezado */}
                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Sugerencias Comunales</h1>
                        <p className="list-heading__subtitle">
                            {pagination.total} sugerencia{pagination.total !== 1 ? 's' : ''} ·{' '}
                            <strong style={{ color: pagination.pendientes > 0 ? '#854d0e' : '#166534' }}>
                                {pagination.pendientes} pendiente{pagination.pendientes !== 1 ? 's' : ''}
                            </strong>
                        </p>
                    </div>
                </div>

                {/* Formulario de envío — solo vocero (vivía en MiComunidad) */}
                {user?.rol === 'vocero' && <SugerenciaWidget />}

                {/* Filtros */}
                <div className="list-toolbar sp-toolbar">
                    <select
                        className="sp-filtro"
                        value={filtroRevisada}
                        onChange={e => setFiltroRevisada(e.target.value)}
                    >
                        <option value="">Todos los estados</option>
                        <option value="false">Pendientes</option>
                        <option value="true">Revisadas</option>
                    </select>

                    <select
                        className="sp-filtro"
                        value={filtroCategoria}
                        onChange={e => setFiltroCategoria(e.target.value)}
                    >
                        {CATEGORIAS.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>

                    <select
                        className="sp-filtro"
                        value={filtroPrioridad}
                        onChange={e => setFiltroPrioridad(e.target.value)}
                    >
                        <option value="">Todas las prioridades</option>
                        <option value="alta">Alta</option>
                        <option value="media">Media</option>
                        <option value="baja">Baja</option>
                    </select>
                </div>

                {/* Error */}
                {error && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span>
                        <span>{error}</span>
                        <button className="list-alert__retry" onClick={() => cargar(1)}>
                            Reintentar
                        </button>
                    </div>
                )}

                {/* Lista de sugerencias */}
                {isLoading ? (
                    <div className="list-loading">
                        <div className="list-loading__spinner" />
                        <span>Cargando sugerencias...</span>
                    </div>
                ) : sugerencias.length === 0 ? (
                    <div className="list-empty">
                        <span>💬</span>
                        <p>No hay sugerencias que mostrar.</p>
                    </div>
                ) : (
                    <div className="sp-lista">
                        {sugerencias.map(sug => {
                            const cat = CAT_CONFIG[sug.categoria] ?? { icon: '❓', color: 'blue' };
                            const enRevision = revisorId === sug.id;

                            return (
                                <article key={sug.id} className={`sp-item ${sug.revisada ? 'sp-item--revisada' : ''}`}>

                                    {/* Cabecera del ítem */}
                                    <div className="sp-item__header">
                                        <div className="sp-item__badges">
                                            <span className={`sw-cat-badge sw-cat-badge--${cat.color}`}>
                                                {cat.icon} {sug.categoria}
                                            </span>
                                            <span className={`sw-prio-badge sw-prio-badge--${sug.prioridad}`}>
                                                {sug.prioridad}
                                            </span>
                                            <span className={`sw-estado ${
                                                sug.revisada ? 'sw-estado--revisada' : 'sw-estado--pendiente'
                                            }`}>
                                                {sug.revisada ? '✓ Revisada' : '⏳ Pendiente'}
                                            </span>
                                        </div>
                                        <div className="sp-item__meta">
                                            <span className="sp-item__autor">
                                                {sug.autor?.name ?? 'Usuario eliminado'}
                                            </span>
                                            <span className="sp-item__fecha">{sug.fecha_legible}</span>
                                        </div>
                                    </div>

                                    {/* Mensaje */}
                                    <p className="sp-item__mensaje">{sug.mensaje}</p>

                                    {/* Respuesta existente */}
                                    {sug.respuesta && (
                                        <div className="sp-item__respuesta">
                                            <p className="sp-item__respuesta-label">
                                                💬 Respuesta del Consejo:
                                            </p>
                                            <p className="sp-item__respuesta-texto">{sug.respuesta}</p>
                                        </div>
                                    )}

                                    {/* Panel de revisión inline */}
                                    {enRevision && writeBool && (
                                        <div className="sp-revision-panel">
                                            <textarea
                                                className="sp-revision-panel__textarea"
                                                placeholder="Escribe una respuesta opcional para el ciudadano..."
                                                value={respuesta}
                                                onChange={e => setRespuesta(e.target.value)}
                                                rows={3}
                                                maxLength={500}
                                                disabled={isRevisando}
                                            />
                                            <div className="sp-revision-panel__actions">
                                                <button
                                                    className="action-btn action-btn--cancel"
                                                    onClick={() => { setRevisorId(null); setRespuesta(''); }}
                                                    disabled={isRevisando}
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    className="action-btn action-btn--save"
                                                    onClick={() => handleRevisar(sug.id)}
                                                    disabled={isRevisando}
                                                >
                                                    {isRevisando ? '⏳ Guardando...' : '✓ Marcar como revisada'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Acciones */}
                                    {(writeBool || adminBool) && (
                                        <div className="sp-item__actions">
                                            {writeBool && !sug.revisada && !enRevision && (
                                                <button
                                                    className="action-btn action-btn--edit"
                                                    onClick={() => { setRevisorId(sug.id); setRespuesta(''); }}
                                                >
                                                    ✓ Revisar
                                                </button>
                                            )}

                                            {adminBool && (
                                                confirmDel === sug.id ? (
                                                    <>
                                                        <button
                                                            className="action-btn action-btn--save"
                                                            onClick={() => handleEliminar(sug.id)}
                                                            disabled={isDeleting === sug.id}
                                                        >
                                                            {isDeleting === sug.id ? '⏳' : '✓ Confirmar'}
                                                        </button>
                                                        <button
                                                            className="action-btn action-btn--cancel"
                                                            onClick={() => setConfirmDel(null)}
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        className="action-btn action-btn--delete"
                                                        onClick={() => setConfirmDel(sug.id)}
                                                        title="Eliminar sugerencia"
                                                    >
                                                        🗑
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    )}

                                </article>
                            );
                        })}
                    </div>
                )}

                {/* Paginación */}
                {pagination.last_page > 1 && (
                    <div className="list-pagination">
                        <button
                            className="page-btn"
                            onClick={() => cargar(pagination.current_page - 1)}
                            disabled={pagination.current_page === 1}
                        >
                            ← Anterior
                        </button>
                        <div className="page-numbers">
                            {Array.from({ length: pagination.last_page }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p}
                                    className={`page-btn page-btn--num ${p === pagination.current_page ? 'page-btn--active' : ''}`}
                                    onClick={() => cargar(p)}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                        <button
                            className="page-btn"
                            onClick={() => cargar(pagination.current_page + 1)}
                            disabled={pagination.current_page === pagination.last_page}
                        >
                            Siguiente →
                        </button>
                        <span className="page-info">{pagination.total} sugerencias en total</span>
                    </div>
                )}

            </div>
        </div>
    );
}

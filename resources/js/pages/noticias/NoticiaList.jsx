/**
 * resources/js/pages/noticias/NoticiaList.jsx
 *
 * Vista de gestión de noticias para admin y operador.
 * Muestra todas las noticias (publicadas y borradores).
 * Permite crear, publicar/despublicar y eliminar (solo admin).
 *
 * Consume:
 *   GET   /api/v1/noticias/todas          → listado completo con borradores
 *   PATCH /api/v1/noticias/{id}/publicar  → toggle publicado
 *   DELETE /api/v1/noticias/{id}          → soft delete (solo admin)
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate }                from 'react-router-dom';
import { useAuth }                          from '../../hooks/useAuth';
import apiClient                            from '../../services/axios';
import './NoticiaList.css';

export default function NoticiaList() {
    const { user, isAdmin } = useAuth();
    const navigate          = useNavigate();
    const adminBool         = Boolean(isAdmin ?? (user?.rol === 'admin'));

    // ── Estado ─────────────────────────────────────────────────
    const [noticias,   setNoticias]   = useState([]);
    const [isLoading,  setIsLoading]  = useState(true);
    const [error,      setError]      = useState('');
    const [buscar,     setBuscar]     = useState('');
    const [filtro,     setFiltro]     = useState('');
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [toggling,   setToggling]   = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [confirmId,  setConfirmId]  = useState(null);

    // ── Carga de datos ─────────────────────────────────────────
    const cargarNoticias = useCallback((page = 1) => {
        setIsLoading(true);
        setError('');

        const params = new URLSearchParams({ page });
        if (buscar)       params.append('buscar',    buscar);
        if (filtro !== '') params.append('publicado', filtro);

        apiClient.get(`/v1/noticias/todas?${params}`)
            .then(({ data }) => {
                setNoticias(data.data);
                setPagination(data.meta);
            })
            .catch(() => setError('No se pudieron cargar las noticias.'))
            .finally(() => setIsLoading(false));
    }, [buscar, filtro]);

    useEffect(() => {
        cargarNoticias(1);
    }, [cargarNoticias]);

    // ── Toggle publicado ───────────────────────────────────────
    const handleTogglePublicado = async (id) => {
        setToggling(id);
        try {
            const { data } = await apiClient.patch(`/v1/noticias/${id}/publicar`);
            setNoticias(prev =>
                prev.map(n => n.id === id ? { ...n, ...data.data } : n)
            );
        } catch {
            setError('No se pudo cambiar el estado de la noticia.');
        } finally {
            setToggling(null);
        }
    };

    // ── Eliminar ───────────────────────────────────────────────
    const handleEliminar = async (id) => {
        setDeletingId(id);
        setConfirmId(null);
        try {
            await apiClient.delete(`/v1/noticias/${id}`);
            setNoticias(prev => prev.filter(n => n.id !== id));
            setPagination(prev => ({ ...prev, total: prev.total - 1 }));
        } catch {
            setError('No se pudo eliminar la noticia.');
        } finally {
            setDeletingId(null);
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
                    <span>Noticias</span>
                </div>
            </div>

            <div className="list-container">

                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Noticias Comunales</h1>
                        <p className="list-heading__subtitle">
                            <span className="list-heading__count">
                                📰 {pagination.total} noticia{pagination.total !== 1 ? 's' : ''} en total
                            </span>
                        </p>
                    </div>
                    <Link to="/noticias/nueva" className="list-btn list-btn--primary">
                        + Nueva Noticia
                    </Link>
                </div>

                <div className="list-toolbar noticia-toolbar">
                    <div className="list-search">
                        <span className="list-search__icon">🔍</span>
                        <input
                            type="text"
                            className="list-search__input"
                            placeholder="Buscar por título..."
                            value={buscar}
                            onChange={e => setBuscar(e.target.value)}
                        />
                        {buscar && (
                            <button
                                className="list-search__clear"
                                onClick={() => setBuscar('')}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <select
                        className="noticia-filtro__select"
                        value={filtro}
                        onChange={e => setFiltro(e.target.value)}
                    >
                        <option value="">Todos los estados</option>
                        <option value="true">Publicadas</option>
                        <option value="false">Borradores</option>
                    </select>
                </div>

                {error && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span>
                        <span>{error}</span>
                        <button
                            className="list-alert__retry"
                            onClick={() => cargarNoticias(pagination.current_page)}
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                <div className="list-table-wrap">
                    {isLoading ? (
                        <div className="list-loading">
                            <div className="list-loading__spinner" />
                            <span>Cargando noticias...</span>
                        </div>
                    ) : noticias.length === 0 ? (
                        <div className="list-empty">
                            <span>📰</span>
                            <p>No hay noticias que mostrar.</p>
                        </div>
                    ) : (
                        <table className="list-table">
                            <thead>
                                <tr>
                                    <th>Título</th>
                                    <th>Autor</th>
                                    <th>Estado</th>
                                    <th>Publicado</th>
                                    <th className="th-actions">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {noticias.map(noticia => (
                                    <tr key={noticia.id}>
                                        <td>
                                            <p className="noticia-titulo">{noticia.titulo}</p>
                                            <p className="td-meta">{noticia.extracto}</p>
                                        </td>
                                        <td className="td-meta">
                                            {noticia.autor?.name ?? '—'}
                                        </td>
                                        <td>
                                            <span className={`badge ${
                                                noticia.publicado ? 'badge--green' : 'badge--amber'
                                            }`}>
                                                {noticia.publicado ? 'Publicada' : 'Borrador'}
                                            </span>
                                        </td>
                                        <td className="td-meta">
                                            {noticia.published_at ? noticia.fecha_legible : '—'}
                                        </td>
                                        <td>
                                            <div className="td-actions">
                                                <button
                                                    className={`action-btn ${
                                                        noticia.publicado
                                                            ? 'action-btn--cancel'
                                                            : 'action-btn--edit'
                                                    }`}
                                                    onClick={() => handleTogglePublicado(noticia.id)}
                                                    disabled={toggling === noticia.id}
                                                    title={noticia.publicado ? 'Pasar a borrador' : 'Publicar'}
                                                >
                                                    {toggling === noticia.id
                                                        ? '⏳'
                                                        : noticia.publicado
                                                            ? '📥 Borrador'
                                                            : '📤 Publicar'
                                                    }
                                                </button>

                                                <Link
                                                    to={`/noticias/${noticia.id}/editar`}
                                                    className="action-btn action-btn--edit"
                                                    title="Editar noticia"
                                                >
                                                    ✏️
                                                </Link>

                                                {adminBool && (
                                                    confirmId === noticia.id ? (
                                                        <>
                                                            <button
                                                                className="action-btn action-btn--save"
                                                                onClick={() => handleEliminar(noticia.id)}
                                                                disabled={deletingId === noticia.id}
                                                            >
                                                                {deletingId === noticia.id
                                                                    ? '⏳'
                                                                    : '✓ Confirmar'
                                                                }
                                                            </button>
                                                            <button
                                                                className="action-btn action-btn--cancel"
                                                                onClick={() => setConfirmId(null)}
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            className="action-btn action-btn--delete"
                                                            onClick={() => setConfirmId(noticia.id)}
                                                            title="Eliminar noticia"
                                                        >
                                                            🗑
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {pagination.last_page > 1 && (
                    <div className="list-pagination">
                        <button
                            className="page-btn"
                            onClick={() => cargarNoticias(pagination.current_page - 1)}
                            disabled={pagination.current_page === 1}
                        >
                            ← Anterior
                        </button>
                        <div className="page-numbers">
                            {Array.from({ length: pagination.last_page }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p}
                                    className={`page-btn page-btn--num ${
                                        p === pagination.current_page ? 'page-btn--active' : ''
                                    }`}
                                    onClick={() => cargarNoticias(p)}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                        <button
                            className="page-btn"
                            onClick={() => cargarNoticias(pagination.current_page + 1)}
                            disabled={pagination.current_page === pagination.last_page}
                        >
                            Siguiente →
                        </button>
                        <span className="page-info">{pagination.total} noticias en total</span>
                    </div>
                )}

            </div>
        </div>
    );
}

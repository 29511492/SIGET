import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../services/axios';
import './ComunicadoList.css';

/**
 * ComunicadoList
 * Historial paginado de comunicados con búsqueda y filtro por estado.
 * Ruta: /comunicados
 */
function ComunicadoList() {
    const navigate = useNavigate();

    // ── Estado ─────────────────────────────────────────────────────────────
    const [comunicados,  setComunicados]  = useState([]);
    const [meta,         setMeta]         = useState(null);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState(null);

    // Filtros
    const [buscar,       setBuscar]       = useState('');
    const [estado,       setEstado]       = useState('');
    const [paginaActual, setPaginaActual] = useState(1);

    // Confirmación de eliminación
    const [eliminandoId, setEliminandoId] = useState(null);
    const [confirmId,    setConfirmId]    = useState(null);

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchComunicados = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (buscar) params.append('buscar', buscar);
            if (estado) params.append('estado', estado);
            params.append('page', paginaActual);

            const response = await apiClient.get(`/v1/comunicados?${params}`, {
                headers: { Accept: 'application/json' },
            });

            setComunicados(response.data.data);
            setMeta(response.data.meta);
        } catch (err) {
            setError(err.response?.data?.message ?? 'No se pudo cargar el historial.');
        } finally {
            setLoading(false);
        }
    }, [buscar, estado, paginaActual]);

    useEffect(() => {
        fetchComunicados();
    }, [fetchComunicados]);

    // Resetear página al cambiar filtros
    useEffect(() => {
        setPaginaActual(1);
    }, [buscar, estado]);

    // ── Eliminar (soft delete) ─────────────────────────────────────────────
    const handleEliminar = async (id) => {
        setEliminandoId(id);
        try {
            await apiClient.delete(`/v1/comunicados/${id}`, {
                headers: { Accept: 'application/json' },
            });
            setConfirmId(null);
            fetchComunicados();
        } catch (err) {
            alert(err.response?.data?.message ?? 'No se pudo eliminar el comunicado.');
        } finally {
            setEliminandoId(null);
        }
    };

    // ── Helpers visuales ───────────────────────────────────────────────────
    const badgeEstado = (estado) => {
        const mapa = {
            borrador:  { label: 'Borrador',  clase: 'badge--borrador'  },
            enviado:   { label: 'Enviado',   clase: 'badge--enviado'   },
            archivado: { label: 'Archivado', clase: 'badge--archivado' },
        };
        const cfg = mapa[estado] ?? { label: estado, clase: '' };
        return <span className={`com-list__badge ${cfg.clase}`}>{cfg.label}</span>;
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="com-list__page">

            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="com-list__header">
                <div>
                    <h1 className="com-list__titulo">Historial de Comunicados</h1>
                    <p className="com-list__subtitulo">
                        Registro de cartas y oficios emitidos por el Consejo Comunal
                    </p>
                </div>
                <Link to="/comunicados/nuevo" className="com-list__btn-nuevo">
                    + Nuevo Comunicado
                </Link>
            </div>

            {/* ── Filtros ────────────────────────────────────────────── */}
            <div className="com-list__filtros">
                <input
                    type="text"
                    className="com-list__buscador"
                    placeholder="Buscar por destinatario, asunto u oficio…"
                    value={buscar}
                    onChange={(e) => setBuscar(e.target.value)}
                />
                <select
                    className="com-list__select"
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                >
                    <option value="">Todos los estados</option>
                    <option value="borrador">Borrador</option>
                    <option value="enviado">Enviado</option>
                    <option value="archivado">Archivado</option>
                </select>
                <button
                    className="com-list__btn-refresh"
                    onClick={fetchComunicados}
                    disabled={loading}
                    title="Actualizar"
                >
                    <span className={loading ? 'spin' : ''}>↻</span>
                </button>
            </div>

            {/* ── Error ──────────────────────────────────────────────── */}
            {error && (
                <div className="com-list__alerta com-list__alerta--error">
                    ⚠ {error}
                    <button onClick={fetchComunicados} className="com-list__btn-reintentar">
                        Reintentar
                    </button>
                </div>
            )}

            {/* ── Tabla ──────────────────────────────────────────────── */}
            <div className="com-list__tabla-wrapper">
                <table className="com-list__tabla">
                    <thead>
                        <tr>
                            <th>Nro. Oficio</th>
                            <th>Destinatario</th>
                            <th>Asunto</th>
                            <th>Estado</th>
                            <th>Fecha</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="com-list__loading">
                                    <span className="spin">↻</span> Cargando…
                                </td>
                            </tr>
                        ) : comunicados.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="com-list__vacio">
                                    No se encontraron comunicados
                                    {buscar && ` para "${buscar}"`}
                                    {estado && ` con estado "${estado}"`}.
                                </td>
                            </tr>
                        ) : (
                            comunicados.map((com) => (
                                <tr key={com.id} className="com-list__fila">
                                    <td className="com-list__oficio">
                                        {com.numero_oficio ?? '—'}
                                    </td>
                                    <td>
                                        <div className="com-list__destinatario">
                                            {com.destinatario}
                                        </div>
                                        {com.cargo_destinatario && (
                                            <div className="com-list__cargo">
                                                {com.cargo_destinatario}
                                            </div>
                                        )}
                                    </td>
                                    <td className="com-list__asunto">
                                        {com.asunto}
                                    </td>
                                    <td>{badgeEstado(com.estado)}</td>
                                    <td className="com-list__fecha">
                                        {com.created_at}
                                    </td>
                                    <td>
                                        <div className="com-list__acciones">

                                            {/* Ver detalle */}
                                            <button
                                                className="com-list__btn-accion com-list__btn-accion--ver"
                                                onClick={() => navigate(`/comunicados/${com.id}`)}
                                                title="Ver detalle"
                                            >
                                                👁
                                            </button>

                                            {/* Editar — solo si es borrador */}
                                            {com.estado === 'borrador' && (
                                                <button
                                                    className="com-list__btn-accion com-list__btn-accion--editar"
                                                    onClick={() => navigate(`/comunicados/${com.id}/editar`)}
                                                    title="Editar borrador"
                                                >
                                                    ✏️
                                                </button>
                                            )}

                                            {/* Eliminar con confirmación inline */}
                                            {confirmId === com.id ? (
                                                <div className="com-list__confirm">
                                                    <span>¿Confirmar?</span>
                                                    <button
                                                        className="com-list__btn-accion com-list__btn-accion--danger"
                                                        onClick={() => handleEliminar(com.id)}
                                                        disabled={eliminandoId === com.id}
                                                    >
                                                        {eliminandoId === com.id ? '…' : 'Sí'}
                                                    </button>
                                                    <button
                                                        className="com-list__btn-accion com-list__btn-accion--cancelar"
                                                        onClick={() => setConfirmId(null)}
                                                    >
                                                        No
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    className="com-list__btn-accion com-list__btn-accion--eliminar"
                                                    onClick={() => setConfirmId(com.id)}
                                                    title="Eliminar"
                                                >
                                                    🗑
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Paginación ─────────────────────────────────────────── */}
            {meta && meta.last_page > 1 && (
                <div className="com-list__paginacion">
                    <button
                        className="com-list__btn-pag"
                        onClick={() => setPaginaActual((p) => p - 1)}
                        disabled={paginaActual === 1}
                    >
                        ← Anterior
                    </button>

                    <span className="com-list__pag-info">
                        Página {meta.current_page} de {meta.last_page}
                        &nbsp;·&nbsp;
                        {meta.total} registro{meta.total !== 1 ? 's' : ''}
                    </span>

                    <button
                        className="com-list__btn-pag"
                        onClick={() => setPaginaActual((p) => p + 1)}
                        disabled={paginaActual === meta.last_page}
                    >
                        Siguiente →
                    </button>
                </div>
            )}

        </div>
    );
}

export default ComunicadoList;

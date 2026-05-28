import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/axios';
import './ComunicadoDetail.css';

/**
 * ComunicadoDetail
 * Vista de detalle de un comunicado específico.
 * Permite descargar el PDF y navegar a edición si es borrador.
 * Ruta: /comunicados/:id
 */
function ComunicadoDetail() {
    const { id }     = useParams();
    const navigate   = useNavigate();

    // ── Estado ─────────────────────────────────────────────────────────────
    const [comunicado,     setComunicado]     = useState(null);
    const [loading,        setLoading]        = useState(true);
    const [error,          setError]          = useState(null);
    const [descargandoPdf, setDescargandoPdf] = useState(false);
    const [eliminando,     setEliminando]     = useState(false);
    const [confirmElim,    setConfirmElim]    = useState(false);

    // ── Fetch ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchDetalle = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await apiClient.get(`/v1/comunicados/${id}`, {
                    headers: { Accept: 'application/json' },
                });
                setComunicado(response.data.data);
            } catch (err) {
                if (err.response?.status === 404) {
                    setError('El comunicado no existe o fue eliminado.');
                } else {
                    setError(err.response?.data?.message ?? 'No se pudo cargar el comunicado.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchDetalle();
    }, [id]);

    // ── Descarga PDF ───────────────────────────────────────────────────────
    const handleDescargarPdf = async () => {
        setDescargandoPdf(true);
        try {
            const response = await apiClient.get(`/v1/comunicados/${id}/pdf`, {
                responseType: 'blob',
                headers: { Accept: 'application/pdf' },
            });

            const url = window.URL.createObjectURL(
                new Blob([response.data], { type: 'application/pdf' })
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = `comunicado_${comunicado.numero_oficio}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('No se pudo generar el PDF. Intenta nuevamente.');
        } finally {
            setDescargandoPdf(false);
        }
    };

    // ── Eliminar (soft delete) ─────────────────────────────────────────────
    const handleEliminar = async () => {
        setEliminando(true);
        try {
            await apiClient.delete(`/v1/comunicados/${id}`, {
                headers: { Accept: 'application/json' },
            });
            navigate('/comunicados');
        } catch (err) {
            alert(err.response?.data?.message ?? 'No se pudo eliminar el comunicado.');
            setEliminando(false);
            setConfirmElim(false);
        }
    };

    // ── Badge de estado ────────────────────────────────────────────────────
    const badgeClase = {
        borrador:  'det-badge--borrador',
        enviado:   'det-badge--enviado',
        archivado: 'det-badge--archivado',
    };

    // ── Render: loading ────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="com-det__page">
                <div className="com-det__loading">
                    <span className="spin">↻</span> Cargando comunicado…
                </div>
            </div>
        );
    }

    // ── Render: error ──────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="com-det__page">
                <div className="com-det__error">
                    <p>⚠ {error}</p>
                    <Link to="/comunicados" className="com-det__btn com-det__btn--secundario">
                        ← Volver al historial
                    </Link>
                </div>
            </div>
        );
    }

    // ── Render: detalle ────────────────────────────────────────────────────
    return (
        <div className="com-det__page">

            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="com-det__header">
                <div>
                    <div className="com-det__breadcrumb">
                        <Link to="/comunicados">Historial</Link>
                        <span> / </span>
                        <span>{comunicado.numero_oficio ?? `Comunicado #${id}`}</span>
                    </div>
                    <h1 className="com-det__titulo">
                        {comunicado.numero_oficio ?? 'Comunicado'}
                        <span className={`com-det__badge ${badgeClase[comunicado.estado] ?? ''}`}>
                            {comunicado.estado}
                        </span>
                    </h1>
                </div>

                {/* Acciones del header */}
                <div className="com-det__header-acciones">
                    <button
                        className="com-det__btn com-det__btn--pdf"
                        onClick={handleDescargarPdf}
                        disabled={descargandoPdf}
                    >
                        {descargandoPdf ? '⏳ Generando…' : '⬇ Descargar PDF'}
                    </button>

                    {comunicado.estado === 'borrador' && (
                        <Link
                            to={`/comunicados/${id}/editar`}
                            className="com-det__btn com-det__btn--editar"
                        >
                            ✏️ Editar
                        </Link>
                    )}

                    {!confirmElim ? (
                        <button
                            className="com-det__btn com-det__btn--eliminar"
                            onClick={() => setConfirmElim(true)}
                        >
                            🗑 Eliminar
                        </button>
                    ) : (
                        <div className="com-det__confirm">
                            <span>¿Confirmar eliminación?</span>
                            <button
                                className="com-det__btn com-det__btn--danger"
                                onClick={handleEliminar}
                                disabled={eliminando}
                            >
                                {eliminando ? '…' : 'Sí, eliminar'}
                            </button>
                            <button
                                className="com-det__btn com-det__btn--secundario"
                                onClick={() => setConfirmElim(false)}
                            >
                                Cancelar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Metadatos ──────────────────────────────────────────── */}
            <div className="com-det__card">
                <div className="com-det__meta-grid">
                    <div className="com-det__meta-item">
                        <span className="com-det__meta-label">Destinatario</span>
                        <span className="com-det__meta-valor">{comunicado.destinatario}</span>
                    </div>
                    {comunicado.cargo_destinatario && (
                        <div className="com-det__meta-item">
                            <span className="com-det__meta-label">Cargo</span>
                            <span className="com-det__meta-valor">{comunicado.cargo_destinatario}</span>
                        </div>
                    )}
                    <div className="com-det__meta-item">
                        <span className="com-det__meta-label">Asunto</span>
                        <span className="com-det__meta-valor">{comunicado.asunto}</span>
                    </div>
                    <div className="com-det__meta-item">
                        <span className="com-det__meta-label">Fecha de creación</span>
                        <span className="com-det__meta-valor">{comunicado.created_at}</span>
                    </div>
                    {comunicado.autor && (
                        <div className="com-det__meta-item">
                            <span className="com-det__meta-label">Redactado por</span>
                            <span className="com-det__meta-valor">{comunicado.autor.nombre}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Cuerpo del comunicado ──────────────────────────────── */}
            <div className="com-det__card com-det__card--cuerpo">
                <div className="com-det__seccion-titulo">Contenido del Comunicado</div>
                <div className="com-det__cuerpo">
                    {comunicado.cuerpo.split('\n').map((parrafo, i) => (
                        <p key={i}>{parrafo}</p>
                    ))}
                </div>
            </div>

            {/* ── Navegación inferior ────────────────────────────────── */}
            <div className="com-det__nav-footer">
                <Link to="/comunicados" className="com-det__btn com-det__btn--secundario">
                    ← Volver al historial
                </Link>
            </div>

        </div>
    );
}

export default ComunicadoDetail;

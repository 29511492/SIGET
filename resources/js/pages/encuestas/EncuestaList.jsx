/**
 * resources/js/pages/encuestas/EncuestaList.jsx
 *
 * Lista de campañas de censo territorial (solo admin).
 *
 * INTEGRACIÓN (oct-2026, módulo de georreferenciación):
 *  · Usa el sistema base de listas (.list-*) de FamiliaList.css y el
 *    patrón de "puntos focales" (sección 9.8 del Documento Maestro):
 *    chip de conteo total, botón primario con sombra y atenuación de
 *    las encuestas cerradas (tr-inactive).
 *  · El formulario de creación se abre en modal (FormModal) sobre
 *    /encuestas, igual que Familias: la URL no cambia.
 *  · Paginación real: el backend pagina de a 15; la versión original
 *    solo leía la primera página.
 *  · El estado de la encuesta se cambia desde el badge (PUT con solo
 *    `activa`); eliminar pide confirmación y es soft delete.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient    from '../../services/axios';
import ConfirmModal from '../../components/ui/ConfirmModal';
import FormModal    from '../../components/ui/FormModal';
import EncuestaForm from './EncuestaForm';
import '../familias/FamiliaList.css';
import './EncuestaList.css';

const TIPO_LABELS = {
    bombona_gas: 'Bombona de gas',
    bolsa_clap:  'Bolsa CLAP',
    otro:        'Otro',
};

const TIPO_BADGE = {
    bombona_gas: 'badge--amber',
    bolsa_clap:  'badge--teal',
    otro:        'badge--purple',
};

const POR_PAGINA = 15;

// 'YYYY-MM-DD' → 'DD/MM/YYYY' sin pasar por Date (evita desfases de zona horaria)
const formatearFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');

export default function EncuestaList() {
    const navigate = useNavigate();

    const [encuestas,    setEncuestas]    = useState([]);
    const [meta,         setMeta]         = useState({ current_page: 1, last_page: 1, total: 0 });
    const [pagina,       setPagina]       = useState(1);
    const [isLoading,    setIsLoading]    = useState(true);
    const [error,        setError]        = useState(null);
    const [mostrarForm,  setMostrarForm]  = useState(false);
    const [aEliminar,    setAEliminar]    = useState(null);
    const [isDeleting,   setIsDeleting]   = useState(false);
    const [cambiandoId,  setCambiandoId]  = useState(null);

    const cargar = useCallback(async (silencioso = false) => {
        if (!silencioso) setIsLoading(true);
        try {
            const { data } = await apiClient.get('/v1/encuestas', {
                params: { page: pagina, per_page: POR_PAGINA },
            });

            // Si se eliminó el último elemento de la última página, retroceder una
            if (data.data.length === 0 && pagina > 1) {
                setPagina(pagina - 1);
                return;
            }

            setEncuestas(data.data);
            setMeta(data.meta);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.message ?? 'No se pudieron cargar las encuestas.');
        } finally {
            setIsLoading(false);
        }
    }, [pagina]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const alternarActiva = async (encuesta) => {
        setCambiandoId(encuesta.id);
        try {
            await apiClient.put(`/v1/encuestas/${encuesta.id}`, { activa: !encuesta.activa });
            await cargar(true);
        } catch (err) {
            setError(err.response?.data?.message ?? 'No se pudo actualizar el estado de la encuesta.');
        } finally {
            setCambiandoId(null);
        }
    };

    const eliminar = async () => {
        if (!aEliminar) return;
        setIsDeleting(true);
        try {
            await apiClient.delete(`/v1/encuestas/${aEliminar.id}`);
            setAEliminar(null);
            await cargar(true);
        } catch (err) {
            setAEliminar(null);
            setError(err.response?.data?.message ?? 'No se pudo eliminar la encuesta.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCreada = () => {
        setMostrarForm(false);
        if (pagina === 1) {
            cargar(true);
        } else {
            setPagina(1);
        }
    };

    return (
        <div className="list-page">

            <header className="list-topbar">
                <button type="button" className="list-topbar__back" onClick={() => navigate('/dashboard')}>
                    ← Dashboard
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Encuestas</span>
                </div>
            </header>

            <main className="list-container">

                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Encuestas territoriales</h1>
                        <p className="list-heading__subtitle">
                            Campañas de censo (gas, bolsas CLAP…) que alimentan el mapa de calor.
                        </p>
                        {!isLoading && (
                            <span className="list-heading__count">
                                {meta.total} {meta.total === 1 ? 'encuesta' : 'encuestas'}
                            </span>
                        )}
                    </div>
                    <button type="button" className="list-btn list-btn--primary" onClick={() => setMostrarForm(true)}>
                        + Nueva encuesta
                    </button>
                </div>

                {error && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span>
                        <span>{error}</span>
                        <button type="button" className="list-alert__retry" onClick={() => cargar()}>
                            Reintentar
                        </button>
                    </div>
                )}

                {isLoading ? (
                    <div className="list-loading">
                        <div className="list-loading__spinner" />
                        <p>Cargando encuestas…</p>
                    </div>
                ) : encuestas.length === 0 ? (
                    <div className="list-empty">
                        <span aria-hidden="true">📝</span>
                        <p>No hay encuestas registradas todavía.</p>
                    </div>
                ) : (
                    <div className="list-table-wrap">
                        <table className="list-table">
                            <thead>
                                <tr>
                                    <th>Campaña</th>
                                    <th>Tipo</th>
                                    <th>Inicio</th>
                                    <th>Cierre</th>
                                    <th className="td-center">Entregas</th>
                                    <th>Estado</th>
                                    <th className="th-actions">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {encuestas.map((encuesta) => (
                                    <tr key={encuesta.id} className={encuesta.activa ? '' : 'tr-inactive'}>
                                        <td>
                                            <span className="enc-nombre">{encuesta.nombre}</span>
                                            {encuesta.descripcion && (
                                                <span className="enc-desc">{encuesta.descripcion}</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge ${TIPO_BADGE[encuesta.tipo] ?? 'badge--blue'}`}>
                                                {TIPO_LABELS[encuesta.tipo] ?? encuesta.tipo}
                                            </span>
                                        </td>
                                        <td className="td-meta">{formatearFecha(encuesta.fecha_inicio)}</td>
                                        <td className="td-meta">{formatearFecha(encuesta.fecha_cierre)}</td>
                                        <td className="td-center">{encuesta.total_respuestas ?? 0}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className={`enc-estado ${encuesta.activa ? 'enc-estado--activa' : 'enc-estado--cerrada'}`}
                                                onClick={() => alternarActiva(encuesta)}
                                                disabled={cambiandoId === encuesta.id}
                                                title="Clic para cambiar el estado"
                                            >
                                                {encuesta.activa ? 'Activa' : 'Cerrada'}
                                            </button>
                                        </td>
                                        <td>
                                            <div className="td-actions">
                                                <Link
                                                    to={`/mapa-calor?encuesta_id=${encuesta.id}`}
                                                    className="action-btn enc-link"
                                                >
                                                    🗺 Ver mapa
                                                </Link>
                                                <Link
                                                    to={`/encuestas/${encuesta.id}/respuestas`}
                                                    className="action-btn enc-link"
                                                >
                                                    📦 Entregas
                                                </Link>
                                                <button
                                                    type="button"
                                                    className="action-btn action-btn--delete"
                                                    onClick={() => setAEliminar(encuesta)}
                                                    aria-label={`Eliminar la encuesta ${encuesta.nombre}`}
                                                >
                                                    🗑
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!isLoading && meta.last_page > 1 && (
                    <nav className="list-pagination" aria-label="Paginación de encuestas">
                        <button
                            type="button"
                            className="page-btn"
                            disabled={meta.current_page <= 1}
                            onClick={() => setPagina(meta.current_page - 1)}
                        >
                            ← Anterior
                        </button>
                        <span className="page-info">
                            Página {meta.current_page} de {meta.last_page}
                        </span>
                        <button
                            type="button"
                            className="page-btn"
                            disabled={meta.current_page >= meta.last_page}
                            onClick={() => setPagina(meta.current_page + 1)}
                        >
                            Siguiente →
                        </button>
                    </nav>
                )}
            </main>

            <FormModal
                isOpen={mostrarForm}
                title="Nueva encuesta territorial"
                onClose={() => setMostrarForm(false)}
            >
                <EncuestaForm
                    onCancel={() => setMostrarForm(false)}
                    onSuccess={handleCreada}
                />
            </FormModal>

            <ConfirmModal
                isOpen={!!aEliminar}
                title="Eliminar encuesta"
                message={`¿Eliminar la encuesta "${aEliminar?.nombre ?? ''}"?`}
                detail="Las entregas registradas se conservan en el historial."
                confirmLabel="Sí, eliminar"
                variant="danger"
                onConfirm={eliminar}
                onCancel={() => setAEliminar(null)}
                isLoading={isDeleting}
            />
        </div>
    );
}

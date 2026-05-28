import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../services/axios';
import './ExportModal.css';

/**
 * ExportModal
 * Modal de opciones de reportes disparado desde el botón
 * "Exportar Reporte" del Dashboard.
 *
 * Props:
 *   isOpen   {boolean}  — controla la visibilidad
 *   onClose  {function} — callback para cerrar el modal
 */
function ExportModal({ isOpen, onClose }) {
    const [cargando, setCargando] = useState(null); // 'estadisticas' | null

    if (!isOpen) return null;

    // ── Descarga el PDF de estadísticas generado al vuelo ─────────────────
    const handleExportarEstadisticas = async () => {
        setCargando('estadisticas');
        try {
            const response = await apiClient.get('/v1/reportes/estadisticas-dashboard', {
                responseType: 'blob',
                headers: { Accept: 'application/pdf' },
            });

            const url = window.URL.createObjectURL(
                new Blob([response.data], { type: 'application/pdf' })
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = `reporte_estadisticas_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            onClose();
        } catch (err) {
            console.error('Error al generar el reporte:', err);
            alert('No se pudo generar el reporte. Intenta nuevamente.');
        } finally {
            setCargando(null);
        }
    };

    return (
        <div className="export-modal__overlay" onClick={onClose}>
            <div
                className="export-modal__panel"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ──────────────────────────────────────────── */}
                <div className="export-modal__header">
                    <h2 className="export-modal__titulo">Exportar Reportes</h2>
                    <button className="export-modal__cerrar" onClick={onClose}>✕</button>
                </div>

                {/* ── Opciones ─────────────────────────────────────────── */}
                <div className="export-modal__body">

                    {/* Opción 1: Estadísticas del dashboard (al vuelo) */}
                    <div className="export-modal__opcion">
                        <div className="export-modal__opcion-icono">📊</div>
                        <div className="export-modal__opcion-info">
                            <h3>Reporte de Estadísticas</h3>
                            <p>Totales de familias, habitantes y condición de viviendas.</p>
                        </div>
                        <button
                            className="export-modal__btn"
                            onClick={handleExportarEstadisticas}
                            disabled={cargando === 'estadisticas'}
                        >
                            {cargando === 'estadisticas' ? 'Generando…' : 'Descargar PDF'}
                        </button>
                    </div>

                    <hr className="export-modal__divider" />

                    {/* Opción 2: Redactar comunicado (navega a la página del módulo) */}
                    <div className="export-modal__opcion">
                        <div className="export-modal__opcion-icono">✉️</div>
                        <div className="export-modal__opcion-info">
                            <h3>Comunicado a Alcaldía / Empresa</h3>
                            <p>Redacta y genera un comunicado oficial del Consejo Comunal.</p>
                        </div>
                        <Link
                            to="/comunicados/nuevo"
                            className="export-modal__btn export-modal__btn--dorado"
                            onClick={onClose}
                        >
                            Redactar
                        </Link>
                    </div>

                    <hr className="export-modal__divider" />

                    {/* Opción 3: Historial de comunicados */}
                    <div className="export-modal__opcion">
                        <div className="export-modal__opcion-icono">📋</div>
                        <div className="export-modal__opcion-info">
                            <h3>Historial de Comunicados</h3>
                            <p>Consulta y descarga los comunicados emitidos anteriormente.</p>
                        </div>
                        <Link
                            to="/comunicados"
                            className="export-modal__btn"
                            onClick={onClose}
                        >
                            Ver Historial
                        </Link>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default ExportModal;

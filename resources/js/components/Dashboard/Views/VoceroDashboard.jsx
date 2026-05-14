/**
 * resources/js/components/Dashboard/Views/VoceroDashboard.jsx
 *
 * CORRECCIONES DE IMPORTS (misma lógica que AdminDashboard):
 *   apiClient → '../../../services/axios'   (3 niveles arriba)
 *   No usa StatCard, así que no hay import de componentes locales.
 *
 * ENDPOINTS corregidos: '/v1/vocero/...' (sin /api, eso lo agrega baseURL)
 */

import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../services/axios'; // ← 3 niveles arriba

const ESTADO_CONFIG = {
    completado:  { label: 'Completado',  cls: 'badge--green' },
    en_progreso: { label: 'En progreso', cls: 'badge--amber' },
    pendiente:   { label: 'Pendiente',   cls: 'badge--gray'  },
    critico:     { label: 'Crítico',     cls: 'badge--red'   },
};

export default function VoceroDashboard({ user }) {
    const [resumen,  setResumen]  = useState(null);
    const [tareas,   setTareas]   = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [resumenRes, tareasRes] = await Promise.all([
                apiClient.get('/v1/vocero/resumen'), // ← /api/v1/vocero/resumen ✓
                apiClient.get('/v1/vocero/tareas'),  // ← /api/v1/vocero/tareas  ✓
            ]);
            setResumen(resumenRes.data.data);
            setTareas(tareasRes.data.data ?? []);
        } catch (err) {
            setError(
                err.response?.data?.message ??
                'No se pudo cargar los datos de tu comunidad.'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <section className="dashboard-view">
            <header className="dashboard-view__header">
                <div>
                    <h2 className="dashboard-view__title">Mi Comunidad</h2>
                    <p className="dashboard-view__subtitle">
                        {resumen?.nombre_sede
                            ? `Sede: ${resumen.nombre_sede}`
                            : 'Cargando datos de tu sector...'}
                    </p>
                </div>
            </header>

            {error && (
                <div className="dashboard-error" role="alert">
                    <span>⚠</span>
                    <span>{error}</span>
                    <button onClick={fetchData} className="dashboard-error__retry">
                        Reintentar
                    </button>
                </div>
            )}

            <div className="vocero-stats">
                {[
                    { label: 'Familias en mi sector',   value: resumen?.familias_sector   ?? '—', icon: '🏠' },
                    { label: 'Habitantes registrados',  value: resumen?.habitantes_sector ?? '—', icon: '👥' },
                    { label: 'Pagos QR pendientes',     value: resumen?.pagos_pendientes  ?? '—', icon: '📄' },
                ].map((item) => (
                    <div key={item.label} className="vocero-stat-item">
                        <span className="vocero-stat-item__icon">{item.icon}</span>
                        <p className="vocero-stat-item__value">
                            {loading ? <span className="skeleton-text" /> : item.value}
                        </p>
                        <p className="vocero-stat-item__label">{item.label}</p>
                    </div>
                ))}
            </div>

            <section className="task-list-section">
                <h3 className="task-list-section__title">Tareas de Censo Pendientes</h3>

                {loading && (
                    <div className="task-list">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="task-item task-item--skeleton" />
                        ))}
                    </div>
                )}

                {!loading && tareas.length === 0 && (
                    <div className="task-list__empty">
                        <span>✅</span>
                        <p>No tienes tareas pendientes. ¡Buen trabajo!</p>
                    </div>
                )}

                {!loading && tareas.length > 0 && (
                    <ul className="task-list" role="list">
                        {tareas.map((tarea) => {
                            const estadoInfo = ESTADO_CONFIG[tarea.estado] ?? ESTADO_CONFIG.pendiente;
                            return (
                                <li key={tarea.id} className="task-item">
                                    <div className="task-item__info">
                                        <p className="task-item__title">{tarea.titulo}</p>
                                        <p className="task-item__meta">{tarea.descripcion}</p>
                                    </div>
                                    <div className="task-item__right">
                                        <span className={`badge ${estadoInfo.cls}`}>
                                            {estadoInfo.label}
                                        </span>
                                        {tarea.fecha_limite && (
                                            <p className="task-item__date">
                                                📅 {new Date(tarea.fecha_limite).toLocaleDateString('es-VE')}
                                            </p>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section className="quick-actions">
                <h3 className="quick-actions__title">Mis Acciones</h3>
                <div className="quick-actions__grid">
                    {[
                        { label: 'Registrar Familia', icon: '🏠', href: '/familias/crear' },
                        { label: 'Agregar Habitante', icon: '👤', href: '/habitantes/crear' },
                        { label: 'Cargar Pago QR',   icon: '📸', href: '/pagos/nuevo' },
                        { label: 'Ver Noticias',     icon: '📰', href: '/noticias' },
                    ].map((action) => (
                        <a key={action.href} href={action.href} className="quick-action-card">
                            <span className="quick-action-card__icon">{action.icon}</span>
                            <span className="quick-action-card__label">{action.label}</span>
                            <span className="quick-action-card__arrow">→</span>
                        </a>
                    ))}
                </div>
            </section>
        </section>
    );
}

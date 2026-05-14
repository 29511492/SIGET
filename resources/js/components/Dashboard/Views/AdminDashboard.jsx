/**
 * resources/js/components/Dashboard/Views/AdminDashboard.jsx
 *
 * CORRECCIONES DE IMPORTS:
 *
 * Este archivo vive en:
 *   resources/js/components/Dashboard/Views/AdminDashboard.jsx
 *
 * Para llegar a services/axios.js desde aquí:
 *   Views/ → Dashboard/ → components/ → js/ → services/axios.js
 *   Ruta relativa: '../../../services/axios'  (3 niveles arriba)
 *
 * Para llegar a components/StatCard.jsx desde aquí:
 *   Views/ → Dashboard/ → components/StatCard.jsx
 *   Ruta relativa: '../components/StatCard'   (1 nivel arriba)
 *
 * Los endpoints usan '/v1/...' porque baseURL de axios ya es '/api'
 */

import { useState, useEffect, useCallback } from 'react';
import StatCard  from '../StatCard';
import apiClient from '../../../services/axios';

const STAT_CARDS_CONFIG = [
    { key: 'total_familias',     label: 'Familias Registradas', icon: '🏠', color: 'navy'   },
    { key: 'total_habitantes',   label: 'Habitantes del Censo', icon: '👥', color: 'gold'   },
    { key: 'viviendas_criticas', label: 'Viviendas Críticas',   icon: '⚠️', color: 'red'    },
    { key: 'con_discapacidad',   label: 'Con Discapacidad',     icon: '♿', color: 'teal'   },
    { key: 'total_voceros',      label: 'Voceros Activos',      icon: '🎙', color: 'amber'  },
    { key: 'total_proyectos',    label: 'Proyectos en Curso',   icon: '📋', color: 'green'  },
    { key: 'total_beneficios',   label: 'Beneficios Entregados',icon: '🎁', color: 'purple' },
];

export default function AdminDashboard({ user }) {
    const [stats,   setStats]   = useState(null); // Iniciamos en null para el control de carga
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.get('/v1/dashboard/stats');
            // Aseguramos que tomamos la data del sobre 'data' de Laravel
            setStats(response.data.data || response.data);
        } catch (err) {
            setError(
                err.response?.data?.message ??
                'No se pudo cargar las estadísticas.'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // 1. SOLUCIÓN TÉCNICA: Guard de carga para evitar el error 'Cannot read properties of undefined'
    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="spin mb-4 text-2xl">↻</div>
                    <p className="text-gray-500 italic">Cargando datos de la comunidad...</p>
                </div>
            </div>
        );
    }

    return (
        <section className="dashboard-view">
            <header className="dashboard-view__header">
                <div>
                    <h2 className="dashboard-view__title">Panel de Control</h2>
                    <p className="dashboard-view__subtitle">
                        Resumen estadístico del censo comunal
                    </p>
                </div>
                <button
                    className="dashboard-view__refresh-btn"
                    onClick={fetchStats}
                    disabled={loading}
                    aria-label="Actualizar estadísticas"
                >
                    <span className={loading ? 'spin' : ''}>↻</span>
                </button>
            </header>

            {error && (
                <div className="dashboard-error" role="alert">
                    <span>⚠</span>
                    <span>{error}</span>
                    <button onClick={fetchStats} className="dashboard-error__retry">
                        Reintentar
                    </button>
                </div>
            )}

            <div className="stats-grid">
                {STAT_CARDS_CONFIG.map((config) => (
                    <StatCard
                        key={config.key}
                        label={config.label}
                        // 2. SOLUCIÓN TÉCNICA: Acceso seguro con Nullish Coalescing
                        value={stats?.[config.key] ?? 0}
                        icon={config.icon}
                        color={config.color}
                        loading={loading}
                    />
                ))}
            </div>

            <section className="quick-actions">
                <h3 className="quick-actions__title">Acciones Rápidas</h3>
                <div className="quick-actions__grid">
                    {[
                        { label: 'Registrar Familia', icon: '🏠', href: '/familias/crear'   },
                        { label: 'Agregar Habitante', icon: '👤', href: '/habitantes/crear' },
                        { label: 'Nuevo Proyecto',    icon: '📋', href: '/proyectos/crear'  },
                        { label: 'Gestionar Voceros', icon: '🎙', href: '/voceros'           },
                        { label: 'Ver Auditoría',     icon: '🔍', href: '/auditoria'         },
                        { label: 'Configuración',     icon: '⚙️', href: '/configuracion'     },
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

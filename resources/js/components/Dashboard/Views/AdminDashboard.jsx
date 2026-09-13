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
 *
 * ─────────────────────────────────────────────────────────────────
 * FIX (junio 2026) — Eliminación de "Acciones Rápidas" duplicada
 * ─────────────────────────────────────────────────────────────────
 * Este componente tenía su propia sección <section className="quick-actions">
 * hardcodeada con <a href>, que se renderizaba apilada sobre la sección
 * de Acciones Rápidas real de DashboardPage.jsx (que sí usa <Link>).
 *
 * Se eliminó por completo esa sección duplicada. En su lugar se agregó
 * una fila de "Alertas" — dinámica, clicable, y que solo aparece cuando
 * hay algo que realmente requiere atención (sugerencias sin responder o
 * viviendas en estado crítico). Si todo está en orden, la fila no se
 * renderiza — así no se satura la vista innecesariamente.
 *
 * La única sección "Acciones Rápidas" que sobrevive en todo el Dashboard
 * es la de DashboardPage.jsx, ya con <Link> (sin recargar la SPA) y ahora
 * con badge de pendientes en el ítem de Sugerencias.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link }     from 'react-router-dom';
import StatCard    from '../StatCard';
import apiClient   from '../../../services/axios';
import ExportModal from '../../../pages/reportes/ExportModal';

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
    const [exportModalAbierto, setExportModalAbierto] = useState(false);

    // ── Estado de alertas (sugerencias y pagos pendientes) ─────
    // Solo necesitamos el conteo, así que pedimos 1 página mínima.
    const [sugerenciasPendientes, setSugerenciasPendientes] = useState(0);
    const [pagosPendientes,       setPagosPendientes]       = useState(0);

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

    // Trae el conteo de sugerencias pendientes para la fila de alertas.
    // Endpoint ya existente (Capa 2 — admin/operador/vocero), no requiere
    // cambios de backend. Si falla, simplemente no se muestra la alerta.
    const fetchSugerenciasPendientes = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/v1/sugerencias?revisada=false');
            setSugerenciasPendientes(data.meta?.pendientes ?? 0);
        } catch {
            setSugerenciasPendientes(0);
        }
    }, []);

    // FIX (junio 2026): conteo de pagos QR pendientes de verificación,
    // incluyendo los registrados directamente por el rol "usuario" desde
    // el Portal Ciudadano (POST /v1/pagos/mio). Mismo endpoint que ya
    // usa el panel de validación (/pagos?estado=pendiente), Capa 2.
    const fetchPagosPendientes = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/v1/pagos?estado=pendiente');
            setPagosPendientes(data.meta?.total ?? 0);
        } catch {
            setPagosPendientes(0);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        fetchSugerenciasPendientes();
        fetchPagosPendientes();
    }, [fetchStats, fetchSugerenciasPendientes, fetchPagosPendientes]);

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

    const viviendasCriticas = stats?.viviendas_criticas ?? 0;

    // Construcción de alertas — solo entran las que tienen valor > 0
    const alertas = [
        pagosPendientes > 0 && {
            key: 'pagos',
            href: '/pagos',
            icon: '📱',
            texto: `${pagosPendientes} pago${pagosPendientes !== 1 ? 's' : ''} QR sin verificar`,
            tono: 'amber',
        },
        sugerenciasPendientes > 0 && {
            key: 'sugerencias',
            href: '/sugerencias',
            icon: '💬',
            texto: `${sugerenciasPendientes} sugerencia${sugerenciasPendientes !== 1 ? 's' : ''} sin responder`,
            tono: 'amber',
        },
        viviendasCriticas > 0 && {
            key: 'viviendas',
            href: '/familias',
            icon: '⚠️',
            texto: `${viviendasCriticas} vivienda${viviendasCriticas !== 1 ? 's' : ''} en estado crítico`,
            tono: 'red',
        },
    ].filter(Boolean);

    return (
        <section className="dashboard-view">
            <header className="dashboard-view__header">
                <div>
                    <h2 className="dashboard-view__title">Panel de Control</h2>
                    <p className="dashboard-view__subtitle">
                        Resumen estadístico del censo comunal
                    </p>
                </div>
                <div className="dashboard-view__header-actions">
                    <button
                        className="dashboard-view__export-btn"
                        onClick={() => setExportModalAbierto(true)}
                        aria-label="Exportar reporte"
                    >
                        📄 Exportar Reporte
                    </button>
                    <button
                        className="dashboard-view__refresh-btn"
                        onClick={fetchStats}
                        disabled={loading}
                        aria-label="Actualizar estadísticas"
                    >
                        <span className={loading ? 'spin' : ''}>↻</span>
                    </button>
                </div>
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

            {/* ── Fila de Alertas ──────────────────────────────────
             *  Solo se renderiza si hay algo que requiera atención.
             *  Cada alerta es clicable y navega directo al módulo
             *  correspondiente usando <Link> (sin recargar la SPA).
             * ──────────────────────────────────────────────────── */}
            {alertas.length > 0 && (
                <div className="alert-banner-row" role="region" aria-label="Alertas que requieren atención">
                    {alertas.map(alerta => (
                        <Link
                            key={alerta.key}
                            to={alerta.href}
                            className={`alert-banner alert-banner--${alerta.tono}`}
                        >
                            <span className="alert-banner__icon" aria-hidden="true">{alerta.icon}</span>
                            <span className="alert-banner__texto">{alerta.texto}</span>
                            <span className="alert-banner__arrow" aria-hidden="true">→</span>
                        </Link>
                    ))}
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

            <ExportModal
                isOpen={exportModalAbierto}
                onClose={() => setExportModalAbierto(false)}
            />
        </section>
    );
}

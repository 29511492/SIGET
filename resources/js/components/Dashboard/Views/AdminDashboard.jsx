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
 * Se eliminó por completo esa sección duplicada.
 *
 * ─────────────────────────────────────────────────────────────────
 * FIX (septiembre 2026) — Corrección del profesor: "parece landing page"
 * ─────────────────────────────────────────────────────────────────
 * El dashboard mostraba primero un grid de 7 estadísticas y las acciones
 * quedaban relegadas a una sección aparte en DashboardPage.jsx, al final
 * de la página. No había un punto de entrada claro que dijera "esto es
 * lo que puedes hacer aquí" (patrón tipo Sistema Patria).
 *
 * Se invirtió el orden y se unificó todo dentro de esta vista:
 *   1. Hero de bienvenida (saludo + identidad + acciones de exportar/refrescar)
 *   2. Alertas dinámicas (solo si hay algo que atender)
 *   3. Grid "¿Qué quieres hacer hoy?" — las acciones reales del rol admin,
 *      ahora con badges de pendientes directamente sobre la tarjeta
 *   4. Resumen estadístico (antes era lo primero, ahora es secundario)
 *
 * La sección "Acciones Rápidas" que vivía en DashboardPage.jsx se eliminó
 * — quedaba duplicada con este grid y generaba dos puntos de entrada
 * distintos para lo mismo. Ver DashboardPage.jsx.
 *
 * Las clases del grid de acciones (.dashboard-acciones*, .dashboard-accion-card*)
 * y del hero (.dashboard-hero*) viven en DashboardPage.css y son compartidas
 * con VoceroDashboard.jsx. El patrón de tarjeta (.dashboard-accion-card) es
 * el mismo que usa UsuarioDashboard.jsx en el Portal Ciudadano — unificado
 * en esta sesión para que las tres vistas de rol se sientan como el mismo
 * sistema.
 *
 * ─────────────────────────────────────────────────────────────────
 * CAMBIO (sept-2026) — Corrección del profesor: gestión de roles
 * ─────────────────────────────────────────────────────────────────
 * Se agregó la tarjeta "Roles y Usuarios" → /configuracion, con badge
 * de cuentas bloqueadas (mismo patrón que pagos y sugerencias), y una
 * alerta ámbar cuando hay cuentas bloqueadas. Conteo desde
 * GET /v1/usuarios?estado=bloqueado (Capa 4, solo admin).
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

// Saludo dinámico según hora del día — mismo criterio que UsuarioDashboard.jsx
const getSaludo = () => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'Buenos días';
    if (h >= 12 && h < 19) return 'Buenas tardes';
    return 'Buenas noches';
};

export default function AdminDashboard({ user }) {
    const [stats,   setStats]   = useState(null); // Iniciamos en null para el control de carga
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);
    const [exportModalAbierto, setExportModalAbierto] = useState(false);

    // ── Estado de alertas (sugerencias y pagos pendientes) ─────
    // Solo necesitamos el conteo, así que pedimos 1 página mínima.
    const [sugerenciasPendientes, setSugerenciasPendientes] = useState(0);
    const [pagosPendientes,       setPagosPendientes]       = useState(0);
    const [cuentasBloqueadas,     setCuentasBloqueadas]     = useState(0);

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

    // Trae el conteo de sugerencias pendientes (para la alerta y el badge
    // de la tarjeta "Ver Sugerencias"). Endpoint ya existente (Capa 2),
    // no requiere cambios de backend. Si falla, simplemente no se muestra.
    const fetchSugerenciasPendientes = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/v1/sugerencias?revisada=false');
            setSugerenciasPendientes(data.meta?.pendientes ?? 0);
        } catch {
            setSugerenciasPendientes(0);
        }
    }, []);

    // Conteo de pagos QR pendientes de verificación, incluyendo los
    // registrados directamente por el rol "usuario" desde el Portal
    // Ciudadano (POST /v1/pagos/mio). Mismo endpoint que ya usa el
    // panel de validación (/pagos?estado=pendiente), Capa 2.
    const fetchPagosPendientes = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/v1/pagos?estado=pendiente');
            setPagosPendientes(data.meta?.total ?? 0);
        } catch {
            setPagosPendientes(0);
        }
    }, []);

    // Cuentas de usuario bloqueadas por intentos fallidos (para la alerta
    // y el badge de "Roles y Usuarios"). Solo admin; si falla, no se muestra.
    const fetchCuentasBloqueadas = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/v1/usuarios?estado=bloqueado&per_page=1');
            setCuentasBloqueadas(data.meta?.total ?? 0);
        } catch {
            setCuentasBloqueadas(0);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        fetchSugerenciasPendientes();
        fetchPagosPendientes();
        fetchCuentasBloqueadas();
    }, [fetchStats, fetchSugerenciasPendientes, fetchPagosPendientes, fetchCuentasBloqueadas]);

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
        cuentasBloqueadas > 0 && {
            key: 'bloqueadas',
            href: '/configuracion',
            icon: '🔒',
            texto: `${cuentasBloqueadas} cuenta${cuentasBloqueadas !== 1 ? 's' : ''} de usuario bloqueada${cuentasBloqueadas !== 1 ? 's' : ''}`,
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

    // ── Grid de acciones "¿Qué quieres hacer hoy?" ─────────────
    // NOTA: se enlaza a /familias (no /familias/crear) porque el
    // registro de familias ahora ocurre mediante modal sobre esa
    // misma ruta — /familias/crear ya no existe (ver Documento Maestro).
    const ACCIONES_ADMIN = [
        {
            titulo: 'Registrar Familia',
            desc:   'Agrega un nuevo núcleo familiar al censo',
            icon:   '🏠',
            color:  'navy',
            href:   '/familias',
        },
        {
            titulo: 'Nuevo Proyecto',
            desc:   'Registra un proyecto comunitario en curso',
            icon:   '📋',
            color:  'teal',
            href:   '/proyectos/crear',
        },
        {
            titulo: 'Entregar Beneficio',
            desc:   'Registra la entrega de un beneficio social',
            icon:   '🎁',
            color:  'purple',
            href:   '/beneficios/nuevo',
        },
        {
            titulo: 'Validar Pagos',
            desc:   'Revisa y valida comprobantes de pago QR',
            icon:   '📱',
            color:  'gold',
            href:   '/pagos',
            badge:  pagosPendientes,
        },
        {
            titulo: 'Ver Sugerencias',
            desc:   'Responde las sugerencias enviadas por la comunidad',
            icon:   '💬',
            color:  'amber',
            href:   '/sugerencias',
            badge:  sugerenciasPendientes,
        },
        {
            titulo: 'Cuentas de Pago',
            desc:   'Administra las cuentas bancarias del consejo',
            icon:   '🏦',
            color:  'navy',
            href:   '/cuentas-pago',
        },
        {
            titulo: 'Roles y Usuarios',
            desc:   'Asigna roles y gestiona el acceso de las cuentas',
            icon:   '🛡️',
            color:  'teal',
            href:   '/configuracion',
            badge:  cuentasBloqueadas,
        },
        // Oct-2026 (georreferenciación)
        {
            titulo: 'Encuestas',
            desc:   'Crea campañas de censo y registra entregas por familia',
            icon:   '📝',
            color:  'purple',
            href:   '/encuestas',
        },
        {
            titulo: 'Mapa de Calor',
            desc:   'Mira en el mapa qué calles necesitan atención',
            icon:   '🗺️',
            color:  'teal',
            href:   '/mapa-calor',
        },
    ];

    return (
        <section className="dashboard-view">

            {/* ══ HERO ══════════════════════════════════════════ */}
            <div className="dashboard-hero">
                <div className="dashboard-hero__bg" aria-hidden="true" />
                <div className="dashboard-hero__content">
                    <p className="dashboard-hero__saludo">
                        {getSaludo()}, <strong>{user?.name?.split(' ')[0] ?? 'Administrador'}</strong> 👋
                    </p>
                    <h1 className="dashboard-hero__titulo">Panel de Control</h1>
                    <p className="dashboard-hero__subtitulo">
                        Resumen estadístico del censo comunal
                    </p>
                </div>
                <div className="dashboard-hero__actions">
                    <button
                        className="dashboard-hero__btn dashboard-hero__btn--gold"
                        onClick={() => setExportModalAbierto(true)}
                        aria-label="Exportar reporte"
                    >
                        📄 Exportar Reporte
                    </button>
                    <button
                        className="dashboard-hero__btn dashboard-hero__btn--ghost"
                        onClick={fetchStats}
                        disabled={loading}
                        aria-label="Actualizar estadísticas"
                    >
                        <span className={loading ? 'spin' : ''}>↻</span>
                    </button>
                </div>
            </div>

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

            {/* ══ ACCIONES — "¿Qué quieres hacer hoy?" ═══════════ */}
            <section className="dashboard-acciones" aria-label="¿Qué quieres hacer hoy?">
                <h2 className="dashboard-acciones__title">¿Qué quieres hacer hoy?</h2>
                <div className="dashboard-acciones__grid">
                    {ACCIONES_ADMIN.map((accion) => (
                        <Link
                            key={accion.titulo}
                            to={accion.href}
                            className={`dashboard-accion-card dashboard-accion-card--${accion.color}`}
                        >
                            {accion.badge > 0 && (
                                <span className="dashboard-accion-card__badge">{accion.badge}</span>
                            )}
                            <span className="dashboard-accion-card__icon" aria-hidden="true">
                                {accion.icon}
                            </span>
                            <h3 className="dashboard-accion-card__titulo">{accion.titulo}</h3>
                            <p className="dashboard-accion-card__desc">{accion.desc}</p>
                            <span className="dashboard-accion-card__arrow" aria-hidden="true">→</span>
                        </Link>
                    ))}
                </div>
            </section>

            {/* ══ RESUMEN ESTADÍSTICO ═════════════════════════════
             *  Antes era lo primero que se veía; ahora es secundario,
             *  después del grid de acciones.
             * ──────────────────────────────────────────────────── */}
            <section className="dashboard-resumen">
                <h2 className="dashboard-resumen__title">Resumen</h2>
                <div className="stats-grid">
                    {STAT_CARDS_CONFIG.map((config) => {
                        // FIX (sept-2026, corrección 2 — puntos focales): cuando
                        // hay viviendas críticas, esa tarjeta necesita resaltar
                        // sobre las demás, no verse con el mismo peso visual que
                        // "Proyectos en Curso". Mismo criterio que fila-critica
                        // en FamiliaList.css.
                        const esUrgente = config.key === 'viviendas_criticas' && viviendasCriticas > 0;
                        return (
                            <div
                                key={config.key}
                                className={`stat-card-wrap ${esUrgente ? 'stat-card-wrap--urgente' : ''}`}
                            >
                                {esUrgente && (
                                    <span className="stat-card-wrap__flag">⚠ Atención</span>
                                )}
                                <StatCard
                                    label={config.label}
                                    value={stats?.[config.key] ?? 0}
                                    icon={config.icon}
                                    color={config.color}
                                    loading={loading}
                                />
                            </div>
                        );
                    })}
                </div>
            </section>

            <ExportModal
                isOpen={exportModalAbierto}
                onClose={() => setExportModalAbierto(false)}
            />
        </section>
    );
}

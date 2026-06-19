/**
 * resources/js/pages/voceros/MiComunidad.jsx
 *
 * Vista principal para el rol vocero.
 * Muestra un resumen de su comunidad: estadísticas del sector,
 * sus datos de vocero vinculado y accesos rápidos a los módulos
 * de consulta disponibles para su rol (solo lectura).
 *
 * Consume:
 *   GET /api/v1/dashboard/stats  → estadísticas generales
 *   GET /api/v1/voceros          → para encontrar el vocero activo vinculado al usuario
 *
 * El usuario vocero tiene acceso de lectura a:
 * Familias, Habitantes, Voceros, Proyectos, Beneficios, Organizaciones.
 */

import { useState, useEffect }            from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth }                        from '../../hooks/useAuth';
import apiClient                          from '../../services/axios';
import NoticiaWidget                      from '../../components/noticias/NoticiaWidget';
import SugerenciaWidget                   from '../../components/sugerencias/SugerenciaWidget';
import '../DashboardPage.css';
import './MiComunidad.css';

// Módulos de consulta disponibles para el rol vocero
const MODULOS_VOCERO = [
    { label: 'Familias',       icon: '🏠', href: '/familias',       descripcion: 'Ver familias del sector'        },
    { label: 'Habitantes',     icon: '👥', href: '/habitantes',     descripcion: 'Consultar habitantes registrados' },
    { label: 'Voceros',        icon: '🎙', href: '/voceros',        descripcion: 'Directorio de voceros activos'   },
    { label: 'Proyectos',      icon: '📋', href: '/proyectos',      descripcion: 'Estado de proyectos comunitarios' },
    { label: 'Beneficios',     icon: '🎁', href: '/beneficios',     descripcion: 'Registro de beneficios entregados' },
    { label: 'Organizaciones', icon: '🏛️', href: '/organizaciones', descripcion: 'Organizaciones comunitarias'     },
];

export default function MiComunidad() {
    const { user, logout }  = useAuth();
    const navigate          = useNavigate();
    const location          = useLocation();
    const [sidebarOpen,  setSidebarOpen]  = useState(false);
    const [loggingOut,   setLoggingOut]   = useState(false);
    const [stats,        setStats]        = useState(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [errorStats,   setErrorStats]   = useState('');

    // ── Cargar estadísticas del sector ─────────────────────────
    useEffect(() => {
        apiClient.get('/v1/dashboard/stats')
            .then(({ data }) => setStats(data.data))
            .catch(() => setErrorStats('No se pudieron cargar los datos del sector.'))
            .finally(() => setLoadingStats(false));
    }, []);

    // ── Navegación del sidebar — solo ítems visibles al vocero ─
    // El vocero solo tiene permiso de lectura (Capa 2),
    // así que se ocultan los ítems de escritura y admin.
    const NAV_ITEMS = [
        { label: 'Mi Comunidad',   icon: '🏘️', href: '/mi-comunidad'  },
        { label: 'Familias',       icon: '🏠', href: '/familias'       },
        { label: 'Habitantes',     icon: '👥', href: '/habitantes'     },
        { label: 'Voceros',        icon: '🎙', href: '/voceros'        },
        { label: 'Proyectos',      icon: '📋', href: '/proyectos'      },
        { label: 'Beneficios',     icon: '🎁', href: '/beneficios'     },
        { label: 'Organizaciones', icon: '🏛️', href: '/organizaciones' },
        { label: 'Sugerencias',    icon: '💬', href: '/sugerencias'    },
    ];

    const rutaActiva = location.pathname;

    // ── Guard ─────────────────────────────────────────────────
    if (!user) {
        navigate('/login', { replace: true });
        return null;
    }

    const handleLogout = () => {
        setLoggingOut(true);
        logout().finally(() => navigate('/login', { replace: true }));
    };

    // ── Renderizado de estadísticas ───────────────────────────
    const renderStats = () => {
        if (loadingStats) {
            return (
                <div className="comunidad-stats">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="vocero-stat-item stat-card--skeleton">
                            <div className="stat-card__skeleton-icon" />
                            <div className="stat-card__skeleton-value" />
                            <div className="stat-card__skeleton-label" />
                        </div>
                    ))}
                </div>
            );
        }

        if (errorStats) {
            return (
                <div className="list-alert list-alert--error" role="alert">
                    <span>⚠</span>
                    <span>{errorStats}</span>
                    <button
                        className="list-alert__retry"
                        onClick={() => {
                            setErrorStats('');
                            setLoadingStats(true);
                            apiClient.get('/v1/dashboard/stats')
                                .then(({ data }) => setStats(data.data))
                                .catch(() => setErrorStats('Error al reintentar.'))
                                .finally(() => setLoadingStats(false));
                        }}
                    >
                        Reintentar
                    </button>
                </div>
            );
        }

        return (
            <div className="comunidad-stats">
                <div className="vocero-stat-item">
                    <span className="vocero-stat-item__icon" aria-hidden="true">🏠</span>
                    <p className="vocero-stat-item__value">{stats?.total_familias ?? '—'}</p>
                    <p className="vocero-stat-item__label">Familias registradas</p>
                </div>
                <div className="vocero-stat-item">
                    <span className="vocero-stat-item__icon" aria-hidden="true">👥</span>
                    <p className="vocero-stat-item__value">{stats?.total_habitantes ?? '—'}</p>
                    <p className="vocero-stat-item__label">Habitantes del censo</p>
                </div>
                <div className="vocero-stat-item">
                    <span className="vocero-stat-item__icon" aria-hidden="true">📋</span>
                    <p className="vocero-stat-item__value">{stats?.total_proyectos ?? '—'}</p>
                    <p className="vocero-stat-item__label">Proyectos activos</p>
                </div>
            </div>
        );
    };

    // ─────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────
    return (
        <div className={`dashboard-root ${sidebarOpen ? 'dashboard-root--open' : ''}`}>

            {/* ══ SIDEBAR ─────────────────────────────────── */}
            <aside className="dashboard-sidebar" aria-label="Navegación principal">

                <div className="sidebar-brand">
                    <div className="sidebar-brand__logo">S</div>
                    <div className="sidebar-brand__text">
                        <span className="sidebar-brand__name">SIGET</span>
                        <span className="sidebar-brand__role">
                            <span className="role-badge role-badge--vocero">
                                VOCERO
                            </span>
                        </span>
                    </div>
                </div>

                <div className="sidebar-user">
                    <div className="sidebar-user__avatar" aria-hidden="true">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="sidebar-user__info">
                        <p className="sidebar-user__name">{user.name}</p>
                        <p className="sidebar-user__email">{user.email}</p>
                    </div>
                </div>

                <div className="sidebar-divider" />

                <nav className="sidebar-nav" aria-label="Menú principal">
                    <ul role="list">
                        {NAV_ITEMS.map(item => (
                            <li key={item.href}>
                                <Link
                                    to={item.href}
                                    className={`sidebar-nav__item ${
                                        rutaActiva === item.href ||
                                        rutaActiva.startsWith(item.href + '/')
                                            ? 'sidebar-nav__item--active'
                                            : ''
                                    }`}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <span className="sidebar-nav__icon" aria-hidden="true">
                                        {item.icon}
                                    </span>
                                    <span className="sidebar-nav__label">{item.label}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="sidebar-divider" />

                <button
                    className="sidebar-logout"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    aria-label="Cerrar sesión"
                >
                    <span className="sidebar-logout__icon" aria-hidden="true">
                        {loggingOut ? '⏳' : '→'}
                    </span>
                    <span>{loggingOut ? 'Cerrando...' : 'Cerrar sesión'}</span>
                </button>
            </aside>

            {sidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* ══ ÁREA PRINCIPAL ──────────────────────────── */}
            <div className="dashboard-main">

                <header className="dashboard-topbar">
                    <button
                        className="topbar-hamburger"
                        onClick={() => setSidebarOpen(v => !v)}
                        aria-label="Abrir menú"
                        aria-expanded={sidebarOpen}
                    >
                        ☰
                    </button>

                    <div className="topbar-breadcrumb">
                        <span className="topbar-breadcrumb__system">SIGET</span>
                        <span className="topbar-breadcrumb__sep">›</span>
                        <span className="topbar-breadcrumb__page">Mi Comunidad</span>
                    </div>
                </header>

                <main className="dashboard-content" id="main-content">

                    {/* ── Saludo personalizado ──────────────── */}
                    <div className="comunidad-header">
                        <div>
                            <h1 className="comunidad-header__title">
                                Mi Comunidad
                            </h1>
                            <p className="comunidad-header__subtitle">
                                Bienvenido, {user.name}. Aquí puedes consultar el
                                estado de tu sector comunal.
                            </p>
                        </div>
                    </div>

                    {/* ── Estadísticas del sector ───────────── */}
                    <section aria-label="Resumen estadístico del sector">
                        <h2 className="task-list-section__title">
                            Resumen del Sector
                        </h2>
                        {renderStats()}
                    </section>

                    {/* ── Módulos disponibles ───────────────── */}
                    <section
                        className="comunidad-modulos"
                        aria-label="Módulos disponibles"
                    >
                        <h2 className="task-list-section__title">
                            Consultar Información
                        </h2>
                        <div className="comunidad-modulos__grid">
                            {MODULOS_VOCERO.map(({ label, icon, href, descripcion }) => (
                                <Link
                                    key={href}
                                    to={href}
                                    className="comunidad-modulo-card"
                                >
                                    <span
                                        className="comunidad-modulo-card__icon"
                                        aria-hidden="true"
                                    >
                                        {icon}
                                    </span>
                                    <div className="comunidad-modulo-card__body">
                                        <p className="comunidad-modulo-card__label">
                                            {label}
                                        </p>
                                        <p className="comunidad-modulo-card__desc">
                                            {descripcion}
                                        </p>
                                    </div>
                                    <span
                                        className="comunidad-modulo-card__arrow"
                                        aria-hidden="true"
                                    >
                                        →
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* ── Últimas noticias — widget compacto ── */}
                    <NoticiaWidget />

                    {/* ── Sugerencias — widget de envío ─────── */}
                    <SugerenciaWidget />

                </main>
            </div>
        </div>
    );
}

import { useState }                        from 'react';
import { Link, useNavigate, useLocation }  from 'react-router-dom';
import { useAuth }                         from '../hooks/useAuth';
import { getDashboardComponent }           from '../components/Dashboard/Factories/DashboardFactory';
import './DashboardPage.css';

export default function DashboardPage() {
    const { user, isLoading, logout, canWrite, isAdmin } = useAuth();
    const navigate      = useNavigate();
    const location      = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loggingOut,  setLoggingOut]  = useState(false);

    // ── Booleanos defensivos ───────────────────────────────────
    const adminBool = Boolean(isAdmin  ?? (user?.rol === 'admin'));
    const writeBool = Boolean(canWrite ?? (user?.rol === 'admin' || user?.rol === 'operador'));

    // ── Navegación del sidebar ─────────────────────────────────
    const NAV_ITEMS = [
        { label: 'Dashboard',       icon: '⊞',  href: '/dashboard',     permiso: null              },
        { label: 'Familias',        icon: '🏠', href: '/familias',      permiso: null              },
        { label: 'Habitantes',      icon: '👥', href: '/habitantes',    permiso: null              },
        { label: 'Voceros',         icon: '🎙', href: '/voceros',       permiso: null              },
        { label: 'Proyectos',       icon: '📋', href: '/proyectos',     permiso: null              },
        { label: 'Beneficios',      icon: '🎁', href: '/beneficios',    permiso: null              },
        { label: 'Organizaciones',  icon: '🏛️', href: '/organizaciones', permiso: null            },
        { label: 'Pagos QR',        icon: '💳', href: '/pagos',         permiso: 'puede_escribir'  },
        { label: 'Noticias',        icon: '📰', href: '/noticias',      permiso: 'puede_escribir'  },
        { label: 'Auditoría',       icon: '🔍', href: '/auditoria',     permiso: 'es_admin'        },
        { label: 'Configuración',   icon: '⚙️', href: '/configuracion', permiso: 'es_admin'        },
    ];

    // ── Acciones Rápidas ───────────────────────────────────────
    // Usa las clases .quick-action-card definidas en DashboardPage.css.
    // Visible solo para admin y operador (writeBool).
    // Ver Auditoría: solo admin (adminBool).
    const ACCIONES_RAPIDAS = [
        { label: 'Registrar Familia',  icon: '🏠', href: '/familias/crear',   mostrar: writeBool  },
        { label: 'Agregar Habitante',  icon: '👤', href: '/habitantes/crear', mostrar: writeBool  },
        { label: 'Nuevo Proyecto',     icon: '📋', href: '/proyectos/crear',  mostrar: writeBool  },
        { label: 'Entregar Beneficio', icon: '🎁', href: '/beneficios/nuevo', mostrar: writeBool  },
        { label: 'Ver Auditoría',      icon: '🔍', href: '/auditoria',        mostrar: adminBool  },
    ];

    const accionesVisibles = ACCIONES_RAPIDAS.filter(a => a.mostrar);

    // ── Guard: cargando ────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="dashboard-loading" aria-live="polite">
                <div className="dashboard-loading__spinner" aria-hidden="true" />
                <p>Cargando SIGET...</p>
            </div>
        );
    }

    // ── Guard: sin sesión ──────────────────────────────────────
    if (!user) {
        navigate('/login', { replace: true });
        return null;
    }

    // ── getDashboardComponent defensivo ───────────────────────
    let DashboardView;
    try {
        DashboardView = getDashboardComponent(user.rol);
    } catch {
        DashboardView = () => (
            <div className="dashboard-fallback">
                <span className="dashboard-fallback__icon">⚠️</span>
                <p className="dashboard-fallback__title">Vista no disponible</p>
                <p className="dashboard-fallback__text">
                    No hay vista configurada para el rol "{user.rol}".
                </p>
            </div>
        );
    }

    const rutaActiva = location.pathname;

    // ── Visibilidad del sidebar por permiso ────────────────────
    const itemVisible = (permiso) => {
        if (!permiso)                     return true;
        if (permiso === 'puede_escribir') return writeBool;
        if (permiso === 'es_admin')       return adminBool;
        return false;
    };

    // ─────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────
    return (
        <div className={`dashboard-root ${sidebarOpen ? 'dashboard-root--open' : ''}`}>

            {/* ══ SIDEBAR ═══════════════════════════════════════ */}
            <aside className="dashboard-sidebar" aria-label="Navegación principal">

                <div className="sidebar-brand">
                    <div className="sidebar-brand__logo">S</div>
                    <div className="sidebar-brand__text">
                        <span className="sidebar-brand__name">SIGET</span>
                        <span className="sidebar-brand__role">
                            <span className={`role-badge role-badge--${user.rol}`}>
                                {user.rol.toUpperCase()}
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
                        {NAV_ITEMS
                            .filter(item => itemVisible(item.permiso))
                            .map(item => (
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
                            ))
                        }
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

            {/* ══ ÁREA PRINCIPAL ════════════════════════════════ */}
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
                        <span className="topbar-breadcrumb__page">
                            {NAV_ITEMS.find(i =>
                                rutaActiva === i.href ||
                                rutaActiva.startsWith(i.href + '/')
                            )?.label ?? 'Dashboard'}
                        </span>
                    </div>

                    <div className="topbar-actions">
                        {writeBool && (
                            <Link to="/familias/crear" className="topbar-btn topbar-btn--primary">
                                + Registrar Familia
                            </Link>
                        )}
                        {adminBool && (
                            <Link to="/reportes" className="topbar-btn topbar-btn--secondary">
                                📊 Exportar Reporte
                            </Link>
                        )}
                    </div>
                </header>

                <main className="dashboard-content" id="main-content">

                    {/* Vista por rol — AdminDashboard o VoceroDashboard */}
                    <DashboardView user={user} />

                    {/* ── Acciones Rápidas ─────────────────────────
                     *
                     *  Clases del CSS real (DashboardPage.css):
                     *    .quick-actions            → sección contenedora
                     *    .quick-actions__title     → título con ff-display
                     *    .quick-actions__grid      → grid auto-fill 180px
                     *    .quick-action-card        → tarjeta con hover
                     *    .quick-action-card__icon  → icono 1.1rem
                     *    .quick-action-card__label → texto flex:1
                     *    .quick-action-card__arrow → flecha derecha
                     *
                     *  Se usa <Link> para mantener la navegación SPA
                     *  sin recargar la página.
                     * ─────────────────────────────────────────── */}
                    {accionesVisibles.length > 0 && (
                        <section className="quick-actions" aria-label="Acciones rápidas">
                            <h2 className="quick-actions__title">Acciones Rápidas</h2>
                            <div className="quick-actions__grid">
                                {accionesVisibles.map(({ label, icon, href }) => (
                                    <Link
                                        key={href}
                                        to={href}
                                        className="quick-action-card"
                                    >
                                        <span className="quick-action-card__icon" aria-hidden="true">
                                            {icon}
                                        </span>
                                        <span className="quick-action-card__label">
                                            {label}
                                        </span>
                                        <span className="quick-action-card__arrow" aria-hidden="true">
                                            →
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                </main>
            </div>
        </div>
    );

    function handleLogout() {
        setLoggingOut(true);
        logout().finally(() => navigate('/login', { replace: true }));
    }
}

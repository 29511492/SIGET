import { useState } from 'react';
import { Link, useNavigate, useLocation }  from 'react-router-dom';
import { useAuth }                         from '../hooks/useAuth';
import { getDashboardComponent }           from '../components/Dashboard/Factories/DashboardFactory';
import './DashboardPage.css';

/**
 * ─────────────────────────────────────────────────────────────────
 * FIX (septiembre 2026) — Corrección del profesor: "parece landing page"
 * ─────────────────────────────────────────────────────────────────
 * 1. Se eliminó el ítem "Habitantes" de NAV_ITEMS y la acción rápida
 *    "Agregar Habitante" — el módulo de Habitantes ya no existe como
 *    ruta independiente (se gestiona dentro de Familias, ver Documento
 *    Maestro sección 7.3/7.4). Eran enlaces muertos en el sidebar.
 *
 * 2. Se eliminó por completo la sección "Acciones Rápidas" que vivía
 *    al final de esta página (ACCIONES_RAPIDAS, fetchPendientes,
 *    sugerenciasPendientes). Quedaba duplicada con el nuevo grid
 *    "¿Qué quieres hacer hoy?" que ahora vive dentro de cada
 *    AdminDashboard.jsx / VoceroDashboard.jsx — tener dos puntos de
 *    entrada distintos para las mismas acciones era parte de la
 *    sensación de "landing page sin flujo" que señaló el profesor.
 *    Esta página ahora se limita a la navegación (sidebar + topbar)
 *    y delega todo el contenido de "qué hacer" a la vista de cada rol.
 *
 * ─────────────────────────────────────────────────────────────────
 * FIX (sept-2026) — Corrección 3 del profesor: seguridad de roles
 * ─────────────────────────────────────────────────────────────────
 * El ítem "Pagos QR" del sidebar usaba el permiso 'puede_escribir'
 * (admin+operador), así que el vocero no lo veía aunque el backend
 * ya le permitía leer pagos (Capa 2) y ahora también validarlos
 * (PATCH pagos/{pago}/validar, role:admin,vocero). Se agrega el
 * permiso 'puede_validar_pagos' (admin+vocero, ver UserResource) y
 * el ítem usa ese permiso en vez de 'puede_escribir'.
 *
 * 3. El botón "+ Registrar Familia" del topbar apuntaba a
 *    '/familias/crear', ruta que ya no existe (el registro de
 *    familias ahora es por modal sobre '/familias'). Corregido.
 * ─────────────────────────────────────────────────────────────────
 * FIX (oct-2026) — unificación de la pantalla de inicio del vocero
 * ─────────────────────────────────────────────────────────────────
 * El ítem "Familias" del sidebar no tenía permiso (permiso: null), así
 * que el vocero lo veía aunque /familias es solo admin+operador (403 en
 * el backend, instrucción del profesor). Ahora usa 'puede_escribir',
 * igual que Cuentas de Pago y Noticias.
 * ─────────────────────────────────────────────────────────────────
 */
export default function DashboardPage() {
    const { user, isLoading, logout, canWrite, isAdmin } = useAuth();
    const navigate      = useNavigate();
    const location      = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loggingOut,  setLoggingOut]  = useState(false);

    // ── Booleanos defensivos ───────────────────────────────────
    const adminBool = Boolean(isAdmin  ?? (user?.rol === 'admin'));
    const writeBool = Boolean(canWrite ?? (user?.rol === 'admin' || user?.rol === 'operador'));
    // Corrección 3 (sept-2026): admin y vocero validan pagos.
    const validaPagosBool = Boolean(
        user?.permisos?.puede_validar_pagos ?? (user?.rol === 'admin' || user?.rol === 'vocero')
    );
    // Oct-2026 (georreferenciación): el mapa de calor lo ven admin y vocero;
    // crear encuestas y registrar entregas es solo del admin.
    const verMapaBool = Boolean(
        user?.permisos?.puede_ver_mapa ?? (user?.rol === 'admin' || user?.rol === 'vocero')
    );
    const gestionaEncuestasBool = Boolean(
        user?.permisos?.puede_gestionar_encuestas ?? (user?.rol === 'admin')
    );

    // ── Navegación del sidebar ─────────────────────────────────
    const NAV_ITEMS = [
        { label: 'Dashboard',       icon: '⊞',  href: '/dashboard',     permiso: null              },
        { label: 'Familias',        icon: '🏠', href: '/familias',      permiso: 'puede_escribir'  },
        { label: 'Voceros',         icon: '🎙', href: '/voceros',       permiso: null              },
        { label: 'Proyectos',       icon: '📋', href: '/proyectos',     permiso: null              },
        { label: 'Beneficios',      icon: '🎁', href: '/beneficios',    permiso: null              },
        { label: 'Organizaciones',  icon: '🏛️', href: '/organizaciones', permiso: null            },
        { label: 'Pagos QR',        icon: '💳', href: '/pagos',         permiso: 'puede_validar_pagos' },
        { label: 'Cuentas de Pago', icon: '🏦', href: '/cuentas-pago',  permiso: 'puede_escribir'  },
        { label: 'Noticias',        icon: '📰', href: '/noticias',      permiso: 'puede_escribir'  },
        { label: 'Sugerencias',     icon: '💬', href: '/sugerencias',   permiso: null              },
        { label: 'Encuestas',       icon: '📝', href: '/encuestas',     permiso: 'puede_gestionar_encuestas' },
        { label: 'Mapa de Calor',   icon: '🗺️', href: '/mapa-calor',    permiso: 'puede_ver_mapa'  },
        { label: 'Auditoría',       icon: '🔍', href: '/auditoria',     permiso: 'es_admin'        },
        { label: 'Configuración',   icon: '⚙️', href: '/configuracion', permiso: 'es_admin'        },
    ];

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
        if (permiso === 'puede_escribir')      return writeBool;
        if (permiso === 'es_admin')            return adminBool;
        if (permiso === 'puede_validar_pagos') return validaPagosBool || writeBool;
        if (permiso === 'puede_ver_mapa')      return verMapaBool;
        if (permiso === 'puede_gestionar_encuestas') return gestionaEncuestasBool;
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
                            <Link to="/familias" className="topbar-btn topbar-btn--primary">
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

                    {/* Vista por rol — AdminDashboard, OperadorDashboard o VoceroDashboard.
                        Cada una incluye su propio hero + grid "¿Qué quieres hacer hoy?". */}
                    <DashboardView user={user} />

                </main>
            </div>
        </div>
    );

    function handleLogout() {
        setLoggingOut(true);
        logout().finally(() => navigate('/login', { replace: true }));
    }
}

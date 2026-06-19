/**
 * resources/js/pages/perfil/PerfilPage.jsx
 *
 * Vista de perfil personal para todos los roles.
 * Muestra los datos del usuario autenticado obtenidos
 * directamente del AuthContext — sin petición adicional al backend,
 * ya que UserResource ya expone: id, name, email, rol, permisos, created_at.
 *
 * Reutiliza el layout completo de DashboardPage (sidebar + topbar)
 * mediante la importación de DashboardPage.css.
 */

import { useState }                       from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth }                        from '../../hooks/useAuth';
import NoticiaWidget                      from '../../components/noticias/NoticiaWidget';
import SugerenciaWidget                   from '../../components/sugerencias/SugerenciaWidget';
import '../DashboardPage.css';
import './PerfilPage.css';

// Etiquetas legibles para cada rol
const ROL_LABELS = {
    admin:    'Administrador',
    operador: 'Operador',
    vocero:   'Vocero',
    usuario:  'Usuario',
};

// Íconos descriptivos para cada permiso
const PERMISOS_CONFIG = [
    { key: 'puede_leer',     label: 'Consultar registros',   icon: '👁' },
    { key: 'puede_escribir', label: 'Crear y editar datos',  icon: '✏️' },
    { key: 'puede_eliminar', label: 'Eliminar registros',    icon: '🗑' },
    { key: 'es_admin',       label: 'Acceso administrativo', icon: '🔑' },
];

export default function PerfilPage() {
    const { user, logout, isAdmin, canWrite } = useAuth();
    const navigate      = useNavigate();
    const location      = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loggingOut,  setLoggingOut]  = useState(false);

    // Booleanos defensivos — misma lógica que DashboardPage
    const adminBool = Boolean(isAdmin  ?? (user?.rol === 'admin'));
    const writeBool = Boolean(canWrite ?? (user?.rol === 'admin' || user?.rol === 'operador'));

    // ── Navegación del sidebar — idéntica a DashboardPage ─────
    const NAV_ITEMS = [
        { label: 'Dashboard',      icon: '⊞',  href: '/dashboard',      permiso: null             },
        { label: 'Familias',       icon: '🏠', href: '/familias',       permiso: null             },
        { label: 'Habitantes',     icon: '👥', href: '/habitantes',     permiso: null             },
        { label: 'Voceros',        icon: '🎙', href: '/voceros',        permiso: null             },
        { label: 'Proyectos',      icon: '📋', href: '/proyectos',      permiso: null             },
        { label: 'Beneficios',     icon: '🎁', href: '/beneficios',     permiso: null             },
        { label: 'Organizaciones', icon: '🏛️', href: '/organizaciones', permiso: null             },
        { label: 'Pagos QR',       icon: '💳', href: '/pagos',          permiso: 'puede_escribir' },
        { label: 'Noticias',       icon: '📰', href: '/noticias',       permiso: 'puede_escribir' },
        { label: 'Auditoría',      icon: '🔍', href: '/auditoria',      permiso: 'es_admin'       },
        { label: 'Configuración',  icon: '⚙️', href: '/configuracion',  permiso: 'es_admin'       },
    ];

    const itemVisible = (permiso) => {
        if (!permiso)                     return true;
        if (permiso === 'puede_escribir') return writeBool;
        if (permiso === 'es_admin')       return adminBool;
        return false;
    };

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

    // ─────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────
    return (
        <div className={`dashboard-root ${sidebarOpen ? 'dashboard-root--open' : ''}`}>

            {/* ══ SIDEBAR — idéntico al de DashboardPage ══════ */}
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

            {/* ══ ÁREA PRINCIPAL ══════════════════════════════ */}
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
                        <span className="topbar-breadcrumb__page">Mi Perfil</span>
                    </div>
                </header>

                <main className="dashboard-content" id="main-content">

                    {/* ── Encabezado de sección ──────────────── */}
                    <div className="perfil-heading">
                        <div className="perfil-heading__avatar" aria-hidden="true">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="perfil-heading__info">
                            <h1 className="perfil-heading__name">{user.name}</h1>
                            <span className={`role-badge role-badge--${user.rol} perfil-heading__badge`}>
                                {ROL_LABELS[user.rol] ?? user.rol}
                            </span>
                        </div>
                    </div>

                    {/* ── Grid de dos columnas ───────────────── */}
                    <div className="perfil-grid">

                        {/* Tarjeta: Datos personales */}
                        <section className="perfil-card" aria-label="Datos personales">
                            <header className="perfil-card__header">
                                <span className="perfil-card__header-icon" aria-hidden="true">👤</span>
                                <h2 className="perfil-card__title">Datos de la cuenta</h2>
                            </header>

                            <dl className="perfil-data-list">
                                <div className="perfil-data-list__row">
                                    <dt className="perfil-data-list__label">Nombre completo</dt>
                                    <dd className="perfil-data-list__value">{user.name}</dd>
                                </div>
                                <div className="perfil-data-list__row">
                                    <dt className="perfil-data-list__label">Correo electrónico</dt>
                                    <dd className="perfil-data-list__value">{user.email}</dd>
                                </div>
                                <div className="perfil-data-list__row">
                                    <dt className="perfil-data-list__label">Rol en el sistema</dt>
                                    <dd className="perfil-data-list__value">
                                        <span className={`role-badge role-badge--${user.rol}`}>
                                            {ROL_LABELS[user.rol] ?? user.rol}
                                        </span>
                                    </dd>
                                </div>
                                {user.created_at && (
                                    <div className="perfil-data-list__row">
                                        <dt className="perfil-data-list__label">Miembro desde</dt>
                                        <dd className="perfil-data-list__value">
                                            {new Date(user.created_at).toLocaleDateString('es-VE', {
                                                year: 'numeric', month: 'long', day: 'numeric',
                                            })}
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        </section>

                        {/* Tarjeta: Permisos del rol */}
                        <section className="perfil-card" aria-label="Permisos del rol">
                            <header className="perfil-card__header">
                                <span className="perfil-card__header-icon" aria-hidden="true">🛡</span>
                                <h2 className="perfil-card__title">Permisos asignados</h2>
                            </header>

                            <ul className="perfil-permisos-list" role="list">
                                {PERMISOS_CONFIG.map(({ key, label, icon }) => {
                                    const activo = user.permisos?.[key] ?? false;
                                    return (
                                        <li
                                            key={key}
                                            className={`perfil-permiso-item ${
                                                activo
                                                    ? 'perfil-permiso-item--activo'
                                                    : 'perfil-permiso-item--inactivo'
                                            }`}
                                        >
                                            <span className="perfil-permiso-item__icon" aria-hidden="true">
                                                {icon}
                                            </span>
                                            <span className="perfil-permiso-item__label">{label}</span>
                                            <span
                                                className={`perfil-permiso-item__estado ${
                                                    activo
                                                        ? 'perfil-permiso-item__estado--si'
                                                        : 'perfil-permiso-item__estado--no'
                                                }`}
                                                aria-label={activo ? 'Permitido' : 'No permitido'}
                                            >
                                                {activo ? '✓' : '✗'}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>

                    </div>{/* fin perfil-grid */}

                    {/* ── Últimas noticias — widget compacto ── */}
                    <NoticiaWidget />

                    {/* ── Sugerencias — widget de envío ─────── */}
                    <SugerenciaWidget />

                </main>
            </div>
        </div>
    );
}

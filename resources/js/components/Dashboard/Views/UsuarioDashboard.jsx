/**
 * resources/js/components/Dashboard/Views/UsuarioDashboard.jsx
 *
 * Portal Ciudadano — Vista ÚNICA y completa para el rol "usuario".
 *
 * HISTORIAL DE FIXES:
 *
 * FIX #1 (junio 2026): El rol "usuario" estaba mapeado a VoceroDashboard
 * en el Factory, heredando un sidebar con módulos no autorizados y
 * endpoints inexistentes (/v1/vocero/resumen, /v1/vocero/tareas) que
 * dejaban la vista en "Cargando..." indefinido. Se creó este componente
 * propio sin sidebar y sin esos endpoints rotos.
 *
 * FIX #2 (junio 2026): Aunque este componente no tiene sidebar propio,
 * seguía apareciendo el sidebar azul porque DashboardPage.jsx SIEMPRE
 * envuelve <DashboardView /> con su propio <aside>. La solución fue
 * sacar al rol "usuario" de la cadena DashboardPage → en su lugar,
 * app.jsx ahora renderiza UsuarioDashboard de forma directa e
 * independiente para ese rol, tanto en /dashboard como en /perfil.
 *
 * FIX #3 (junio 2026): /perfil y /dashboard mostraban contenido
 * redundante para el rol usuario (PerfilPage vs este componente).
 * Se fusionó todo en una sola vista: este componente ahora incluye
 * también la sección "Datos de la cuenta" y "Permisos asignados"
 * que antes vivía exclusivamente en PerfilPage.jsx. Ambas rutas
 * (/dashboard y /perfil) renderizan este mismo componente para el
 * rol usuario — cero duplicación.
 *
 * El rol "usuario" solo puede:
 *   - Ver su perfil (datos propios, ya incluidos en este componente)
 *   - Leer noticias publicadas (GET /v1/noticias/recientes — Capa 1)
 *   - Enviar y ver sus propias sugerencias (Capa 1)
 *
 * Ruta relativa a services/axios: no se usa aquí directamente —
 * los datos del usuario vienen de useAuth() (ya cacheados en Context).
 */

import { useState }          from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth }           from '../../../hooks/useAuth';
import NoticiaWidget         from '../../noticias/NoticiaWidget';
import SugerenciaWidget      from '../../sugerencias/SugerenciaWidget';
import './UsuarioDashboard.css';

// Hora del día para el saludo dinámico
const getSaludo = () => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'Buenos días';
    if (h >= 12 && h < 19) return 'Buenas tardes';
    return 'Buenas noches';
};

// Acciones que el ciudadano SÍ puede realizar
const ACCIONES_CIUDADANO = [
    {
        icon:        '💬',
        titulo:      'Enviar Sugerencia',
        descripcion: 'Comunícate con el Consejo Comunal',
        color:       'navy',
        anchor:      'sugerencias',
    },
    {
        icon:        '📰',
        titulo:      'Últimas Noticias',
        descripcion: 'Entérate de lo que pasa en tu comunidad',
        color:       'gold',
        anchor:      'noticias',
    },
    {
        icon:        '👤',
        titulo:      'Mis Datos',
        descripcion: 'Consulta tu cuenta y permisos en el sistema',
        color:       'teal',
        anchor:      'cuenta',
    },
];

// Etiquetas legibles para el rol (igual que en PerfilPage original)
const ROL_LABELS = {
    admin:    'Administrador',
    operador: 'Operador',
    vocero:   'Vocero',
    usuario:  'Usuario',
};

// Permisos del rol (igual que en PerfilPage original)
const PERMISOS_CONFIG = [
    { key: 'puede_leer',     label: 'Consultar registros',   icon: '👁' },
    { key: 'puede_escribir', label: 'Crear y editar datos',  icon: '✏️' },
    { key: 'puede_eliminar', label: 'Eliminar registros',    icon: '🗑' },
    { key: 'es_admin',       label: 'Acceso administrativo', icon: '🔑' },
];

export default function UsuarioDashboard({ user: userProp }) {
    const { user: userCtx, logout } = useAuth();
    const navigate      = useNavigate();
    const [loggingOut, setLoggingOut] = useState(false);

    // Preferimos el user del contexto; userProp es por compatibilidad
    // si algún día se vuelve a renderizar dentro de otro componente.
    const user = userCtx ?? userProp;

    if (!user) {
        navigate('/login', { replace: true });
        return null;
    }

    const handleLogout = () => {
        setLoggingOut(true);
        logout().finally(() => navigate('/login', { replace: true }));
    };

    // Desplaza suavemente a la sección correspondiente en la misma página
    const handleAnchor = (anchor) => {
        const el = document.getElementById(`portal-${anchor}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="portal-root">

            {/* ══ TOPBAR CIUDADANO ══════════════════════════════ */}
            <header className="portal-topbar">
                <div className="portal-topbar__brand">
                    <div className="portal-topbar__logo">S</div>
                    <span className="portal-topbar__name">SIGET</span>
                </div>

                <nav className="portal-topbar__nav" aria-label="Navegación ciudadana">
                    <button
                        className="portal-topbar__link"
                        onClick={() => handleAnchor('noticias')}
                    >
                        📰 Noticias
                    </button>
                    <button
                        className="portal-topbar__link"
                        onClick={() => handleAnchor('sugerencias')}
                    >
                        💬 Sugerencias
                    </button>
                    <button
                        className="portal-topbar__link"
                        onClick={() => handleAnchor('cuenta')}
                    >
                        👤 Mi Perfil
                    </button>
                </nav>

                <button
                    className="portal-topbar__logout"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    aria-label="Cerrar sesión"
                >
                    {loggingOut ? '⏳' : '→ Salir'}
                </button>
            </header>

            {/* ══ HERO ══════════════════════════════════════════ */}
            <section className="portal-hero" aria-label="Bienvenida">
                <div className="portal-hero__bg" aria-hidden="true" />
                <div className="portal-hero__content">
                    <p className="portal-hero__saludo">
                        {getSaludo()}, <strong>{user.name.split(' ')[0]}</strong> 👋
                    </p>
                    <h1 className="portal-hero__titulo">
                        Portal Ciudadano
                    </h1>
                    <p className="portal-hero__subtitulo">
                        Comunidad Ana Karina Rote 2019 · Municipio Guacaipuro
                    </p>
                </div>
            </section>

            {/* ══ CONTENIDO PRINCIPAL ═══════════════════════════ */}
            <main className="portal-main" id="main-content">

                {/* ── Tarjetas de acceso rápido ─────────────── */}
                <section className="portal-acciones" aria-label="¿Qué quieres hacer hoy?">
                    <h2 className="portal-section-title">¿Qué quieres hacer hoy?</h2>
                    <div className="portal-acciones__grid">
                        {ACCIONES_CIUDADANO.map((accion) => (
                            <button
                                key={accion.titulo}
                                className={`portal-accion-card portal-accion-card--${accion.color}`}
                                onClick={() => handleAnchor(accion.anchor)}
                            >
                                <span className="portal-accion-card__icon" aria-hidden="true">
                                    {accion.icon}
                                </span>
                                <h3 className="portal-accion-card__titulo">{accion.titulo}</h3>
                                <p className="portal-accion-card__desc">{accion.descripcion}</p>
                                <span className="portal-accion-card__arrow" aria-hidden="true">↓</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* ── Noticias ──────────────────────────────── */}
                <section
                    id="portal-noticias"
                    className="portal-widget-section"
                    aria-label="Últimas noticias"
                >
                    <NoticiaWidget />
                </section>

                {/* ── Sugerencias ───────────────────────────── */}
                <section
                    id="portal-sugerencias"
                    className="portal-widget-section"
                    aria-label="Sugerencias y quejas"
                >
                    <SugerenciaWidget />
                </section>

                {/* ── Mi Cuenta (fusionado desde PerfilPage) ─── */}
                <section
                    id="portal-cuenta"
                    className="portal-widget-section"
                    aria-label="Mi cuenta"
                >
                    <h2 className="portal-section-title">Mi Cuenta</h2>

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
                </section>

            </main>

            {/* ══ FOOTER ════════════════════════════════════════ */}
            <footer className="portal-footer">
                <p>© {new Date().getFullYear()} SIGET · Consejo Comunal Ana Karina Rote 2019</p>
            </footer>

        </div>
    );
}

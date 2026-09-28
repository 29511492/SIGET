/**
 * resources/js/components/Dashboard/Views/UsuarioDashboard.jsx
 *
 * Portal Ciudadano — Vista ÚNICA y completa para el rol "usuario".
 *
 * HISTORIAL DE FIXES:
 *
 * FIX #1 (junio 2026): el rol "usuario" estaba mapeado a VoceroDashboard
 * en el Factory, heredando un sidebar con módulos no autorizados y
 * endpoints inexistentes. Se creó este componente propio.
 *
 * FIX #2 (junio 2026): app.jsx renderiza UsuarioDashboard de forma
 * directa e independiente para el rol usuario (sin pasar por
 * DashboardPage.jsx), tanto en /dashboard como en /perfil.
 *
 * FIX #3 (junio 2026): se fusionó el contenido de PerfilPage.jsx
 * (Datos de la cuenta + Permisos) dentro de este mismo componente.
 *
 * FIX #4 (sept-2026, corrección 1 del profesor — "parece landing page"):
 * unificación de la tarjeta de acción a .dashboard-accion-card,
 * compartida con AdminDashboard.jsx y VoceroDashboard.jsx.
 *
 * FIX #5 (sept-2026, corrección 2 del profesor — "interfaz gráfica /
 * puntos focales se pierden"), esta sesión:
 *   a) El hero ahora incluye una tarjeta de identidad (carnet) con
 *      avatar, nombre, rol y comunidad — inspirado en el "carnet
 *      digital" del Sistema Patria — más una píldora de estado que
 *      avisa si el usuario tiene pagos pendientes de verificación.
 *   b) La tarjeta "Pagar por QR" del grid de acciones y su pestaña
 *      correspondiente ahora muestran un badge dinámico con el
 *      número de pagos propios pendientes/rechazados
 *      (GET /v1/pagos/mis, Capa 1).
 *   c) Las 4 secciones (Pagos, Noticias, Sugerencias, Mi Cuenta) ya
 *      NO se muestran todas en un scroll largo con anclas. Ahora hay
 *      una barra de pestañas real: se ve UNA sola sección a la vez,
 *      dentro de un panel con borde propio — así los puntos focales
 *      no se pierden entre widgets apilados.
 *
 * Ruta relativa a services/axios desde aquí:
 *   Views/ → Dashboard/ → components/ → js/ → services/axios.js
 *   '../../../services/axios' (3 niveles arriba)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate }       from 'react-router-dom';
import { useAuth }           from '../../../hooks/useAuth';
import apiClient             from '../../../services/axios';
import NoticiaWidget         from '../../noticias/NoticiaWidget';
import SugerenciaWidget      from '../../sugerencias/SugerenciaWidget';
import PagoQrWidget          from '../../pagos/PagoQrWidget';
import './UsuarioDashboard.css';

// Hora del día para el saludo dinámico
const getSaludo = () => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'Buenos días';
    if (h >= 12 && h < 19) return 'Buenas tardes';
    return 'Buenas noches';
};

// Pestañas del portal — sustituyen el scroll con anclas
const TABS = [
    { key: 'pagos',        label: 'Pagos',       icon: '📱' },
    { key: 'noticias',     label: 'Noticias',    icon: '📰' },
    { key: 'sugerencias',  label: 'Sugerencias', icon: '💬' },
    { key: 'cuenta',       label: 'Mi Cuenta',   icon: '👤' },
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
    const [loggingOut, setLoggingOut]     = useState(false);
    const [activeTab,  setActiveTab]      = useState('pagos');
    const [pagosPendientes, setPagosPendientes] = useState(0);
    // Oculta los datos personales (correo, etc.) hasta que el usuario
    // los pida explícitamente. Se resetea a oculto cada vez que se
    // sale de la pestaña "Mi Cuenta", para no dejarlos expuestos si
    // alguien más usa el dispositivo después.
    const [datosVisibles, setDatosVisibles] = useState(false);
    const panelRef = useRef(null);

    // Preferimos el user del contexto; userProp es por compatibilidad
    // si algún día se vuelve a renderizar dentro de otro componente.
    const user = userCtx ?? userProp;

    // Conteo de pagos propios pendientes o rechazados — alimenta el
    // badge del grid, el badge de la pestaña "Pagos" y la píldora de
    // estado del hero. Silencioso si falla (no bloquea el resto).
    const fetchPagosPendientes = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/v1/pagos/mis');
            const lista = data.data ?? [];
            const pendientes = lista.filter(
                (p) => p.estado === 'pendiente' || p.estado === 'rechazado'
            ).length;
            setPagosPendientes(pendientes);
        } catch {
            setPagosPendientes(0);
        }
    }, []);

    useEffect(() => {
        fetchPagosPendientes();
    }, [fetchPagosPendientes]);

    if (!user) {
        navigate('/login', { replace: true });
        return null;
    }

    const handleLogout = () => {
        setLoggingOut(true);
        logout().finally(() => navigate('/login', { replace: true }));
    };

    // Cambia de pestaña y lleva el panel a la vista (útil si el topbar
    // se usa después de haber scrolleado dentro de una pestaña larga).
    // Si se sale de "Mi Cuenta", los datos sensibles se vuelven a ocultar.
    const irATab = (key) => {
        setActiveTab(key);
        if (key !== 'cuenta') setDatosVisibles(false);
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Acciones del grid — ahora abren una pestaña en vez de hacer scroll
    const ACCIONES_CIUDADANO = [
        {
            key:         'pagos',
            icon:        '📱',
            titulo:      'Pagar por QR',
            descripcion: 'Realiza tu pago y sube el comprobante',
            color:       'navy',
            badge:       pagosPendientes,
        },
        {
            key:         'sugerencias',
            icon:        '💬',
            titulo:      'Enviar Sugerencia',
            descripcion: 'Comunícate con el Consejo Comunal',
            color:       'gold',
        },
        {
            key:         'noticias',
            icon:        '📰',
            titulo:      'Últimas Noticias',
            descripcion: 'Entérate de lo que pasa en tu comunidad',
            color:       'teal',
        },
        {
            key:         'cuenta',
            icon:        '👤',
            titulo:      'Mis Datos',
            descripcion: 'Consulta tu cuenta y permisos en el sistema',
            color:       'navy',
        },
    ];

    return (
        <div className="portal-root">

            {/* ══ TOPBAR CIUDADANO ══════════════════════════════ */}
            <header className="portal-topbar">
                <div className="portal-topbar__brand">
                    <div className="portal-topbar__logo">S</div>
                    <span className="portal-topbar__name">SIGET</span>
                </div>

                <nav className="portal-topbar__nav" aria-label="Navegación ciudadana">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            className={`portal-topbar__link ${
                                activeTab === tab.key ? 'portal-topbar__link--active' : ''
                            }`}
                            onClick={() => irATab(tab.key)}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
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
                    <h1 className="portal-hero__titulo">Portal Ciudadano</h1>
                    <p className="portal-hero__subtitulo">
                        Comunidad Ana Karina Rote 2019 · Municipio Guacaipuro
                    </p>

                    <button
                        className={`portal-hero__pill ${
                            pagosPendientes > 0
                                ? 'portal-hero__pill--alerta'
                                : 'portal-hero__pill--ok'
                        }`}
                        onClick={() => irATab('pagos')}
                    >
                        <span aria-hidden="true">{pagosPendientes > 0 ? '⏳' : '✓'}</span>
                        {pagosPendientes > 0
                            ? `${pagosPendientes} pago${pagosPendientes !== 1 ? 's' : ''} pendiente${pagosPendientes !== 1 ? 's' : ''} de verificación`
                            : 'Tus pagos están al día'}
                    </button>
                </div>

                {/* Tarjeta de identidad — estilo "carnet" */}
                <div className="portal-id-card" aria-label="Tu identificación en el sistema">
                    <div className="portal-id-card__avatar" aria-hidden="true">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="portal-id-card__name">{user.name}</p>
                    <span className="portal-id-card__role">
                        {ROL_LABELS[user.rol] ?? user.rol}
                    </span>
                    <p className="portal-id-card__email">{user.email}</p>
                </div>
            </section>

            {/* ══ CONTENIDO PRINCIPAL ═══════════════════════════ */}
            <main className="portal-main" id="main-content">

                {/* ── Tarjetas de acceso rápido ─────────────── */}
                <section className="portal-acciones" aria-label="¿Qué quieres hacer hoy?">
                    <h2 className="portal-section-title">¿Qué quieres hacer hoy?</h2>
                    <div className="dashboard-acciones__grid">
                        {ACCIONES_CIUDADANO.map((accion) => (
                            <button
                                key={accion.key}
                                className={`dashboard-accion-card dashboard-accion-card--${accion.color}`}
                                onClick={() => irATab(accion.key)}
                            >
                                {accion.badge > 0 && (
                                    <span className="dashboard-accion-card__badge">{accion.badge}</span>
                                )}
                                <span className="dashboard-accion-card__icon" aria-hidden="true">
                                    {accion.icon}
                                </span>
                                <h3 className="dashboard-accion-card__titulo">{accion.titulo}</h3>
                                <p className="dashboard-accion-card__desc">{accion.descripcion}</p>
                                <span className="dashboard-accion-card__arrow" aria-hidden="true">→</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* ══ PESTAÑAS — una sola sección visible a la vez ══
                 *  Reemplaza el scroll continuo con anclas. Cada
                 *  pestaña vive dentro de un panel con borde propio,
                 *  para que el punto focal de la página sea siempre
                 *  claro (corrección 2 del profesor).
                 * ──────────────────────────────────────────────── */}
                <section className="portal-tabs" ref={panelRef} aria-label="Secciones del portal">
                    <div className="portal-tabs__bar" role="tablist">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                role="tab"
                                aria-selected={activeTab === tab.key}
                                className={`portal-tab ${
                                    activeTab === tab.key ? 'portal-tab--active' : ''
                                }`}
                                onClick={() => irATab(tab.key)}
                            >
                                <span aria-hidden="true">{tab.icon}</span>
                                {tab.label}
                                {tab.key === 'pagos' && pagosPendientes > 0 && (
                                    <span className="portal-tab__badge">{pagosPendientes}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="portal-tabs__panel" role="tabpanel">
                        {activeTab === 'pagos' && <PagoQrWidget onPagoRegistrado={fetchPagosPendientes} />}
                        {activeTab === 'noticias' && <NoticiaWidget />}
                        {activeTab === 'sugerencias' && <SugerenciaWidget />}

                        {activeTab === 'cuenta' && (
                            <>
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

                                    {/* Tarjeta: Datos personales — oculta por defecto.
                                        El usuario puede acceder, pero no queda a simple
                                        vista al entrar a la pestaña (dato sensible). */}
                                    <section className="perfil-card" aria-label="Datos personales">
                                        <header className="perfil-card__header">
                                            <span className="perfil-card__header-icon" aria-hidden="true">👤</span>
                                            <h2 className="perfil-card__title">Datos de la cuenta</h2>
                                            {datosVisibles && (
                                                <button
                                                    type="button"
                                                    className="perfil-card__toggle"
                                                    onClick={() => setDatosVisibles(false)}
                                                >
                                                    🙈 Ocultar
                                                </button>
                                            )}
                                        </header>

                                        {datosVisibles ? (
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
                                        ) : (
                                            <div className="perfil-reveal">
                                                <span className="perfil-reveal__icon" aria-hidden="true">🔒</span>
                                                <p className="perfil-reveal__texto">
                                                    Tus datos personales están ocultos por privacidad.
                                                </p>
                                                <button
                                                    type="button"
                                                    className="perfil-reveal__btn"
                                                    onClick={() => setDatosVisibles(true)}
                                                >
                                                    👁 Mostrar mis datos
                                                </button>
                                            </div>
                                        )}
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
                            </>
                        )}
                    </div>
                </section>

            </main>

            {/* ══ FOOTER ════════════════════════════════════════ */}
            <footer className="portal-footer">
                <p>© {new Date().getFullYear()} SIGET · Consejo Comunal Ana Karina Rote 2019</p>
            </footer>

        </div>
    );
}

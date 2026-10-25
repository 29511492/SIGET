/**
 * resources/js/components/Dashboard/Views/VoceroDashboard.jsx
 *
 * CORRECCIONES DE IMPORTS (misma lógica que AdminDashboard):
 *   apiClient → '../../../services/axios'   (3 niveles arriba)
 *   No usa StatCard, así que no hay import de componentes locales.
 *
 * ENDPOINTS: '/v1/vocero/...' (sin /api, eso lo agrega baseURL)
 *
 * ─────────────────────────────────────────────────────────────────
 * FIX (septiembre 2026) — Corrección del profesor: "parece landing page"
 * ─────────────────────────────────────────────────────────────────
 * Se agregó el mismo patrón de hero + grid "¿Qué quieres hacer hoy?"
 * que AdminDashboard.jsx y UsuarioDashboard.jsx, usando las clases
 * compartidas .dashboard-hero* / .dashboard-accion-card* (definidas
 * en DashboardPage.css).
 *
 * BUG CORREGIDO: las acciones rápidas de este componente enlazaban a
 * '/familias/crear' y '/habitantes/crear' — el rol vocero NO tiene
 * acceso a Familias (Capa 3, solo admin/operador, ver sección 5.1 del
 * Documento Maestro) y la ruta /habitantes ni siquiera existe. Se
 * reemplazaron por acciones que el vocero sí puede realizar. También
 * se cambiaron los <a href> por <Link> para no recargar la SPA.
 *
 * La antigua sección "Mis Acciones" al final del componente se eliminó
 * — quedaba duplicada con el nuevo grid del hero.
 *
 * CAMBIOS (oct-2026, unificación de la pantalla de inicio del vocero):
 * El vocero entra directo a este dashboard (antes iba a /mi-comunidad).
 *  · Se quitó la tarjeta "Ver Noticias": /noticias es solo admin+operador,
 *    así que el vocero rebotaba a su inicio sin ver nada.
 *  · En su lugar se muestra el widget de últimas noticias (NoticiaWidget,
 *    las 3 más recientes) al final del dashboard.
 *  · La tarjeta "Cargar Pago QR" (/pagos/nuevo) se cambió por "Validar
 *    Pagos" (/pagos): el vocero valida pagos (Corrección 3 del profesor),
 *    pero /pagos/nuevo usa POST /pagos (flujo admin/operador) y su
 *    formulario exige un habitante_id que el usuario no recibe.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../../services/axios'; // ← 3 niveles arriba
import NoticiaWidget from '../../noticias/NoticiaWidget';

const ESTADO_CONFIG = {
    completado:  { label: 'Completado',  cls: 'badge--green' },
    en_progreso: { label: 'En progreso', cls: 'badge--amber' },
    pendiente:   { label: 'Pendiente',   cls: 'badge--gray'  },
    critico:     { label: 'Crítico',     cls: 'badge--red'   },
};

// Saludo dinámico según hora del día — mismo criterio que AdminDashboard/UsuarioDashboard
const getSaludo = () => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'Buenos días';
    if (h >= 12 && h < 19) return 'Buenas tardes';
    return 'Buenas noches';
};

// Acciones que el rol vocero SÍ puede realizar (sin Familias/Habitantes)
const ACCIONES_VOCERO = [
    {
        titulo: 'Validar Pagos',
        desc:   'Verifica o rechaza los comprobantes de pago pendientes',
        icon:   '💳',
        color:  'navy',
        href:   '/pagos',
    },
    {
        titulo: 'Ver Voceros',
        desc:   'Consulta el listado de voceros de tu comité',
        icon:   '🎙',
        color:  'gold',
        href:   '/voceros',
    },
    {
        titulo: 'Ver Sugerencias',
        desc:   'Revisa las sugerencias registradas en el sistema',
        icon:   '💬',
        color:  'teal',
        href:   '/sugerencias',
    },
    // Oct-2026 (georreferenciación)
    {
        titulo: 'Mapa de Calor',
        desc:   'Consulta el estado de las encuestas en las calles de tu sector',
        icon:   '🗺️',
        color:  'purple',
        href:   '/mapa-calor',
    },
];

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

            {/* ══ HERO ══════════════════════════════════════════ */}
            <div className="dashboard-hero">
                <div className="dashboard-hero__bg" aria-hidden="true" />
                <div className="dashboard-hero__content">
                    <p className="dashboard-hero__saludo">
                        {getSaludo()}, <strong>{user?.name?.split(' ')[0] ?? 'Vocero'}</strong> 👋
                    </p>
                    <h1 className="dashboard-hero__titulo">Mi Comunidad</h1>
                    <p className="dashboard-hero__subtitulo">
                        {resumen?.nombre_sede
                            ? `Sede: ${resumen.nombre_sede}`
                            : 'Cargando datos de tu sector...'}
                    </p>
                </div>
            </div>

            {error && (
                <div className="dashboard-error" role="alert">
                    <span>⚠</span>
                    <span>{error}</span>
                    <button onClick={fetchData} className="dashboard-error__retry">
                        Reintentar
                    </button>
                </div>
            )}

            {/* ══ ACCIONES — "¿Qué quieres hacer hoy?" ═══════════ */}
            <section className="dashboard-acciones" aria-label="¿Qué quieres hacer hoy?">
                <h2 className="dashboard-acciones__title">¿Qué quieres hacer hoy?</h2>
                <div className="dashboard-acciones__grid">
                    {ACCIONES_VOCERO.map((accion) => (
                        <Link
                            key={accion.titulo}
                            to={accion.href}
                            className={`dashboard-accion-card dashboard-accion-card--${accion.color}`}
                        >
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

            {/* ══ RESUMEN DEL SECTOR ══════════════════════════════ */}
            <section className="dashboard-resumen">
                <h2 className="dashboard-resumen__title">Resumen de tu sector</h2>
                <div className="vocero-stats">
                    {[
                        { id: 'familias',   label: 'Familias en mi sector',   value: resumen?.familias_sector   ?? '—', icon: '🏠' },
                        { id: 'habitantes', label: 'Habitantes registrados',  value: resumen?.habitantes_sector ?? '—', icon: '👥' },
                        { id: 'pagos',      label: 'Pagos QR pendientes',     value: resumen?.pagos_pendientes  ?? '—', icon: '📄' },
                    ].map((item) => {
                        // FIX (sept-2026, corrección 2 — puntos focales): los
                        // pagos pendientes necesitan resaltar sobre las otras
                        // dos métricas, que son solo informativas.
                        const esUrgente = item.id === 'pagos' && Number(item.value) > 0;
                        return (
                            <div
                                key={item.label}
                                className={`vocero-stat-item ${esUrgente ? 'vocero-stat-item--urgente' : ''}`}
                            >
                                <span className="vocero-stat-item__icon">{item.icon}</span>
                                <p className="vocero-stat-item__value">
                                    {loading ? <span className="skeleton-text" /> : item.value}
                                </p>
                                <p className="vocero-stat-item__label">{item.label}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

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

            {/* ══ ÚLTIMAS NOTICIAS ═══════════════════════════════ */}
            <NoticiaWidget />
        </section>
    );
}

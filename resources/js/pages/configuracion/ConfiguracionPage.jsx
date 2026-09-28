/**
 * resources/js/pages/configuracion/ConfiguracionPage.jsx — SIGET
 *
 * Corrección del profesor (sept-2026): los roles no pueden gestionarse
 * "por base de datos" — debe existir un módulo de configuración.
 *
 * Solo admin (doble capa):
 *   1. <ProtectedRoute allowedRoles={['admin']}> en app.jsx (UX)
 *   2. role:admin en las rutas /v1/usuarios y /v1/configuracion (backend)
 *
 * Pestañas:
 *   · Usuarios y roles   → listado, cambio de rol, activar/desactivar,
 *                          desbloquear cuentas. Todo con confirmación.
 *   · Matriz de permisos → SOLO LECTURA. La genera el backend a partir
 *                          de las rutas reales, así que nunca miente.
 *
 * Endpoints:
 *   GET   /v1/usuarios                 (search, rol, estado, page, per_page)
 *   PATCH /v1/usuarios/{id}/rol        { rol }
 *   PATCH /v1/usuarios/{id}/estado     { activo }
 *   PATCH /v1/usuarios/{id}/desbloquear
 *   GET   /v1/configuracion/permisos
 *
 * Patrón de puntos focales (Documento Maestro 9.8): chip de conteo,
 * botón primario con sombra, fila de atención (cuenta bloqueada) y fila
 * atenuada (cuenta inactiva). CSS autónomo (prefijo cfg-).
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../../hooks/useAuth';
import apiClient       from '../../services/axios';
import ConfirmModal    from '../../components/ui/ConfirmModal';
import './ConfiguracionPage.css';

const ROLES = [
    { value: 'admin',    label: 'Administrador' },
    { value: 'operador', label: 'Operador'      },
    { value: 'vocero',   label: 'Vocero'        },
    { value: 'usuario',  label: 'Ciudadano'     },
];

const ESTADOS = [
    { value: '',          label: 'Todos los estados' },
    { value: 'activo',    label: 'Activos'           },
    { value: 'bloqueado', label: 'Bloqueados'        },
    { value: 'inactivo',  label: 'Inactivos'         },
];

const PERMISOS = [
    { key: 'lectura',     label: 'Leer'     },
    { key: 'escritura',   label: 'Escribir' },
    { key: 'eliminacion', label: 'Eliminar' },
];

const etiquetaRol = (valor) => ROLES.find((r) => r.value === valor)?.label ?? valor;

// Textos y variante del modal de confirmación según la acción pendiente
const configConfirmacion = (p) => {
    if (!p) return {};
    const nombre = p.usuario.name;

    switch (p.tipo) {
        case 'rol':
            return {
                title:        'Cambiar rol de usuario',
                message:      `¿Cambiar el rol de ${nombre} de ${etiquetaRol(p.usuario.rol)} a ${etiquetaRol(p.rol)}?`,
                detail:       'Se cerrará su sesión activa y deberá iniciar sesión otra vez. El cambio queda registrado en Auditoría.',
                confirmLabel: 'Sí, cambiar rol',
                variant:      'warning',
            };
        case 'desactivar':
            return {
                title:        'Desactivar cuenta',
                message:      `¿Desactivar la cuenta de ${nombre}?`,
                detail:       'No podrá iniciar sesión. Sus registros históricos se conservan y puedes reactivarla cuando quieras.',
                confirmLabel: 'Sí, desactivar',
                variant:      'danger',
            };
        case 'activar':
            return {
                title:        'Reactivar cuenta',
                message:      `¿Reactivar la cuenta de ${nombre}?`,
                detail:       'Podrá iniciar sesión de nuevo con su rol actual.',
                confirmLabel: 'Sí, reactivar',
                variant:      'warning',
            };
        case 'desbloquear':
            return {
                title:        'Desbloquear cuenta',
                message:      `¿Desbloquear la cuenta de ${nombre}?`,
                detail:       'Se reinician sus intentos fallidos y podrá iniciar sesión.',
                confirmLabel: 'Sí, desbloquear',
                variant:      'warning',
            };
        default:
            return {};
    }
};

// ─────────────────────────────────────────────────────────────
//  Matriz de permisos (solo lectura)
// ─────────────────────────────────────────────────────────────
function MatrizPermisos({ estado, matriz, onReintentar, conteos }) {
    if (estado === 'loading' || estado === 'idle') {
        return (
            <div className="cfg-estado">
                <span className="cfg-spinner" aria-hidden="true" />
                <p>Generando la matriz de permisos...</p>
            </div>
        );
    }

    if (estado === 'error' || !matriz) {
        return (
            <div className="cfg-alert cfg-alert--error" role="alert">
                <span>⚠</span> No se pudo cargar la matriz de permisos.
                <button type="button" className="cfg-alert__retry" onClick={onReintentar}>
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="cfg-roles-grid">
                {matriz.roles.map((rol) => (
                    <article key={rol.clave} className={`cfg-rol-card cfg-rol-card--${rol.clave}`}>
                        <header className="cfg-rol-card__header">
                            <h3 className="cfg-rol-card__titulo">{rol.etiqueta}</h3>
                            {conteos?.[rol.clave] !== undefined && (
                                <span className="cfg-rol-card__conteo">
                                    {conteos[rol.clave]} {conteos[rol.clave] === 1 ? 'cuenta' : 'cuentas'}
                                </span>
                            )}
                        </header>
                        <p className="cfg-rol-card__desc">{rol.descripcion}</p>
                    </article>
                ))}
            </div>

            <div className="cfg-table-wrap">
                <table className="cfg-table cfg-table--matriz">
                    <caption className="cfg-sr-only">
                        Permisos de cada rol por módulo del sistema
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col">Módulo</th>
                            {matriz.roles.map((rol) => (
                                <th key={rol.clave} scope="col">{rol.etiqueta}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {matriz.modulos.map((modulo) => (
                            <tr key={modulo.clave}>
                                <th scope="row" className="cfg-table__modulo">{modulo.etiqueta}</th>
                                {matriz.roles.map((rol) => {
                                    const permisos = modulo.permisos[rol.clave] ?? {};
                                    const activos  = PERMISOS.filter((p) => permisos[p.key]);
                                    return (
                                        <td key={rol.clave}>
                                            {activos.length === 0 ? (
                                                <span className="cfg-perm cfg-perm--none">Sin acceso</span>
                                            ) : (
                                                <div className="cfg-perm-list">
                                                    {activos.map((p) => (
                                                        <span
                                                            key={p.key}
                                                            className={`cfg-perm cfg-perm--${p.key}`}
                                                        >
                                                            {p.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="cfg-nota">
                Esta matriz se genera en vivo a partir de las rutas reales de la API
                (<code>routes/api.php</code>): si una ruta cambia de capa, la matriz
                cambia con ella. Para el rol Ciudadano, «Escribir» en Pagos y
                Sugerencias corresponde a sus propios registros (Portal Ciudadano).
            </p>
        </>
    );
}

// ─────────────────────────────────────────────────────────────
//  Página principal
// ─────────────────────────────────────────────────────────────
export default function ConfiguracionPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [tab, setTab] = useState('usuarios');

    // ── Listado de usuarios ─────────────────────────────────
    const [usuarios, setUsuarios] = useState([]);
    const [meta,     setMeta]     = useState(null);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState(null);
    const [page,     setPage]     = useState(1);

    // ── Filtros ─────────────────────────────────────────────
    const [busquedaInput, setBusquedaInput] = useState('');
    const [busqueda,      setBusqueda]      = useState('');
    const [filtroRol,     setFiltroRol]     = useState('');
    const [filtroEstado,  setFiltroEstado]  = useState('');

    // ── Acción pendiente de confirmar ───────────────────────
    const [pendiente,  setPendiente]  = useState(null); // { tipo, usuario, rol? }
    const [procesando, setProcesando] = useState(false);
    const [aviso,      setAviso]      = useState(null); // { tipo: 'ok'|'error', texto }

    // ── Matriz de permisos (carga perezosa) ─────────────────
    const [matriz,       setMatriz]       = useState(null);
    const [matrizEstado, setMatrizEstado] = useState('idle'); // idle|loading|ok|error

    const resumen = meta?.resumen ?? null;

    // ── Carga de usuarios ───────────────────────────────────
    const cargarUsuarios = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                page,
                per_page: 15,
                ...(busqueda     && { search: busqueda }),
                ...(filtroRol    && { rol:    filtroRol }),
                ...(filtroEstado && { estado: filtroEstado }),
            };
            const { data } = await apiClient.get('/v1/usuarios', { params });
            setUsuarios(data.data);
            setMeta(data.meta);
        } catch (err) {
            setError(err.response?.data?.message ?? 'No se pudo cargar la lista de usuarios.');
        } finally {
            setLoading(false);
        }
    }, [page, busqueda, filtroRol, filtroEstado]);

    useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);

    // Búsqueda con debounce: evita una petición por cada tecla
    useEffect(() => {
        const t = setTimeout(() => {
            setBusqueda(busquedaInput.trim());
            setPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [busquedaInput]);

    // Aviso temporal (éxito / error de la última acción)
    useEffect(() => {
        if (!aviso) return undefined;
        const t = setTimeout(() => setAviso(null), 6000);
        return () => clearTimeout(t);
    }, [aviso]);

    // ── Carga perezosa de la matriz ─────────────────────────
    const cargarMatriz = useCallback(async () => {
        setMatrizEstado('loading');
        try {
            const { data } = await apiClient.get('/v1/configuracion/permisos');
            setMatriz(data.data);
            setMatrizEstado('ok');
        } catch {
            setMatrizEstado('error');
        }
    }, []);

    useEffect(() => {
        if (tab === 'matriz' && matrizEstado === 'idle') cargarMatriz();
    }, [tab, matrizEstado, cargarMatriz]);

    // ── Filtros ─────────────────────────────────────────────
    const cambiarFiltroRol = (valor) => { setFiltroRol(valor); setPage(1); };
    const cambiarFiltroEstado = (valor) => { setFiltroEstado(valor); setPage(1); };

    const limpiarFiltros = () => {
        setBusquedaInput('');
        setBusqueda('');
        setFiltroRol('');
        setFiltroEstado('');
        setPage(1);
    };

    const hayFiltros = Boolean(busqueda || filtroRol || filtroEstado);

    // ── Acciones ────────────────────────────────────────────
    const esYo = (u) => u.id === user?.id;

    const pedirCambioRol = (usuario, rol) => {
        if (rol === usuario.rol) return;
        setPendiente({ tipo: 'rol', usuario, rol });
    };

    const confirmarAccion = async () => {
        if (!pendiente) return;
        const { tipo, usuario, rol } = pendiente;

        setProcesando(true);
        try {
            let res;
            if (tipo === 'rol') {
                res = await apiClient.patch(`/v1/usuarios/${usuario.id}/rol`, { rol });
            } else if (tipo === 'desbloquear') {
                res = await apiClient.patch(`/v1/usuarios/${usuario.id}/desbloquear`);
            } else {
                res = await apiClient.patch(`/v1/usuarios/${usuario.id}/estado`, {
                    activo: tipo === 'activar',
                });
            }
            setAviso({ tipo: 'ok', texto: res.data.message });
            setPendiente(null);
            await cargarUsuarios();
        } catch (err) {
            setAviso({
                tipo:  'error',
                texto: err.response?.data?.message ?? 'No se pudo completar la acción.',
            });
            setPendiente(null);
        } finally {
            setProcesando(false);
        }
    };

    // ── Render ──────────────────────────────────────────────
    const confirmacion = configConfirmacion(pendiente);

    return (
        <div className="cfg-page">

            <header className="cfg-topbar">
                <button type="button" className="cfg-topbar__back" onClick={() => navigate('/dashboard')}>
                    ← Dashboard
                </button>
                <div className="cfg-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Configuración</span>
                </div>
            </header>

            <div className="cfg-container">

                <div className="cfg-heading">
                    <div>
                        <h1 className="cfg-heading__title">Configuración</h1>
                        <p className="cfg-heading__subtitle">
                            {resumen ? (
                                <span className="cfg-count">
                                    🛡️ {resumen.activos} {resumen.activos === 1 ? 'cuenta activa' : 'cuentas activas'}
                                </span>
                            ) : 'Cargando...'}
                            {' '}Roles de acceso y estado de las cuentas del sistema
                        </p>
                    </div>
                </div>

                {/* ── Pestañas ─────────────────────────────── */}
                <div className="cfg-tabs" role="tablist" aria-label="Secciones de configuración">
                    <button
                        type="button"
                        role="tab"
                        id="cfg-tab-usuarios"
                        aria-selected={tab === 'usuarios'}
                        aria-controls="cfg-panel-usuarios"
                        className={`cfg-tab ${tab === 'usuarios' ? 'cfg-tab--active' : ''}`}
                        onClick={() => setTab('usuarios')}
                    >
                        Usuarios y roles
                        {resumen?.bloqueados > 0 && (
                            <span className="cfg-tab__badge" title="Cuentas bloqueadas">
                                {resumen.bloqueados}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        id="cfg-tab-matriz"
                        aria-selected={tab === 'matriz'}
                        aria-controls="cfg-panel-matriz"
                        className={`cfg-tab ${tab === 'matriz' ? 'cfg-tab--active' : ''}`}
                        onClick={() => setTab('matriz')}
                    >
                        Matriz de permisos
                    </button>
                </div>

                {aviso && (
                    <div
                        className={`cfg-aviso cfg-aviso--${aviso.tipo}`}
                        role={aviso.tipo === 'error' ? 'alert' : 'status'}
                    >
                        <span aria-hidden="true">{aviso.tipo === 'ok' ? '✓' : '⚠'}</span>
                        <span>{aviso.texto}</span>
                        <button
                            type="button"
                            className="cfg-aviso__cerrar"
                            onClick={() => setAviso(null)}
                            aria-label="Cerrar aviso"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* ══ PESTAÑA: USUARIOS Y ROLES ═════════════════ */}
                {tab === 'usuarios' && (
                    <section id="cfg-panel-usuarios" role="tabpanel" aria-labelledby="cfg-tab-usuarios">

                        {resumen && (
                            <div className="cfg-chips" aria-label="Resumen de cuentas">
                                {ROLES.map((r) => (
                                    <button
                                        key={r.value}
                                        type="button"
                                        className={`cfg-chip ${filtroRol === r.value ? 'cfg-chip--active' : ''}`}
                                        onClick={() => cambiarFiltroRol(filtroRol === r.value ? '' : r.value)}
                                        aria-pressed={filtroRol === r.value}
                                    >
                                        {r.label} <strong>{resumen.por_rol[r.value] ?? 0}</strong>
                                    </button>
                                ))}
                                {resumen.bloqueados > 0 && (
                                    <button
                                        type="button"
                                        className={`cfg-chip cfg-chip--alerta ${filtroEstado === 'bloqueado' ? 'cfg-chip--active' : ''}`}
                                        onClick={() => cambiarFiltroEstado(filtroEstado === 'bloqueado' ? '' : 'bloqueado')}
                                        aria-pressed={filtroEstado === 'bloqueado'}
                                    >
                                        🔒 Bloqueadas <strong>{resumen.bloqueados}</strong>
                                    </button>
                                )}
                                {resumen.inactivos > 0 && (
                                    <button
                                        type="button"
                                        className={`cfg-chip ${filtroEstado === 'inactivo' ? 'cfg-chip--active' : ''}`}
                                        onClick={() => cambiarFiltroEstado(filtroEstado === 'inactivo' ? '' : 'inactivo')}
                                        aria-pressed={filtroEstado === 'inactivo'}
                                    >
                                        Inactivas <strong>{resumen.inactivos}</strong>
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="cfg-filters">
                            <input
                                type="search"
                                className="cfg-filters__input"
                                placeholder="Buscar por nombre, correo o cédula"
                                value={busquedaInput}
                                onChange={(e) => setBusquedaInput(e.target.value)}
                                maxLength={100}
                                aria-label="Buscar usuarios"
                            />
                            <select
                                className="cfg-filters__select"
                                value={filtroRol}
                                onChange={(e) => cambiarFiltroRol(e.target.value)}
                                aria-label="Filtrar por rol"
                            >
                                <option value="">Todos los roles</option>
                                {ROLES.map((r) => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                            <select
                                className="cfg-filters__select"
                                value={filtroEstado}
                                onChange={(e) => cambiarFiltroEstado(e.target.value)}
                                aria-label="Filtrar por estado"
                            >
                                {ESTADOS.map((e) => (
                                    <option key={e.value} value={e.value}>{e.label}</option>
                                ))}
                            </select>
                            {hayFiltros && (
                                <button type="button" className="cfg-btn cfg-btn--ghost" onClick={limpiarFiltros}>
                                    Limpiar
                                </button>
                            )}
                        </div>

                        {error && (
                            <div className="cfg-alert cfg-alert--error" role="alert">
                                <span>⚠</span> {error}
                                <button type="button" className="cfg-alert__retry" onClick={cargarUsuarios}>
                                    Reintentar
                                </button>
                            </div>
                        )}

                        <div className="cfg-table-wrap">
                            {loading ? (
                                <div className="cfg-estado">
                                    <span className="cfg-spinner" aria-hidden="true" />
                                    <p>Cargando usuarios...</p>
                                </div>
                            ) : usuarios.length === 0 ? (
                                <div className="cfg-estado">
                                    <span aria-hidden="true">🛡️</span>
                                    <p>No hay usuarios con los filtros seleccionados.</p>
                                </div>
                            ) : (
                                <table className="cfg-table">
                                    <thead>
                                        <tr>
                                            <th scope="col">Usuario</th>
                                            <th scope="col">Rol</th>
                                            <th scope="col">Estado</th>
                                            <th scope="col">Alta</th>
                                            <th scope="col" className="cfg-table__acciones">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {usuarios.map((u) => {
                                            const yo = esYo(u);
                                            const claseFila = [
                                                !u.activo && 'tr-inactive',
                                                u.activo && u.is_locked && 'fila-atencion',
                                            ].filter(Boolean).join(' ');

                                            return (
                                                <tr key={u.id} className={claseFila}>
                                                    <td>
                                                        <div className="cfg-usuario">
                                                            <span className="cfg-usuario__nombre">
                                                                {u.name}
                                                                {yo && <span className="cfg-tag">Tú</span>}
                                                            </span>
                                                            <span className="cfg-usuario__email">{u.email}</span>
                                                            {u.cedula && (
                                                                <span className="cfg-usuario__cedula">C.I. {u.cedula}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <select
                                                            className={`cfg-rol-select cfg-rol-select--${u.rol}`}
                                                            value={u.rol}
                                                            onChange={(e) => pedirCambioRol(u, e.target.value)}
                                                            disabled={yo || !u.activo}
                                                            aria-label={`Rol de ${u.name}`}
                                                            title={yo ? 'No puedes cambiar tu propio rol' : undefined}
                                                        >
                                                            {ROLES.map((r) => (
                                                                <option key={r.value} value={r.value}>{r.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        {!u.activo ? (
                                                            <span className="cfg-badge cfg-badge--inactivo">Inactiva</span>
                                                        ) : u.is_locked ? (
                                                            <span className="cfg-badge cfg-badge--bloqueado">🔒 Bloqueada</span>
                                                        ) : (
                                                            <span className="cfg-badge cfg-badge--activo">Activa</span>
                                                        )}
                                                    </td>
                                                    <td className="cfg-table__fecha">{u.created_at ?? '—'}</td>
                                                    <td className="cfg-table__acciones">
                                                        {u.activo && u.is_locked && (
                                                            <button
                                                                type="button"
                                                                className="cfg-btn cfg-btn--primary cfg-btn--sm"
                                                                onClick={() => setPendiente({ tipo: 'desbloquear', usuario: u })}
                                                            >
                                                                Desbloquear
                                                            </button>
                                                        )}
                                                        {!yo && u.activo && (
                                                            <button
                                                                type="button"
                                                                className="cfg-btn cfg-btn--danger-ghost cfg-btn--sm"
                                                                onClick={() => setPendiente({ tipo: 'desactivar', usuario: u })}
                                                            >
                                                                Desactivar
                                                            </button>
                                                        )}
                                                        {!yo && !u.activo && (
                                                            <button
                                                                type="button"
                                                                className="cfg-btn cfg-btn--ghost cfg-btn--sm"
                                                                onClick={() => setPendiente({ tipo: 'activar', usuario: u })}
                                                            >
                                                                Reactivar
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {meta && meta.last_page > 1 && (
                            <nav className="cfg-pagination" aria-label="Paginación de usuarios">
                                <button
                                    type="button"
                                    className="cfg-btn cfg-btn--ghost cfg-btn--sm"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page <= 1 || loading}
                                >
                                    ← Anterior
                                </button>
                                <span className="cfg-pagination__info">
                                    Página {meta.current_page} de {meta.last_page}
                                    {' '}· {meta.total} {meta.total === 1 ? 'resultado' : 'resultados'}
                                </span>
                                <button
                                    type="button"
                                    className="cfg-btn cfg-btn--ghost cfg-btn--sm"
                                    onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                                    disabled={page >= meta.last_page || loading}
                                >
                                    Siguiente →
                                </button>
                            </nav>
                        )}
                    </section>
                )}

                {/* ══ PESTAÑA: MATRIZ DE PERMISOS ═══════════════ */}
                {tab === 'matriz' && (
                    <section id="cfg-panel-matriz" role="tabpanel" aria-labelledby="cfg-tab-matriz">
                        <MatrizPermisos
                            estado={matrizEstado}
                            matriz={matriz}
                            onReintentar={() => setMatrizEstado('idle')}
                            conteos={resumen?.por_rol}
                        />
                    </section>
                )}
            </div>

            <ConfirmModal
                isOpen={!!pendiente}
                title={confirmacion.title}
                message={confirmacion.message}
                detail={confirmacion.detail}
                confirmLabel={confirmacion.confirmLabel}
                variant={confirmacion.variant}
                onConfirm={confirmarAccion}
                onCancel={() => setPendiente(null)}
                isLoading={procesando}
            />
        </div>
    );
}

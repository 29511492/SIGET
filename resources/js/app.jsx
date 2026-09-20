/**
 * resources/js/app.jsx — SIGET
 */

import './bootstrap';
import '../css/app.css';
import './i18n/index.js';

import React, { Component } from 'react';
import { createRoot }       from 'react-dom/client';
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
} from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { useAuth }      from './hooks/useAuth';

// Páginas
import Login            from './pages/auth/Login';
import DashboardPage    from './pages/DashboardPage';
import FamiliaList      from './pages/familias/FamiliaList';
import VoceroForm       from './pages/voceros/VoceroForm';
import VoceroList       from './pages/voceros/VoceroList';
import ProyectoForm     from './pages/proyecto/ProyectoForm';
import ProyectoList     from './pages/proyecto/ProyectoList';
import BeneficioList    from './pages/beneficio/BeneficioList';
import BeneficioForm    from './pages/beneficio/BeneficioForm';
import AuditoriaList    from './pages/auditoria/AuditoriaList';
import OrganizacionForm from './pages/organizacion/OrganizacionForm';
import OrganizacionList from './pages/organizacion/OrganizacionList';
import PagoForm         from './pages/pagos/PagoForm';
import PagoList         from './pages/pagos/PagoList';
import ComunicadoForm   from './pages/comunicados/ComunicadoForm';
import ComunicadoList   from './pages/comunicados/ComunicadoList';
import ComunicadoDetail from './pages/comunicados/ComunicadoDetail';
import ComunicadoEdit   from './pages/comunicados/ComunicadoEdit';
import PerfilPage       from './pages/perfil/PerfilPage';
import MiComunidad      from './pages/voceros/MiComunidad';
import NoticiaList      from './pages/noticias/NoticiaList';
import NoticiaForm      from './pages/noticias/NoticiaForm';
import SugerenciaPanel  from './pages/sugerencias/SugerenciaPanel';

// ─────────────────────────────────────────────────────────────
//  Mapa de redirección por rol — fuente única de verdad.
//  Usado tanto en PublicRoute como en Login.jsx.
// ─────────────────────────────────────────────────────────────
const REDIRECT_BY_ROL = {
    admin:    '/dashboard',
    operador: '/dashboard',
    vocero:   '/mi-comunidad',
    usuario:  '/perfil',
};

// ─────────────────────────────────────────────────────────────
//  ErrorBoundary — captura crashes de render y muestra un mensaje
//  en vez de pantalla blanca. NUNCA eliminar en producción.
// ─────────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        // En desarrollo, Vite ya muestra el overlay; esto ayuda en producción
        console.error('[SIGET ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'DM Sans, sans-serif', background: '#f8f6f1',
                    padding: '2rem', gap: '1rem',
                }}>
                    <h1 style={{ color: '#0d1f35', fontSize: '1.5rem' }}>
                        Error en SIGET
                    </h1>
                    <p style={{ color: '#4a5568', fontSize: '0.9rem', maxWidth: 500, textAlign: 'center' }}>
                        Ocurrió un error inesperado. Abre la consola del navegador
                        (F12 → Console) para ver el detalle exacto.
                    </p>
                    <pre style={{
                        background: '#fee2e2', color: '#991b1b', borderRadius: 8,
                        padding: '1rem', fontSize: '0.78rem', maxWidth: 600,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                        {this.state.error?.message}
                    </pre>
                    <button
                        onClick={() => window.location.href = '/login'}
                        style={{
                            background: '#0d1f35', color: '#fff', border: 'none',
                            borderRadius: 8, padding: '0.65rem 1.5rem',
                            cursor: 'pointer', fontFamily: 'inherit',
                        }}
                    >
                        Volver al login
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// ─────────────────────────────────────────────────────────────
//  ProtectedRoute
//  Bloquea el render mientras AuthContext está resolviendo
//  la rehidratación (isLoading=true). Solo evalúa `user`
//  cuando isLoading ya es false, evitando la condición de
//  carrera que causaba el bucle.
//
//  NOTA: la corrección principal está en AuthContext.jsx.
//  isLoading arranca como `true` y solo pasa a `false` en el
//  .finally() de GET /me. Esta guarda aquí es la segunda línea
//  de defensa.
// ─────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children, allowedRoles = null }) => {
    const { user, isLoading } = useAuth();

    // Mientras AuthContext no termine de rehidratar, mostrar
    // pantalla de carga — NUNCA redirigir todavía.
    if (isLoading) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: '100vh', fontFamily: 'DM Sans, sans-serif',
                color: '#718096', fontSize: '0.9rem',
            }}>
                Cargando sistema...
            </div>
        );
    }

    // isLoading === false: el estado de auth ya es definitivo
    if (!user) return <Navigate to="/login" replace />;

    if (allowedRoles && !allowedRoles.includes(user.rol)) {
        // Rol sin permiso para esta ruta → redirigir a su destino
        const destino = REDIRECT_BY_ROL[user.rol] ?? '/dashboard';
        return <Navigate to={destino} replace />;
    }

    return children;
};

// ─────────────────────────────────────────────────────────────
//  ✅ FIX #1 — PublicRoute (NUEVO)
//  Envuelve las rutas públicas (/login, /register, etc.).
//  Si el usuario ya tiene sesión activa, lo redirige a su
//  destino según el rol en lugar de mostrar el formulario.
//  Mientras isLoading=true, no renderiza nada (null) para
//  evitar un flash del formulario antes de saber si hay sesión.
// ─────────────────────────────────────────────────────────────
const PublicRoute = ({ children }) => {
    const { user, isLoading } = useAuth();

    // Esperar a que AuthContext termine antes de decidir
    if (isLoading) return null;

    // Sesión activa → redirigir según rol, nunca mostrar el login
    if (user) {
        const destino = REDIRECT_BY_ROL[user.rol] ?? '/dashboard';
        return <Navigate to={destino} replace />;
    }

    return children;
};

// ─────────────────────────────────────────────────────────────
//  App
// ─────────────────────────────────────────────────────────────
const App = () => (
    <ErrorBoundary>
        <AuthProvider>
            <BrowserRouter>
                <Routes>

                    {/* ══ PÚBLICAS — protegidas con PublicRoute ════════════════
                        Evita que un usuario logueado vea /login nuevamente.   */}
                    <Route path="/login" element={
                        <PublicRoute><Login /></PublicRoute>
                    } />
                    {/* Registro y recuperación de contraseña ahora
                        son pasos internos del wizard en /login.
                        Estos redirects evitan que URLs viejas queden
                        accesibles o en el historial del navegador. */}
                    <Route path="/register"          element={<Navigate to="/login" replace />} />
                    <Route path="/forgot-password"   element={<Navigate to="/login" replace />} />
                    <Route path="/reset-password"    element={<Navigate to="/login" replace />} />

                    {/* Raíz → login (PublicRoute la redirigirá al dashboard
                        si ya hay sesión activa)                              */}
                    <Route path="/" element={
                        <PublicRoute><Navigate to="/login" replace /></PublicRoute>
                    } />


                    {/* ══ PRIVADAS — TODOS LOS ROLES ══════════════════════════ */}

                    <Route path="/dashboard" element={
                        <ProtectedRoute>
                            <DashboardPage />
                        </ProtectedRoute>
                    } />

                    <Route path="/familias" element={
                        <ProtectedRoute>
                            <FamiliaList />
                        </ProtectedRoute>
                    } />

                    <Route path="/voceros" element={
                        <ProtectedRoute>
                            <VoceroList />
                        </ProtectedRoute>
                    } />

                    <Route path="/proyectos" element={
                        <ProtectedRoute>
                            <ProyectoList />
                        </ProtectedRoute>
                    } />

                    <Route path="/beneficios" element={
                        <ProtectedRoute>
                            <BeneficioList />
                        </ProtectedRoute>
                    } />

                    <Route path="/organizaciones" element={
                        <ProtectedRoute>
                            <OrganizacionList />
                        </ProtectedRoute>
                    } />

                    <Route path="/pagos" element={
                        <ProtectedRoute>
                            <PagoList />
                        </ProtectedRoute>
                    } />


                    {/* ══ PRIVADAS — ADMIN + OPERADOR ═════════════════════════
                        NOTA: /familias/crear fue eliminada — el registro de
                        familias ahora es un modal dentro de /familias
                        (FamiliaList.jsx → FormModal → FamiliaForm.jsx).     */}

                    <Route path="/voceros/crear" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <VoceroForm />
                        </ProtectedRoute>
                    } />

                    <Route path="/proyectos/crear" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <ProyectoForm />
                        </ProtectedRoute>
                    } />

                    <Route path="/proyectos/editar/:id" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <ProyectoForm />
                        </ProtectedRoute>
                    } />

                    <Route path="/beneficios/nuevo" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <BeneficioForm />
                        </ProtectedRoute>
                    } />

                    <Route path="/auditoria" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <AuditoriaList />
                        </ProtectedRoute>
                    } />

                    <Route path="/organizaciones/crear" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <OrganizacionForm />
                        </ProtectedRoute>
                    } />

                    <Route path="/organizaciones/editar/:id" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <OrganizacionForm />
                        </ProtectedRoute>
                    } />

                    <Route path="/pagos/nuevo" element={
                        <ProtectedRoute>
                            <PagoForm />
                        </ProtectedRoute>
                    } />

                    {/* Comunicados — rutas estáticas ANTES que dinámicas */}
                    <Route path="/comunicados/nuevo" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <ComunicadoForm />
                        </ProtectedRoute>
                    } />

                    <Route path="/comunicados" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <ComunicadoList />
                        </ProtectedRoute>
                    } />

                    {/* /editar ANTES que /:id — regla de rutas estáticas primero */}
                    <Route path="/comunicados/:id/editar" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <ComunicadoEdit />
                        </ProtectedRoute>
                    } />

                    <Route path="/comunicados/:id" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <ComunicadoDetail />
                        </ProtectedRoute>
                    } />


                    {/* ══ RUTAS DE NOTICIAS ═══════════════════════════════════
                        REGLA: estáticas (/noticias/nueva) ANTES que
                        dinámicas (/noticias/:id/editar)                      */}

                    {/* Listado — admin y operador */}
                    <Route path="/noticias" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <NoticiaList />
                        </ProtectedRoute>
                    } />

                    {/* Crear — admin y operador */}
                    <Route path="/noticias/nueva" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <NoticiaForm />
                        </ProtectedRoute>
                    } />

                    {/* Editar — admin y operador */}
                    <Route path="/noticias/:id/editar" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <NoticiaForm />
                        </ProtectedRoute>
                    } />


                    {/* ══ SUGERENCIAS ═════════════════════════════════════════
                        Panel accesible para admin, operador y vocero.
                        El widget de envío vive en PerfilPage y MiComunidad.  */}
                    <Route path="/sugerencias" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador', 'vocero']}>
                            <SugerenciaPanel />
                        </ProtectedRoute>
                    } />


                    {/* ══ ✅ FIX #2 — RUTAS DE ROL VOCERO Y USUARIO ══════════
                        Estaban ausentes. El catch-all las enviaba a /login,
                        recreando el bucle para esos dos roles.               */}

                    {/* Rol: vocero → /mi-comunidad */}
                    <Route path="/mi-comunidad" element={
                        <ProtectedRoute allowedRoles={['vocero']}>
                            <MiComunidad />
                        </ProtectedRoute>
                    } />

                    {/* Rol: usuario → /perfil */}
                    <Route path="/perfil" element={
                        <ProtectedRoute allowedRoles={['usuario', 'admin', 'operador', 'vocero']}>
                            <PerfilPage />
                        </ProtectedRoute>
                    } />


                    {/* ══ 404 — catch-all ═════════════════════════════════════ */}
                    <Route path="*" element={<Navigate to="/login" replace />} />

                </Routes>
            </BrowserRouter>
        </AuthProvider>
    </ErrorBoundary>
);

const container = document.getElementById('app');
if (container) createRoot(container).render(<App />);

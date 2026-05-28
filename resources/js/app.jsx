/**
 * resources/js/app.jsx — SIGET
 *
 * CAMBIOS RESPECTO A LA VERSIÓN ANTERIOR:
 *
 * 1. ErrorBoundary añadido
 *    Una pantalla blanca total en React significa que un componente
 *    lanzó un error durante el render y no había ningún ErrorBoundary
 *    que lo capturara. React desmonta TODO el árbol. Con ErrorBoundary,
 *    el error queda contenido y visible en pantalla en vez de silencioso.
 *
 * 2. Ruta /auditoria — path singular, allowedRoles solo 'admin'
 *    Coincide con href en NAV_ITEMS de DashboardPage.jsx.
 *
 * 3. Sin rutas duplicadas de auditoría.
 *
 * ⚠️  ACCIÓN REQUERIDA antes de usar este archivo:
 *    Verifica que el archivo AuditoriaList.jsx esté en:
 *      resources/js/pages/auditoria/AuditoriaList.jsx
 *    Si lo tienes en otra carpeta (Auditoria/, auditorias/, etc.),
 *    ajusta la línea de import al final de los imports.
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
import FamiliaForm      from './pages/familias/FamiliaForm';
import FamiliaList      from './pages/familias/FamiliaList';
import HabitanteForm    from './pages/habitantes/HabitanteForm';
import HabitanteList    from './pages/habitantes/HabitanteList';
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
// ─────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children, allowedRoles = null }) => {
    const { user, isLoading } = useAuth();

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

    if (!user) return <Navigate to="/login" replace />;

    if (allowedRoles && !allowedRoles.includes(user.rol)) {
        return <Navigate to="/dashboard" replace />;
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

                    {/* ══ PÚBLICAS ════════════════════════════════ */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/"      element={<Navigate to="/login" replace />} />

                    {/* ══ PRIVADAS — TODOS LOS ROLES ══════════════ */}

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

                    <Route path="/habitantes" element={
                        <ProtectedRoute>
                            <HabitanteList />
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


                    {/* ══ PRIVADAS — ADMIN + OPERADOR ═════════════ */}

                    <Route path="/familias/crear" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <FamiliaForm />
                        </ProtectedRoute>
                    } />

                    <Route path="/habitantes/crear" element={
                        <ProtectedRoute allowedRoles={['admin', 'operador']}>
                            <HabitanteForm />
                        </ProtectedRoute>
                    } />

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

                    {/* /editar ANTES que /:id para que React Router no confunda 'editar' con un ID */}
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


                    {/* ══ 404 ════════════════════════════════════ */}
                    <Route path="*" element={<Navigate to="/login" replace />} />

                </Routes>
            </BrowserRouter>
        </AuthProvider>
    </ErrorBoundary>
);

const container = document.getElementById('app');
if (container) createRoot(container).render(<App />);

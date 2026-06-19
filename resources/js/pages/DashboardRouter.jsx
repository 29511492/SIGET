/**
 * resources/js/pages/DashboardRouter.jsx
 *
 * FIX (junio 2026): El rol "usuario" seguía viendo el sidebar azul de
 * DashboardPage.jsx en la ruta /dashboard, porque DashboardPage SIEMPRE
 * envuelve <DashboardView /> con su propio <aside className="dashboard-sidebar">,
 * sin importar qué componente devuelva el Factory para ese rol.
 *
 * Este componente puente resuelve el problema en el nivel de ruteo:
 *   - Si el rol es "usuario" → renderiza UsuarioDashboard DIRECTAMENTE,
 *     sin pasar por DashboardPage. Cero sidebar, cero topbar admin.
 *   - Cualquier otro rol (admin, operador, vocero) → renderiza
 *     DashboardPage exactamente como antes. Cero cambios de
 *     comportamiento para esos roles.
 *
 * Esto evita tocar la lógica interna de DashboardPage.jsx (que sigue
 * sirviendo correctamente a los otros 3 roles) y evita duplicar las
 * rutas en app.jsx con condicionales repetidos.
 */

import { useAuth }        from '../hooks/useAuth';
import DashboardPage      from './DashboardPage';
import UsuarioDashboard   from '../components/Dashboard/Views/UsuarioDashboard';

export default function DashboardRouter() {
    const { user, isLoading } = useAuth();

    // Mientras se resuelve la sesión, dejamos que DashboardPage
    // maneje su propio guard de carga (ya lo hace internamente).
    if (isLoading) {
        return <DashboardPage />;
    }

    if (user?.rol === 'usuario') {
        return <UsuarioDashboard user={user} />;
    }

    return <DashboardPage />;
}

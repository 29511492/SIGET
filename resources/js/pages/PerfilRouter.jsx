/**
 * resources/js/pages/PerfilRouter.jsx
 *
 * FIX (junio 2026): /perfil y /dashboard mostraban contenido redundante
 * para el rol "usuario" (PerfilPage vs UsuarioDashboard). Se fusionó
 * todo en una sola vista (UsuarioDashboard, que ahora incluye también
 * la sección de Datos de cuenta y Permisos).
 *
 * Este componente puente decide:
 *   - Rol "usuario" → UsuarioDashboard (Portal Ciudadano completo,
 *     sin sidebar, mismo componente que /dashboard).
 *   - Cualquier otro rol (admin, operador, vocero) → PerfilPage normal,
 *     con su sidebar completo — comportamiento sin cambios para ellos.
 */

import { useAuth }       from '../hooks/useAuth';
import PerfilPage        from './perfil/PerfilPage';
import UsuarioDashboard  from '../components/Dashboard/Views/UsuarioDashboard';

export default function PerfilRouter() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return <PerfilPage />;
    }

    if (user?.rol === 'usuario') {
        return <UsuarioDashboard user={user} />;
    }

    return <PerfilPage />;
}

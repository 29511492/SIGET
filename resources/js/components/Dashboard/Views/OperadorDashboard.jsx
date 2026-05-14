/**
 * OperadorDashboard.jsx
 * Vista para el rol 'operador' — acceso a stats pero sin configuración global.
 * Comparte estructura con AdminDashboard pero sin las acciones destructivas.
 */

import AdminDashboard from './AdminDashboard';

/**
 * DECISIÓN: El operador ve las mismas stats que el admin
 * pero DashboardPage controla qué botones de acción se muestran
 * mediante los permisos del AuthContext (canDelete, canWrite).
 * Reusar AdminDashboard aquí evita duplicación (principio DRY).
 *
 * Si en el futuro el operador necesita una vista radicalmente
 * distinta, se reemplaza este componente sin tocar AdminDashboard.
 */
export default function OperadorDashboard(props) {
    return <AdminDashboard {...props} />;
}

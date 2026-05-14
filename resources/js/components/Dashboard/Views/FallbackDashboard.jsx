/**
 * FallbackDashboard.jsx
 * Vista de seguridad — se muestra cuando el rol no está en el registry.
 * Defensive Programming: el sistema nunca falla silenciosamente.
 */

export default function FallbackDashboard({ user }) {
    return (
        <section className="dashboard-view">
            <div className="dashboard-fallback">
                <span className="dashboard-fallback__icon">🔒</span>
                <h2 className="dashboard-fallback__title">Acceso no configurado</h2>
                <p className="dashboard-fallback__text">
                    Tu rol <strong>"{user?.rol}"</strong> no tiene un panel asignado.
                    Contacta al administrador del sistema.
                </p>
            </div>
        </section>
    );
}

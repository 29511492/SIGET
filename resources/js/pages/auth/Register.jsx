/**
 * resources/js/pages/auth/Register.jsx
 * Registro de nuevos usuarios base (habitantes).
 * Mismo patrón visual y de estado que Login.jsx.
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link }   from 'react-router-dom';
import { useAuth }             from '../../hooks/useAuth';
import apiClient               from '../../services/axios';
import './Login.css'; // Reutiliza los estilos del Login

export default function Register() {
    const { user }   = useAuth();
    const navigate   = useNavigate();

    const [form, setForm] = useState({
        name:                  '',
        cedula:                '',
        email:                 '',
        password:              '',
        password_confirmation: '',
    });

    const [errors,      setErrors]      = useState({});
    const [serverError, setServerError] = useState('');
    const [isLoading,   setIsLoading]   = useState(false);
    const [showPw,      setShowPw]      = useState(false);

    // Si ya está autenticado, redirigir
    useEffect(() => {
        if (user) navigate('/dashboard', { replace: true });
    }, [user, navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (errors[name])  setErrors(prev => ({ ...prev, [name]: '' }));
        if (serverError)   setServerError('');
    };

    const validate = () => {
        const next = {};
        if (!form.name.trim())
            next.name = 'El nombre es obligatorio.';
        if (!form.cedula.trim())
            next.cedula = 'La cédula es obligatoria.';
        if (!form.email)
            next.email = 'El correo es obligatorio.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
            next.email = 'Ingresa un correo válido.';
        if (!form.password)
            next.password = 'La contraseña es obligatoria.';
        else if (form.password.length < 8)
            next.password = 'Mínimo 8 caracteres.';
        if (form.password !== form.password_confirmation)
            next.password_confirmation = 'Las contraseñas no coinciden.';
        return next;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError('');

        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setIsLoading(true);
        try {
            await apiClient.post('/v1/register', form, {
                headers: { Accept: 'application/json' },
            });
            // Registro exitoso → redirigir al login con mensaje
            navigate('/login?registered=1', { replace: true });
        } catch (err) {
            if (!err.response) {
                setServerError('Error de red. Verifica tu conexión.');
                return;
            }
            const { status, data } = err.response;
            if (status === 422) {
                setErrors(data.errors ?? {});
            } else {
                setServerError(data.message ?? 'Error inesperado. Intenta nuevamente.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-root">

            {/* ── Panel Izquierdo ─────────────────────────────── */}
            <aside className="login-brand" aria-hidden="true">
                <div className="login-brand__grid" />
                <div className="login-brand__content">
                    <div className="login-brand__logo">
                        <span className="login-brand__logo-letter">S</span>
                    </div>
                    <div className="login-brand__text">
                        <h1 className="login-brand__title">SIGET</h1>
                        <p className="login-brand__subtitle">
                            Sistema de Gestión Territorial
                        </p>
                    </div>
                    <p className="login-brand__description">
                        Crea tu cuenta para acceder a los servicios
                        digitales de tu Consejo Comunal.
                    </p>
                    <div className="login-brand__divider" />
                    <div className="login-brand__badges">
                        <span className="login-brand__badge">Censo</span>
                        <span className="login-brand__badge">Proyectos</span>
                        <span className="login-brand__badge">Voceros</span>
                    </div>
                </div>
                <p className="login-brand__footer">
                    © {new Date().getFullYear()} SIGET — República Bolivariana de Venezuela
                </p>
            </aside>

            {/* ── Panel Derecho: Formulario ───────────────────── */}
            <main className="login-form-panel">
                <div className="login-form-wrapper">

                    <header className="login-form-header">
                        <h2 className="login-form-header__title">Crear Cuenta</h2>
                        <p className="login-form-header__subtitle">
                            Regístrate como habitante de la comunidad
                        </p>
                    </header>

                    {serverError && (
                        <div className="login-alert login-alert--error" role="alert">
                            <span className="login-alert__icon">⚠</span>
                            <span>{serverError}</span>
                        </div>
                    )}

                    <form className="login-form" onSubmit={handleSubmit} noValidate>

                        {/* Nombre */}
                        <div className={`login-field ${errors.name ? 'login-field--error' : ''}`}>
                            <label htmlFor="name" className="login-field__label">
                                Nombre completo
                            </label>
                            <div className="login-field__input-wrapper">
                                <span className="login-field__icon">👤</span>
                                <input
                                    id="name" name="name" type="text"
                                    autoComplete="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    placeholder="Juan Pérez"
                                    className="login-field__input"
                                    disabled={isLoading}
                                />
                            </div>
                            {errors.name && (
                                <p className="login-field__error" role="alert">{errors.name[0] ?? errors.name}</p>
                            )}
                        </div>

                        {/* Cédula */}
                        <div className={`login-field ${errors.cedula ? 'login-field--error' : ''}`}>
                            <label htmlFor="cedula" className="login-field__label">
                                Cédula de identidad
                            </label>
                            <div className="login-field__input-wrapper">
                                <span className="login-field__icon">🪪</span>
                                <input
                                    id="cedula" name="cedula" type="text"
                                    value={form.cedula}
                                    onChange={handleChange}
                                    placeholder="V-12345678"
                                    className="login-field__input"
                                    disabled={isLoading}
                                />
                            </div>
                            {errors.cedula && (
                                <p className="login-field__error" role="alert">{errors.cedula[0] ?? errors.cedula}</p>
                            )}
                        </div>

                        {/* Email */}
                        <div className={`login-field ${errors.email ? 'login-field--error' : ''}`}>
                            <label htmlFor="email" className="login-field__label">
                                Correo electrónico
                            </label>
                            <div className="login-field__input-wrapper">
                                <span className="login-field__icon">✉</span>
                                <input
                                    id="email" name="email" type="email"
                                    autoComplete="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="correo@ejemplo.com"
                                    className="login-field__input"
                                    disabled={isLoading}
                                />
                            </div>
                            {errors.email && (
                                <p className="login-field__error" role="alert">{errors.email[0] ?? errors.email}</p>
                            )}
                        </div>

                        {/* Contraseña */}
                        <div className={`login-field ${errors.password ? 'login-field--error' : ''}`}>
                            <label htmlFor="password" className="login-field__label">
                                Contraseña
                            </label>
                            <div className="login-field__input-wrapper">
                                <span className="login-field__icon">🔒</span>
                                <input
                                    id="password" name="password"
                                    type={showPw ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder="Mínimo 8 caracteres"
                                    className="login-field__input"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    className="login-field__toggle-pw"
                                    onClick={() => setShowPw(v => !v)}
                                    tabIndex={-1}
                                    aria-label={showPw ? 'Ocultar' : 'Mostrar'}
                                >
                                    {showPw ? '🙈' : '👁'}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="login-field__error" role="alert">{errors.password[0] ?? errors.password}</p>
                            )}
                        </div>

                        {/* Confirmar contraseña */}
                        <div className={`login-field ${errors.password_confirmation ? 'login-field--error' : ''}`}>
                            <label htmlFor="password_confirmation" className="login-field__label">
                                Confirmar contraseña
                            </label>
                            <div className="login-field__input-wrapper">
                                <span className="login-field__icon">🔒</span>
                                <input
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    type={showPw ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    value={form.password_confirmation}
                                    onChange={handleChange}
                                    placeholder="Repite tu contraseña"
                                    className="login-field__input"
                                    disabled={isLoading}
                                />
                            </div>
                            {errors.password_confirmation && (
                                <p className="login-field__error" role="alert">
                                    {errors.password_confirmation[0] ?? errors.password_confirmation}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            className={`login-submit ${isLoading ? 'login-submit--loading' : ''}`}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <span className="login-submit__spinner" aria-hidden="true" />
                                    Creando cuenta…
                                </>
                            ) : 'Crear Cuenta'}
                        </button>

                    </form>

                    <p className="login-form-footer">
                        ¿Ya tienes cuenta?{' '}
                        <Link to="/login" className="login-form-footer__link">
                            Inicia sesión
                        </Link>
                    </p>

                </div>
            </main>
        </div>
    );
}

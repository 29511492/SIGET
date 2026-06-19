/**
 * resources/js/pages/auth/ForgotPassword.jsx
 * Solicita el correo del usuario y dispara el envío del OTP.
 * Flujo: ingresa email → backend envía OTP → navegar a ResetPassword.
 */

import { useState }          from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient             from '../../services/axios';
import './Login.css';

export default function ForgotPassword() {
    const navigate = useNavigate();

    const [email,       setEmail]       = useState('');
    const [error,       setError]       = useState('');
    const [serverError, setServerError] = useState('');
    const [isLoading,   setIsLoading]   = useState(false);
    const [enviado,     setEnviado]     = useState(false);
    const [cuentaBloqueada, setCuentaBloqueada] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setServerError('');

        if (!email) {
            setError('El correo electrónico es obligatorio.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Ingresa un correo válido.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await apiClient.post('/v1/forgot-password',
                { email },
                { headers: { Accept: 'application/json' } }
            );

            setCuentaBloqueada(response.data.locked ?? false);
            setEnviado(true);

            // Navegar a ResetPassword pasando el email por state
            // para no exponerlo en la URL
            setTimeout(() => {
                navigate('/reset-password', {
                    state: { email, locked: response.data.locked ?? false },
                });
            }, 2000);

        } catch (err) {
            if (!err.response) {
                setServerError('Error de red. Verifica tu conexión.');
                return;
            }
            const { status, data } = err.response;
            if (status === 422) {
                setError(data.errors?.email?.[0] ?? 'Correo no encontrado.');
            } else {
                setServerError(data.message ?? 'Error inesperado.');
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
                        Recupera el acceso a tu cuenta de forma segura
                        mediante un código de verificación.
                    </p>
                    <div className="login-brand__divider" />
                    <div className="login-brand__badges">
                        <span className="login-brand__badge">Seguro</span>
                        <span className="login-brand__badge">OTP 6 dígitos</span>
                        <span className="login-brand__badge">15 min</span>
                    </div>
                </div>
                <p className="login-brand__footer">
                    © {new Date().getFullYear()} SIGET — República Bolivariana de Venezuela
                </p>
            </aside>

            {/* ── Panel Derecho ───────────────────────────────── */}
            <main className="login-form-panel">
                <div className="login-form-wrapper">

                    <header className="login-form-header">
                        <h2 className="login-form-header__title">
                            {cuentaBloqueada ? 'Desbloquear Cuenta' : 'Recuperar Contraseña'}
                        </h2>
                        <p className="login-form-header__subtitle">
                            Ingresa tu correo y te enviaremos un código de verificación
                        </p>
                    </header>

                    {/* Estado: OTP enviado con éxito */}
                    {enviado && (
                        <div className="login-alert login-alert--success" role="alert">
                            <span className="login-alert__icon">✅</span>
                            <span>
                                Código enviado a <strong>{email}</strong>.
                                Redirigiendo…
                            </span>
                        </div>
                    )}

                    {serverError && (
                        <div className="login-alert login-alert--error" role="alert">
                            <span className="login-alert__icon">⚠</span>
                            <span>{serverError}</span>
                        </div>
                    )}

                    {!enviado && (
                        <form className="login-form" onSubmit={handleSubmit} noValidate>

                            <div className={`login-field ${error ? 'login-field--error' : ''}`}>
                                <label htmlFor="email" className="login-field__label">
                                    Correo electrónico
                                </label>
                                <div className="login-field__input-wrapper">
                                    <span className="login-field__icon">✉</span>
                                    <input
                                        id="email" name="email" type="email"
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            setError('');
                                        }}
                                        placeholder="correo@ejemplo.com"
                                        className="login-field__input"
                                        disabled={isLoading}
                                        autoFocus
                                    />
                                </div>
                                {error && (
                                    <p className="login-field__error" role="alert">{error}</p>
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
                                        Enviando código…
                                    </>
                                ) : 'Enviar Código OTP'}
                            </button>

                        </form>
                    )}

                    <p className="login-form-footer">
                        <Link to="/login" className="login-form-footer__link">
                            ← Volver al inicio de sesión
                        </Link>
                    </p>

                </div>
            </main>
        </div>
    );
}

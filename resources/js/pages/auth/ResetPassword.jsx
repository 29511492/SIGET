/**
 * resources/js/pages/auth/ResetPassword.jsx
 * Flujo de 2 pasos:
 *   Paso 1 — Verificar OTP (email + código de 6 dígitos)
 *   Paso 2 — Nueva contraseña (solo si el OTP fue válido)
 */

import { useState }          from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import apiClient             from '../../services/axios';
import './Login.css';

export default function ResetPassword() {
    const navigate = useNavigate();
    const location = useLocation();

    // Email y estado de bloqueo recibidos desde ForgotPassword via router state
    const emailPrevio  = location.state?.email  ?? '';
    const cuentaBloqueada = location.state?.locked ?? false;

    // ── Paso 1: verificar OTP ─────────────────────────────────
    const [paso,      setPaso]      = useState(1); // 1 = OTP, 2 = nueva contraseña
    const [form,      setForm]      = useState({
        email: emailPrevio,
        otp:   '',
    });

    // ── Paso 2: nueva contraseña ──────────────────────────────
    const [passwords, setPasswords] = useState({
        password:              '',
        password_confirmation: '',
    });

    const [errors,      setErrors]      = useState({});
    const [serverError, setServerError] = useState('');
    const [isLoading,   setIsLoading]   = useState(false);
    const [showPw,      setShowPw]      = useState(false);
    const [exito,       setExito]       = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name in form) {
            setForm(prev => ({ ...prev, [name]: value }));
        } else {
            setPasswords(prev => ({ ...prev, [name]: value }));
        }
        if (errors[name])  setErrors(prev => ({ ...prev, [name]: '' }));
        if (serverError)   setServerError('');
    };

    // ── Submit Paso 1: verificar OTP ──────────────────────────
    const handleVerificarOtp = async (e) => {
        e.preventDefault();
        setErrors({});
        setServerError('');

        const next = {};
        if (!form.email) next.email = 'El correo es obligatorio.';
        if (!form.otp || form.otp.length !== 6) next.otp = 'El código debe tener 6 dígitos.';
        if (Object.keys(next).length > 0) { setErrors(next); return; }

        setIsLoading(true);
        try {
            await apiClient.post('/v1/verify-otp', form, {
                headers: { Accept: 'application/json' },
            });
            setPaso(2); // OTP válido → mostrar formulario de nueva contraseña
        } catch (err) {
            if (!err.response) { setServerError('Error de red.'); return; }
            const { status, data } = err.response;
            if (status === 422) {
                setErrors(data.errors ?? {});
            } else {
                setServerError(data.message ?? 'Error inesperado.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ── Submit Paso 2: resetear contraseña ────────────────────
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setErrors({});
        setServerError('');

        const next = {};
        if (!passwords.password || passwords.password.length < 8)
            next.password = 'Mínimo 8 caracteres.';
        if (passwords.password !== passwords.password_confirmation)
            next.password_confirmation = 'Las contraseñas no coinciden.';
        if (Object.keys(next).length > 0) { setErrors(next); return; }

        setIsLoading(true);
        try {
            await apiClient.post('/v1/reset-password', {
                email:    form.email,
                otp:      form.otp,
                password: passwords.password,
                password_confirmation: passwords.password_confirmation,
            }, { headers: { Accept: 'application/json' } });

            setExito(true);
            setTimeout(() => navigate('/login', { replace: true }), 3000);
        } catch (err) {
            if (!err.response) { setServerError('Error de red.'); return; }
            const { status, data } = err.response;
            if (status === 422) {
                setErrors(data.errors ?? {});
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
                        <p className="login-brand__subtitle">Sistema de Gestión Territorial</p>
                    </div>
                    <p className="login-brand__description">
                        {cuentaBloqueada
                            ? 'Verifica tu identidad para desbloquear tu cuenta.'
                            : 'Establece una nueva contraseña segura para tu cuenta.'}
                    </p>
                    <div className="login-brand__divider" />
                    {/* Indicador de pasos */}
                    <div className="login-brand__badges">
                        <span className={`login-brand__badge ${paso === 1 ? 'login-brand__badge--active' : ''}`}>
                            1 · Código OTP
                        </span>
                        <span className={`login-brand__badge ${paso === 2 ? 'login-brand__badge--active' : ''}`}>
                            2 · Nueva Contraseña
                        </span>
                    </div>
                </div>
                <p className="login-brand__footer">
                    © {new Date().getFullYear()} SIGET — República Bolivariana de Venezuela
                </p>
            </aside>

            {/* ── Panel Derecho ───────────────────────────────── */}
            <main className="login-form-panel">
                <div className="login-form-wrapper">

                    {/* ── Éxito final ─────────────────────────── */}
                    {exito ? (
                        <>
                            <header className="login-form-header">
                                <h2 className="login-form-header__title">¡Contraseña actualizada!</h2>
                            </header>
                            <div className="login-alert login-alert--success" role="alert">
                                <span className="login-alert__icon">✅</span>
                                <span>Tu contraseña fue actualizada. Redirigiendo al login…</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <header className="login-form-header">
                                <h2 className="login-form-header__title">
                                    {paso === 1 ? 'Verificar Código' : 'Nueva Contraseña'}
                                </h2>
                                <p className="login-form-header__subtitle">
                                    {paso === 1
                                        ? 'Ingresa el código de 6 dígitos enviado a tu correo'
                                        : 'Elige una contraseña segura para tu cuenta'}
                                </p>
                            </header>

                            {serverError && (
                                <div className="login-alert login-alert--error" role="alert">
                                    <span className="login-alert__icon">⚠</span>
                                    <span>{serverError}</span>
                                </div>
                            )}

                            {/* ══ PASO 1: Email + OTP ═══════════════════ */}
                            {paso === 1 && (
                                <form className="login-form" onSubmit={handleVerificarOtp} noValidate>

                                    {/* Email */}
                                    <div className={`login-field ${errors.email ? 'login-field--error' : ''}`}>
                                        <label htmlFor="email" className="login-field__label">
                                            Correo electrónico
                                        </label>
                                        <div className="login-field__input-wrapper">
                                            <span className="login-field__icon">✉</span>
                                            <input
                                                id="email" name="email" type="email"
                                                value={form.email}
                                                onChange={handleChange}
                                                placeholder="correo@ejemplo.com"
                                                className="login-field__input"
                                                disabled={isLoading || !!emailPrevio}
                                            />
                                        </div>
                                        {errors.email && (
                                            <p className="login-field__error" role="alert">{errors.email[0] ?? errors.email}</p>
                                        )}
                                    </div>

                                    {/* Código OTP */}
                                    <div className={`login-field ${errors.otp ? 'login-field--error' : ''}`}>
                                        <label htmlFor="otp" className="login-field__label">
                                            Código de verificación (6 dígitos)
                                        </label>
                                        <div className="login-field__input-wrapper">
                                            <span className="login-field__icon">🔑</span>
                                            <input
                                                id="otp" name="otp" type="text"
                                                inputMode="numeric"
                                                maxLength={6}
                                                value={form.otp}
                                                onChange={handleChange}
                                                placeholder="000000"
                                                className="login-field__input"
                                                disabled={isLoading}
                                                autoFocus={!!emailPrevio}
                                                style={{ letterSpacing: '6px', fontWeight: '700', fontSize: '1.1rem' }}
                                            />
                                        </div>
                                        {errors.otp && (
                                            <p className="login-field__error" role="alert">{errors.otp[0] ?? errors.otp}</p>
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
                                                Verificando…
                                            </>
                                        ) : 'Verificar Código'}
                                    </button>

                                </form>
                            )}

                            {/* ══ PASO 2: Nueva contraseña ══════════════ */}
                            {paso === 2 && (
                                <form className="login-form" onSubmit={handleResetPassword} noValidate>

                                    <div className={`login-field ${errors.password ? 'login-field--error' : ''}`}>
                                        <label htmlFor="password" className="login-field__label">
                                            Nueva contraseña
                                        </label>
                                        <div className="login-field__input-wrapper">
                                            <span className="login-field__icon">🔒</span>
                                            <input
                                                id="password" name="password"
                                                type={showPw ? 'text' : 'password'}
                                                autoComplete="new-password"
                                                value={passwords.password}
                                                onChange={handleChange}
                                                placeholder="Mínimo 8 caracteres"
                                                className="login-field__input"
                                                disabled={isLoading}
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                className="login-field__toggle-pw"
                                                onClick={() => setShowPw(v => !v)}
                                                tabIndex={-1}
                                            >
                                                {showPw ? '🙈' : '👁'}
                                            </button>
                                        </div>
                                        {errors.password && (
                                            <p className="login-field__error" role="alert">{errors.password[0] ?? errors.password}</p>
                                        )}
                                    </div>

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
                                                value={passwords.password_confirmation}
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
                                                Guardando…
                                            </>
                                        ) : 'Guardar Nueva Contraseña'}
                                    </button>

                                </form>
                            )}

                            <p className="login-form-footer">
                                <Link to="/login" className="login-form-footer__link">
                                    ← Volver al inicio de sesión
                                </Link>
                            </p>
                        </>
                    )}

                </div>
            </main>
        </div>
    );
}

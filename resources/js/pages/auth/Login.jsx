/**
 * ═══════════════════════════════════════════════════════════════
 *  resources/js/pages/auth/Login.jsx — Actualizado con RBAC
 * ───────────────────────────────────────────────────────────────
 *  CAMBIOS RESPECTO A LA VERSIÓN ANTERIOR:
 *  1. Ya no manipula localStorage directamente.
 *     Toda la persistencia se delega a useAuth() → AuthContext.
 *     Principio SRP: el componente solo gestiona la UI del formulario.
 *
 *  2. Redirección inteligente por rol post-login:
 *     Admin     → /dashboard (vista completa)
 *     Operador  → /dashboard
 *     Vocero    → /mi-comunidad (vista limitada)
 *     Usuario   → /perfil
 *
 *  3. Cero estilos inline — todos en Login.css (Regla de Oro).
 *
 *  4. FIX (junio 2026): Los enlaces "¿Olvidaste tu contraseña?" y
 *     "¿No tienes cuenta? Regístrate aquí" ahora viven agrupados
 *     dentro de <div className="login-form-footer-group">, que
 *     aporta separación visual (divisor sutil) respecto al botón
 *     de envío. Antes eran dos <p> sueltos sin estilo propio.
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import './Login.css';

// Mapa de redirección por rol
const REDIRECT_BY_ROL = {
    admin:    '/dashboard',
    operador: '/dashboard',
    vocero:   '/mi-comunidad',
    usuario:  '/perfil',
};

export default function Login() {
    const { t, i18n }      = useTranslation();
    const { login, user }  = useAuth();
    const navigate         = useNavigate();
    const location         = useLocation();

    const [form,           setForm]           = useState({ email: '', password: '' });
    const [errors,         setErrors]         = useState({});
    const [serverError,    setServerError]    = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading,      setIsLoading]      = useState(false);
    const [showPw,         setShowPw]         = useState(false);
    const [locale,         setLocale]         = useState(
        localStorage.getItem('siget_locale') ?? 'es'
    );

    // Mostrar mensaje de registro exitoso si viene de /register
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('registered') === '1') {
            setSuccessMessage('Cuenta creada exitosamente. Ya puedes iniciar sesión.');
        }
    }, [location.search]);

    // Si ya está autenticado, redirigir directamente
    useEffect(() => {
        if (user) {
            const destino = REDIRECT_BY_ROL[user.rol] ?? '/dashboard';
            navigate(destino, { replace: true });
        }
    }, [user, navigate]);

    const toggleLocale = () => {
        const next = locale === 'es' ? 'en' : 'es';
        localStorage.setItem('siget_locale', next);
        setLocale(next);
        i18n.changeLanguage(next);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (errors[name])   setErrors(prev => ({ ...prev, [name]: '' }));
        if (serverError)    setServerError('');
    };

    const validate = () => {
        const next = {};
        if (!form.email)
            next.email = t('auth.errors.email_required');
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
            next.email = t('auth.errors.email_invalid');
        if (!form.password)
            next.password = t('auth.errors.password_required');
        else if (form.password.length < 8)
            next.password = t('auth.errors.password_min');
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
            // useAuth().login() persiste token + user en Context y localStorage
            const loggedUser = await login(form);

            // Redirigir según el rol recibido del backend
            const destino = REDIRECT_BY_ROL[loggedUser.rol] ?? '/dashboard';
            navigate(destino, { replace: true });

        } catch (err) {
            if (!err.response) {
                setServerError(t('auth.errors.network'));
                return;
            }
            const { status, data } = err.response;
            if (status === 422) {
                setErrors({
                    email:    data.errors?.email?.[0]    ?? '',
                    password: data.errors?.password?.[0] ?? '',
                });
            } else if (status === 423) {
                // Cuenta bloqueada — redirigir a forgot-password con email prellenado
                navigate('/forgot-password', {
                    state: { email: form.email, locked: true },
                });
            } else {
                setServerError(data.message ?? t('auth.errors.generic'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-root">

            {/* ── Panel Izquierdo: Identidad ──────────────────────── */}
            <aside className="login-brand" aria-hidden="true">
                <div className="login-brand__grid" />
                <div className="login-brand__content">
                    <div className="login-brand__logo">
                        <span className="login-brand__logo-letter">S</span>
                    </div>
                    <div className="login-brand__text">
                        <h1 className="login-brand__title">
                            {t('auth.login.brand_title')}
                        </h1>
                        <p className="login-brand__subtitle">
                            {t('auth.login.brand_subtitle')}
                        </p>
                    </div>
                    <p className="login-brand__description">
                        {t('auth.login.brand_description')}
                    </p>
                    <div className="login-brand__divider" />
                    <div className="login-brand__badges">
                        <span className="login-brand__badge">Censo</span>
                        <span className="login-brand__badge">Proyectos</span>
                        <span className="login-brand__badge">Voceros</span>
                    </div>
                </div>
                <p className="login-brand__footer">{t('auth.login.footer')}</p>
            </aside>

            {/* ── Panel Derecho: Formulario ───────────────────────── */}
            <main className="login-form-panel">
                <button
                    type="button"
                    className="login-lang-toggle"
                    onClick={toggleLocale}
                >
                    <span className="login-lang-toggle__flag">
                        {locale === 'es' ? '🇻🇪' : '🇺🇸'}
                    </span>
                    <span>{locale === 'es' ? 'ES' : 'EN'}</span>
                </button>

                <div className="login-form-wrapper">
                    <header className="login-form-header">
                        <h2 className="login-form-header__title">
                            {t('auth.login.form_title')}
                        </h2>
                        <p className="login-form-header__subtitle">
                            {t('auth.login.form_subtitle')}
                        </p>
                    </header>

                    {successMessage && (
                        <div className="login-alert login-alert--success" role="alert">
                            <span className="login-alert__icon">✅</span>
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {serverError && (
                        <div className="login-alert login-alert--error" role="alert">
                            <span className="login-alert__icon">⚠</span>
                            <span>{serverError}</span>
                        </div>
                    )}

                    <form className="login-form" onSubmit={handleSubmit} noValidate>

                        {/* Email */}
                        <div className={`login-field ${errors.email ? 'login-field--error' : ''}`}>
                            <label htmlFor="email" className="login-field__label">
                                {t('auth.login.email_label')}
                            </label>
                            <div className="login-field__input-wrapper">
                                <span className="login-field__icon">✉</span>
                                <input
                                    id="email" name="email" type="email"
                                    autoComplete="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder={t('auth.login.email_placeholder')}
                                    className="login-field__input"
                                    disabled={isLoading}
                                    aria-invalid={!!errors.email}
                                    aria-describedby={errors.email ? 'email-error' : undefined}
                                />
                            </div>
                            {errors.email && (
                                <p id="email-error" className="login-field__error" role="alert">
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        {/* Contraseña */}
                        <div className={`login-field ${errors.password ? 'login-field--error' : ''}`}>
                            <label htmlFor="password" className="login-field__label">
                                {t('auth.login.password_label')}
                            </label>
                            <div className="login-field__input-wrapper">
                                <span className="login-field__icon">🔒</span>
                                <input
                                    id="password" name="password"
                                    type={showPw ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder={t('auth.login.password_placeholder')}
                                    className="login-field__input"
                                    disabled={isLoading}
                                    aria-invalid={!!errors.password}
                                    aria-describedby={errors.password ? 'pw-error' : undefined}
                                />
                                <button
                                    type="button"
                                    className="login-field__toggle-pw"
                                    onClick={() => setShowPw(v => !v)}
                                    tabIndex={-1}
                                    aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                >
                                    {showPw ? '🙈' : '👁'}
                                </button>
                            </div>
                            {errors.password && (
                                <p id="pw-error" className="login-field__error" role="alert">
                                    {errors.password}
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
                                    {t('auth.login.submitting')}
                                </>
                            ) : t('auth.login.submit')}
                        </button>

                    </form>

                    {/* FIX (junio 2026): enlaces agrupados con separación
                     * visual del botón mediante .login-form-footer-group
                     * (divisor sutil + espaciado), en vez de dos <p> sueltos
                     * sin estilo propio pegados directamente al formulario. */}
                    <div className="login-form-footer-group">
                        <p className="login-form-footer">
                            <Link to="/forgot-password" className="login-form-footer__link">
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </p>
                        <p className="login-form-footer">
                            ¿No tienes cuenta?{' '}
                            <Link to="/register" className="login-form-footer__link">
                                Regístrate aquí
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}

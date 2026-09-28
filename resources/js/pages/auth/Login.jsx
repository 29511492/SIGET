/**
 * resources/js/pages/auth/Login.jsx
 *
 * Wizard de autenticación unificado — 4 pasos, una sola URL (/login).
 *
 * ARQUITECTURA DE SEGURIDAD (junio 2026):
 * Antes el flujo navegaba entre 3 URLs distintas (/login →
 * /forgot-password → /reset-password), exponiendo el estado del
 * proceso en el historial del navegador, proxies y logs de servidor.
 *
 * Ahora todo ocurre en /login mediante estado interno de React:
 *   Paso 1 — Formulario de login (credenciales)
 *   Paso 2 — Solicitar OTP (email)
 *   Paso 3 — Verificar OTP (código 6 dígitos)
 *   Paso 4 — Nueva contraseña (password + confirmación)
 *
 * El email y el OTP viajan siempre en el BODY de las peticiones
 * POST, nunca en la URL ni en query params.
 *
 * VALIDACIONES IMPLEMENTADAS:
 *   - Email: formato válido, no vacío
 *   - Contraseña login: mínimo 8 caracteres
 *   - OTP: exactamente 6 dígitos numéricos
 *   - Nueva contraseña: mínimo 8 chars, al menos 1 número
 *   - Confirmar contraseña: coincidencia exacta
 *
 * Archivos eliminados por este cambio:
 *   - resources/js/pages/auth/ForgotPassword.jsx
 *   - resources/js/pages/auth/ResetPassword.jsx
 *   (Las rutas /forgot-password y /reset-password se eliminaron de
 *   app.jsx — el backend /v1/forgot-password, /v1/verify-otp y
 *   /v1/reset-password no cambian.)
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link }    from 'react-router-dom';
import { useTranslation }              from 'react-i18next';
import { useAuth }                     from '../../hooks/useAuth';
import apiClient                       from '../../services/axios';
import './Login.css';

// ── Constantes ─────────────────────────────────────────────────
// FIX (sept-2026): el rol usuario entraba a /perfil en vez de
// /dashboard, inconsistente con el resto de los roles (todos entran
// a /dashboard salvo vocero, que tiene su propia vista /mi-comunidad).
// Ver también app.jsx — DashboardRouter/PerfilRouter ahora renderizan
// UsuarioDashboard en ambas rutas para el rol usuario, así que este
// cambio no rompe nada que dependiera de /perfil.
const REDIRECT_BY_ROL = {
    admin:    '/dashboard',
    operador: '/dashboard',
    vocero:   '/mi-comunidad',
    usuario:  '/dashboard',
};

const PASOS = {
    REGISTRO:        0,   // ← NUEVO: formulario de crear cuenta
    LOGIN:           1,
    SOLICITAR_OTP:   2,
    VERIFICAR_OTP:   3,
    NUEVA_PASSWORD:  4,
};

// ── Validadores ─────────────────────────────────────────────────
const esEmailValido    = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const esOtpValido      = (v) => /^\d{6}$/.test(v);
const esPasswordValido = (v) => v.length >= 8 && /\d/.test(v);
// Nombre: solo letras, espacios y tildes (sin números ni símbolos)
const esNombreValido   = (v) => /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/.test(v.trim()) && v.trim().length >= 3;
// Cédula venezolana: V/E/J/v/e/j seguido de guión opcional y 6-8 dígitos
const esCedulaValida   = (v) => /^[VEJvej]-?\d{6,8}$/.test(v.trim());

// ─────────────────────────────────────────────────────────────────
export default function Login() {
    const { t, i18n }     = useTranslation();
    const { login, user } = useAuth();
    const navigate        = useNavigate();
    const location        = useLocation();
    const otpRef          = useRef(null);

    // ── Estado del wizard ────────────────────────────────────────
    const [paso,          setPaso]          = useState(PASOS.LOGIN);
    const [emailWizard,   setEmailWizard]   = useState('');
    const [otpVerificado, setOtpVerificado] = useState(false);

    // ── Paso 0 — Registro ────────────────────────────────────────
    const [formReg, setFormReg] = useState({
        name:                  '',
        cedula:                '',
        email:                 '',
        password:              '',
        password_confirmation: '',
    });
    const [errorsReg,  setErrorsReg]  = useState({});
    const [showRegPw,  setShowRegPw]  = useState(false);

    // ── Paso 1 — Login ───────────────────────────────────────────
    const [formLogin,    setFormLogin]    = useState({ email: '', password: '' });
    const [errorsLogin,  setErrorsLogin]  = useState({});
    const [serverError,  setServerError]  = useState('');
    const [successMsg,   setSuccessMsg]   = useState('');
    const [isLoading,    setIsLoading]    = useState(false);
    const [showPw,       setShowPw]       = useState(false);

    // ── Paso 2 — Solicitar OTP ───────────────────────────────────
    const [emailOtp,     setEmailOtp]     = useState('');
    const [emailOtpErr,  setEmailOtpErr]  = useState('');
    const [otpEnviado,   setOtpEnviado]   = useState(false);
    const [cuentaLocked, setCuentaLocked] = useState(false);

    // ── Paso 3 — Verificar OTP ───────────────────────────────────
    const [otp,          setOtp]          = useState('');
    const [otpError,     setOtpError]     = useState('');

    // ── Paso 4 — Nueva contraseña ────────────────────────────────
    const [newPw,        setNewPw]        = useState('');
    const [confirmPw,    setConfirmPw]    = useState('');
    const [showNewPw,    setShowNewPw]    = useState(false);
    const [showConfirm,  setShowConfirm]  = useState(false);
    const [pwErrors,     setPwErrors]     = useState({});

    // ── Idioma ───────────────────────────────────────────────────
    const [locale,       setLocale]       = useState(
        localStorage.getItem('siget_locale') ?? 'es'
    );

    // ── Mensaje de registro exitoso ─────────────────────────────
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('registered') === '1') {
            setSuccessMsg('Cuenta creada exitosamente. Ya puedes iniciar sesión.');
        }
    }, [location.search]);

    // ── Redirección si ya autenticado ───────────────────────────
    useEffect(() => {
        if (user) {
            navigate(REDIRECT_BY_ROL[user.rol] ?? '/dashboard', { replace: true });
        }
    }, [user, navigate]);

    // ── Foco en el campo OTP al llegar al paso 3 ─────────────────
    useEffect(() => {
        if (paso === PASOS.VERIFICAR_OTP) {
            setTimeout(() => otpRef.current?.focus(), 100);
        }
    }, [paso]);

    // ─────────────────────────────────────────────────────────────
    //  HANDLERS — Paso 0: Registro
    // ─────────────────────────────────────────────────────────────
    const handleRegChange = (e) => {
        const { name, value } = e.target;
        setFormReg(prev => ({ ...prev, [name]: value }));
        setErrorsReg(prev => ({ ...prev, [name]: '' }));
        setServerError('');
    };

    // Helper: si el error es un array (backend 422) toma el primer elemento.
    // Si es un string (validación frontend), lo devuelve completo.
    // Evita el bug de .campo[0] que tomaba el primer CARÁCTER del string.
    const getRegErr = (campo) => {
        const err = errorsReg[campo];
        if (!err) return '';
        return Array.isArray(err) ? err[0] : err;
    };

    const validateReg = () => {
        const next = {};
        if (!formReg.name.trim())
            next.name = 'El nombre es obligatorio.';
        else if (!esNombreValido(formReg.name))
            next.name = 'Formato no válido.';
        if (!formReg.cedula.trim())
            next.cedula = 'La cédula es obligatoria.';
        else if (!esCedulaValida(formReg.cedula))
            next.cedula = 'Formato no válido.';
        if (!formReg.email)
            next.email = 'El correo electrónico es obligatorio.';
        else if (!esEmailValido(formReg.email))
            next.email = 'Formato no válido.';
        if (!formReg.password)
            next.password = 'La contraseña es obligatoria.';
        else if (!esPasswordValido(formReg.password))
            next.password = 'Mínimo 8 caracteres y al menos 1 número.';
        if (!formReg.password_confirmation)
            next.password_confirmation = 'Debes confirmar la contraseña.';
        else if (formReg.password !== formReg.password_confirmation)
            next.password_confirmation = 'Las contraseñas no coinciden.';
        return next;
    };

    const handleRegistroSubmit = async (e) => {
        e.preventDefault();
        setServerError('');
        const errs = validateReg();
        if (Object.keys(errs).length > 0) { setErrorsReg(errs); return; }

        setIsLoading(true);
        try {
            await apiClient.post('/v1/register', formReg, {
                headers: { Accept: 'application/json' },
            });
            // Registro exitoso → volver al paso 1 con mensaje
            setSuccessMsg('¡Cuenta creada exitosamente! Ya puedes iniciar sesión.');
            setPaso(PASOS.LOGIN);
            setFormReg({ name: '', cedula: '', email: '', password: '', password_confirmation: '' });
        } catch (err) {
            if (!err.response) { setServerError('Error de red. Verifica tu conexión.'); return; }
            const { status, data } = err.response;
            if (status === 422) {
                setErrorsReg(data.errors ?? {});
            } else {
                setServerError(data.message ?? 'Error inesperado. Intenta de nuevo.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    //  HANDLERS — Paso 1: Login
    // ─────────────────────────────────────────────────────────────
    const handleLoginChange = (e) => {
        const { name, value } = e.target;
        setFormLogin(prev => ({ ...prev, [name]: value }));
        setErrorsLogin(prev => ({ ...prev, [name]: '' }));
        setServerError('');
    };

    const validateLogin = () => {
        const next = {};
        if (!formLogin.email)
            next.email = 'El correo electrónico es obligatorio.';
        else if (!esEmailValido(formLogin.email))
            next.email = 'Ingresa un correo electrónico válido.';
        if (!formLogin.password)
            next.password = 'La contraseña es obligatoria.';
        else if (formLogin.password.length < 8)
            next.password = 'La contraseña debe tener al menos 8 caracteres.';
        return next;
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setServerError('');
        const errs = validateLogin();
        if (Object.keys(errs).length > 0) { setErrorsLogin(errs); return; }

        setIsLoading(true);
        try {
            const loggedUser = await login(formLogin);
            navigate(REDIRECT_BY_ROL[loggedUser.rol] ?? '/dashboard', { replace: true });
        } catch (err) {
            if (!err.response) { setServerError('Error de red. Verifica tu conexión.'); return; }
            const { status, data } = err.response;
            if (status === 422) {
                setErrorsLogin({
                    email:    data.errors?.email?.[0]    ?? '',
                    password: data.errors?.password?.[0] ?? '',
                });
            } else if (status === 423) {
                // Cuenta bloqueada — ir directo al paso 2 con email prellenado
                setEmailOtp(formLogin.email);
                setCuentaLocked(true);
                setPaso(PASOS.SOLICITAR_OTP);
            } else {
                setServerError(data.message ?? 'Error inesperado. Intenta de nuevo.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    //  HANDLERS — Paso 2: Solicitar OTP
    // ─────────────────────────────────────────────────────────────
    const validateEmailOtp = () => {
        if (!emailOtp) return 'El correo electrónico es obligatorio.';
        if (!esEmailValido(emailOtp)) return 'Ingresa un correo electrónico válido.';
        return '';
    };

    const handleSolicitarOtp = async (e) => {
        e.preventDefault();
        const err = validateEmailOtp();
        if (err) { setEmailOtpErr(err); return; }

        setIsLoading(true);
        setEmailOtpErr('');
        try {
            const res = await apiClient.post('/v1/forgot-password',
                { email: emailOtp },
                { headers: { Accept: 'application/json' } }
            );
            setCuentaLocked(res.data.locked ?? false);
            setEmailWizard(emailOtp);
            setOtpEnviado(true);
            // Avanzar al paso 3 tras 1.5s para que el usuario vea el mensaje
            setTimeout(() => { setOtpEnviado(false); setPaso(PASOS.VERIFICAR_OTP); }, 1500);
        } catch (err) {
            if (!err.response) { setEmailOtpErr('Error de red. Verifica tu conexión.'); return; }
            const { status, data } = err.response;
            if (status === 422) {
                setEmailOtpErr(data.errors?.email?.[0] ?? 'Correo no encontrado en el sistema.');
            } else {
                setEmailOtpErr(data.message ?? 'Error inesperado.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    //  HANDLERS — Paso 3: Verificar OTP
    // ─────────────────────────────────────────────────────────────
    const handleOtpChange = (e) => {
        // Solo permite dígitos, máximo 6
        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
        setOtp(val);
        setOtpError('');
    };

    const handleVerificarOtp = async (e) => {
        e.preventDefault();
        if (!esOtpValido(otp)) {
            setOtpError('El código debe tener exactamente 6 dígitos numéricos.');
            return;
        }

        setIsLoading(true);
        setOtpError('');
        try {
            await apiClient.post('/v1/verify-otp',
                { email: emailWizard, otp },
                { headers: { Accept: 'application/json' } }
            );
            setOtpVerificado(true);
            setPaso(PASOS.NUEVA_PASSWORD);
        } catch (err) {
            if (!err.response) { setOtpError('Error de red.'); return; }
            const { status, data } = err.response;
            if (status === 422) {
                setOtpError(data.errors?.otp?.[0] ?? 'Código inválido o expirado.');
            } else {
                setOtpError(data.message ?? 'Error inesperado.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    //  HANDLERS — Paso 4: Nueva contraseña
    // ─────────────────────────────────────────────────────────────
    const validatePassword = () => {
        const next = {};
        if (!newPw)
            next.newPw = 'La nueva contraseña es obligatoria.';
        else if (!esPasswordValido(newPw))
            next.newPw = 'Mínimo 8 caracteres y al menos 1 número.';
        if (!confirmPw)
            next.confirmPw = 'Debes confirmar la contraseña.';
        else if (newPw && confirmPw && newPw !== confirmPw)
            next.confirmPw = 'Las contraseñas no coinciden.';
        return next;
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        const errs = validatePassword();
        if (Object.keys(errs).length > 0) { setPwErrors(errs); return; }

        setIsLoading(true);
        setPwErrors({});
        try {
            await apiClient.post('/v1/reset-password',
                { email: emailWizard, otp, password: newPw, password_confirmation: confirmPw },
                { headers: { Accept: 'application/json' } }
            );
            // Éxito — volver al paso 1 con mensaje de confirmación
            setSuccessMsg('Contraseña actualizada correctamente. Ya puedes iniciar sesión.');
            setPaso(PASOS.LOGIN);
            setOtp('');
            setNewPw('');
            setConfirmPw('');
            setEmailWizard('');
            setOtpVerificado(false);
        } catch (err) {
            if (!err.response) { setPwErrors({ newPw: 'Error de red.' }); return; }
            const { status, data } = err.response;
            if (status === 422) {
                setPwErrors({
                    newPw:    data.errors?.password?.[0] ?? '',
                    confirmPw: data.errors?.otp?.[0] ?? data.message ?? '',
                });
            } else {
                setPwErrors({ newPw: data.message ?? 'Error inesperado.' });
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ── Cambio de idioma ─────────────────────────────────────────
    const toggleLocale = () => {
        const next = locale === 'es' ? 'en' : 'es';
        localStorage.setItem('siget_locale', next);
        setLocale(next);
        i18n.changeLanguage(next);
    };

    // ── Volver al paso anterior ───────────────────────────────────
    const volverAlLogin = () => {
        setPaso(PASOS.LOGIN);
        setEmailOtp('');
        setEmailOtpErr('');
        setOtp('');
        setOtpError('');
        setNewPw('');
        setConfirmPw('');
        setPwErrors({});
        setServerError('');
        setCuentaLocked(false);
    };

    // ── Indicador de progreso (pasos 2-4) ────────────────────────
    const renderProgreso = () => {
        if (paso === PASOS.LOGIN || paso === PASOS.REGISTRO) return null;
        const pasos = [
            { num: 2, label: 'Correo'     },
            { num: 3, label: 'Código OTP' },
            { num: 4, label: 'Contraseña' },
        ];
        return (
            <div className="wizard-progress" role="progressbar" aria-label="Progreso de recuperación">
                {pasos.map((p, idx) => (
                    <div key={p.num} className="wizard-progress__step-wrap">
                        <div className={`wizard-progress__step ${
                            paso === p.num ? 'wizard-progress__step--active' :
                            paso > p.num   ? 'wizard-progress__step--done'   : ''
                        }`}>
                            {paso > p.num ? '✓' : p.num - 1}
                        </div>
                        <span className="wizard-progress__label">{p.label}</span>
                        {idx < pasos.length - 1 && (
                            <div className={`wizard-progress__line ${paso > p.num ? 'wizard-progress__line--done' : ''}`} />
                        )}
                    </div>
                ))}
            </div>
        );
    };

    // ─────────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="login-root">

            {/* ── Panel Izquierdo: Identidad ──────────────────── */}
            <aside className="login-brand" aria-hidden="true">
                <div className="login-brand__grid" />
                <div className="login-brand__content">
                    <div className="login-brand__logo">
                        <span className="login-brand__logo-letter">S</span>
                    </div>
                    <div className="login-brand__text">
                        <h1 className="login-brand__title">SIGET</h1>
                        <p className="login-brand__subtitle">SISTEMA DE GESTIÓN TERRITORIAL</p>
                    </div>
                    <p className="login-brand__description">
                        {paso === PASOS.REGISTRO
                            ? 'Crea tu cuenta para acceder a los servicios digitales de tu Consejo Comunal.'
                            : paso === PASOS.LOGIN
                            ? 'Plataforma integral para la administración, seguimiento y participación de los Consejos Comunales.'
                            : 'Recupera el acceso a tu cuenta de forma segura mediante un código de verificación de un solo uso.'
                        }
                    </p>
                    <div className="login-brand__divider" />
                    <div className="login-brand__badges">
                        {paso === PASOS.REGISTRO ? (
                            <>
                                <span className="login-brand__badge">Gratuito</span>
                                <span className="login-brand__badge">Seguro</span>
                                <span className="login-brand__badge">Comunal</span>
                            </>
                        ) : paso === PASOS.LOGIN ? (
                            <>
                                <span className="login-brand__badge">Censo</span>
                                <span className="login-brand__badge">Proyectos</span>
                                <span className="login-brand__badge">Voceros</span>
                            </>
                        ) : (
                            <>
                                <span className="login-brand__badge">Seguro</span>
                                <span className="login-brand__badge">OTP 6 dígitos</span>
                                <span className="login-brand__badge">15 min</span>
                            </>
                        )}
                    </div>
                </div>
                <p className="login-brand__footer">
                    © {new Date().getFullYear()} SIGET · Todos los derechos reservados
                </p>
            </aside>

            {/* ── Panel Derecho: Formulario ────────────────────── */}
            <main className="login-form-panel">

                {/* Botón de idioma */}
                <button type="button" className="login-lang-toggle" onClick={toggleLocale}>
                    <span className="login-lang-toggle__flag">
                        {locale === 'es' ? '🇻🇪' : '🇺🇸'}
                    </span>
                    <span>{locale === 'es' ? 'ES' : 'EN'}</span>
                </button>

                <div className="login-form-wrapper">

                    {/* ── Indicador de progreso ──── */}
                    {renderProgreso()}

                    {/* ── Alertas globales ──────── */}
                    {successMsg && (
                        <div className="login-alert login-alert--success" role="alert">
                            <span className="login-alert__icon">✅</span>
                            <span>{successMsg}</span>
                        </div>
                    )}
                    {serverError && (
                        <div className="login-alert login-alert--error" role="alert">
                            <span className="login-alert__icon">⚠</span>
                            <span>{serverError}</span>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════
                        PASO 0 — Crear Cuenta (Registro)
                    ══════════════════════════════════════════════ */}
                    {paso === PASOS.REGISTRO && (
                        <>
                            <header className="login-form-header">
                                <h2 className="login-form-header__title">Crear Cuenta</h2>
                                <p className="login-form-header__subtitle">
                                    Regístrate como habitante de la comunidad
                                </p>
                            </header>

                            <form className="login-form" onSubmit={handleRegistroSubmit} noValidate>

                                {/* Nombre */}
                                <div className={`login-field ${errorsReg.name ? 'login-field--error' : ''}`}>
                                    <label htmlFor="reg-name" className="login-field__label">
                                        Nombre completo
                                    </label>
                                    <div className="login-field__input-wrapper">
                                        <span className="login-field__icon">👤</span>
                                        <input
                                            id="reg-name" name="name" type="text"
                                            autoComplete="name"
                                            value={formReg.name}
                                            onChange={handleRegChange}
                                            placeholder="Juan Pérez"
                                            className="login-field__input"
                                            disabled={isLoading}
                                            autoFocus
                                        />
                                    </div>
                                    {errorsReg.name && (
                                        <p className="login-field__error" role="alert">
                                            {getRegErr('name')}
                                        </p>
                                    )}
                                </div>

                                {/* Cédula */}
                                <div className={`login-field ${errorsReg.cedula ? 'login-field--error' : ''}`}>
                                    <label htmlFor="reg-cedula" className="login-field__label">
                                        Cédula de identidad
                                    </label>
                                    <div className="login-field__input-wrapper">
                                        <span className="login-field__icon">🪪</span>
                                        <input
                                            id="reg-cedula" name="cedula" type="text"
                                            value={formReg.cedula}
                                            onChange={handleRegChange}
                                            placeholder="V-12345678"
                                            className="login-field__input"
                                            disabled={isLoading}
                                        />
                                    </div>
                                    {errorsReg.cedula && (
                                        <p className="login-field__error" role="alert">
                                            {getRegErr('cedula')}
                                        </p>
                                    )}
                                    <p className="login-field__hint">
                                        Formato: V-12345678 o E-12345678
                                    </p>
                                </div>

                                {/* Email */}
                                <div className={`login-field ${errorsReg.email ? 'login-field--error' : ''}`}>
                                    <label htmlFor="reg-email" className="login-field__label">
                                        Correo electrónico
                                    </label>
                                    <div className="login-field__input-wrapper">
                                        <span className="login-field__icon">✉</span>
                                        <input
                                            id="reg-email" name="email" type="email"
                                            autoComplete="email"
                                            value={formReg.email}
                                            onChange={handleRegChange}
                                            placeholder="correo@ejemplo.com"
                                            className="login-field__input"
                                            disabled={isLoading}
                                        />
                                    </div>
                                    {errorsReg.email && (
                                        <p className="login-field__error" role="alert">
                                            {getRegErr('email')}
                                        </p>
                                    )}
                                </div>

                                {/* Contraseña */}
                                <div className={`login-field ${errorsReg.password ? 'login-field--error' : ''}`}>
                                    <label htmlFor="reg-password" className="login-field__label">
                                        Contraseña
                                    </label>
                                    <div className="login-field__input-wrapper">
                                        <span className="login-field__icon">🔒</span>
                                        <input
                                            id="reg-password" name="password"
                                            type={showRegPw ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            value={formReg.password}
                                            onChange={handleRegChange}
                                            placeholder="Mínimo 8 caracteres y 1 número"
                                            className="login-field__input"
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="button"
                                            className="login-field__toggle-pw"
                                            onClick={() => setShowRegPw(v => !v)}
                                            tabIndex={-1}
                                            aria-label={showRegPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                        >
                                            {showRegPw ? '🙈' : '👁'}
                                        </button>
                                    </div>
                                    {errorsReg.password && (
                                        <p className="login-field__error" role="alert">
                                            {getRegErr('password')}
                                        </p>
                                    )}
                                    {/* Indicador de fortaleza */}
                                    {formReg.password && (
                                        <div className="pw-strength">
                                            <div className={`pw-strength__bar ${
                                                formReg.password.length >= 12 && /[A-Z]/.test(formReg.password) && /\d/.test(formReg.password) ? 'pw-strength__bar--fuerte' :
                                                formReg.password.length >= 8  && /\d/.test(formReg.password)                                    ? 'pw-strength__bar--media'  :
                                                'pw-strength__bar--debil'
                                            }`} />
                                            <span className="pw-strength__label">
                                                {formReg.password.length >= 12 && /[A-Z]/.test(formReg.password) && /\d/.test(formReg.password) ? '💪 Fuerte' :
                                                 formReg.password.length >= 8  && /\d/.test(formReg.password)                                    ? '👍 Aceptable' :
                                                 '⚠ Débil'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Confirmar contraseña */}
                                <div className={`login-field ${errorsReg.password_confirmation ? 'login-field--error' : ''}`}>
                                    <label htmlFor="reg-confirm" className="login-field__label">
                                        Confirmar contraseña
                                    </label>
                                    <div className="login-field__input-wrapper">
                                        <span className="login-field__icon">🔒</span>
                                        <input
                                            id="reg-confirm"
                                            name="password_confirmation"
                                            type={showRegPw ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            value={formReg.password_confirmation}
                                            onChange={handleRegChange}
                                            placeholder="Repite tu contraseña"
                                            className="login-field__input"
                                            disabled={isLoading}
                                        />
                                    </div>
                                    {errorsReg.password_confirmation && (
                                        <p className="login-field__error" role="alert">
                                            {getRegErr('password_confirmation')}
                                        </p>
                                    )}
                                    {/* Indicador de coincidencia */}
                                    {formReg.password_confirmation && formReg.password && (
                                        <p className={`login-field__hint ${formReg.password_confirmation === formReg.password ? 'login-field__hint--ok' : 'login-field__hint--err'}`}>
                                            {formReg.password_confirmation === formReg.password
                                                ? '✓ Las contraseñas coinciden'
                                                : '✗ Las contraseñas no coinciden'}
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    className={`login-submit ${isLoading ? 'login-submit--loading' : ''}`}
                                    disabled={isLoading}
                                >
                                    {isLoading
                                        ? <><span className="login-submit__spinner" aria-hidden="true" /> Creando cuenta…</>
                                        : 'Crear Cuenta'
                                    }
                                </button>
                            </form>

                            <div className="login-form-footer-group">
                                <p className="login-form-footer">
                                    ¿Ya tienes cuenta?{' '}
                                    <button
                                        type="button"
                                        className="login-form-footer__link login-form-footer__link--btn"
                                        onClick={() => {
                                            setErrorsReg({});
                                            setServerError('');
                                            setPaso(PASOS.LOGIN);
                                        }}
                                    >
                                        Inicia sesión
                                    </button>
                                </p>
                            </div>
                        </>
                    )}

                    {/* ══════════════════════════════════════════════
                        PASO 1 — Formulario de Login
                    ══════════════════════════════════════════════ */}
                    {paso === PASOS.LOGIN && (
                        <>
                            <header className="login-form-header">
                                <h2 className="login-form-header__title">Acceder al sistema</h2>
                                <p className="login-form-header__subtitle">Ingresa tus credenciales para continuar</p>
                            </header>

                            <form className="login-form" onSubmit={handleLoginSubmit} noValidate>

                                {/* Email */}
                                <div className={`login-field ${errorsLogin.email ? 'login-field--error' : ''}`}>
                                    <label htmlFor="login-email" className="login-field__label">
                                        Correo electrónico
                                    </label>
                                    <div className="login-field__input-wrapper">
                                        <span className="login-field__icon">✉</span>
                                        <input
                                            id="login-email" name="email" type="email"
                                            autoComplete="email"
                                            value={formLogin.email}
                                            onChange={handleLoginChange}
                                            placeholder="usuario@siget.gob.ve"
                                            className="login-field__input"
                                            disabled={isLoading}
                                            aria-invalid={!!errorsLogin.email}
                                            aria-describedby={errorsLogin.email ? 'login-email-err' : undefined}
                                        />
                                    </div>
                                    {errorsLogin.email && (
                                        <p id="login-email-err" className="login-field__error" role="alert">
                                            {errorsLogin.email}
                                        </p>
                                    )}
                                </div>

                                {/* Contraseña */}
                                <div className={`login-field ${errorsLogin.password ? 'login-field--error' : ''}`}>
                                    <label htmlFor="login-password" className="login-field__label">
                                        Contraseña
                                    </label>
                                    <div className="login-field__input-wrapper">
                                        <span className="login-field__icon">🔒</span>
                                        <input
                                            id="login-password" name="password"
                                            type={showPw ? 'text' : 'password'}
                                            autoComplete="current-password"
                                            value={formLogin.password}
                                            onChange={handleLoginChange}
                                            placeholder="••••••••"
                                            className="login-field__input"
                                            disabled={isLoading}
                                            aria-invalid={!!errorsLogin.password}
                                            aria-describedby={errorsLogin.password ? 'login-pw-err' : undefined}
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
                                    {errorsLogin.password && (
                                        <p id="login-pw-err" className="login-field__error" role="alert">
                                            {errorsLogin.password}
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    className={`login-submit ${isLoading ? 'login-submit--loading' : ''}`}
                                    disabled={isLoading}
                                >
                                    {isLoading
                                        ? <><span className="login-submit__spinner" aria-hidden="true" /> Iniciando sesión...</>
                                        : 'Iniciar sesión'
                                    }
                                </button>
                            </form>

                            <div className="login-form-footer-group">
                                <p className="login-form-footer">
                                    <button
                                        type="button"
                                        className="login-form-footer__link login-form-footer__link--btn"
                                        onClick={() => {
                                            setSuccessMsg('');
                                            setServerError('');
                                            setPaso(PASOS.SOLICITAR_OTP);
                                        }}
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </p>
                                <p className="login-form-footer">
                                    ¿No tienes cuenta?{' '}
                                    <button
                                        type="button"
                                        className="login-form-footer__link login-form-footer__link--btn"
                                        onClick={() => {
                                            setSuccessMsg('');
                                            setServerError('');
                                            setPaso(PASOS.REGISTRO);
                                        }}
                                    >
                                        Regístrate aquí
                                    </button>
                                </p>
                            </div>
                        </>
                    )}

                    {/* ══════════════════════════════════════════════
                        PASO 2 — Solicitar OTP
                    ══════════════════════════════════════════════ */}
                    {paso === PASOS.SOLICITAR_OTP && (
                        <>
                            <header className="login-form-header">
                                <h2 className="login-form-header__title">
                                    {cuentaLocked ? 'Desbloquear Cuenta' : 'Recuperar Contraseña'}
                                </h2>
                                <p className="login-form-header__subtitle">
                                    Te enviaremos un código de 6 dígitos a tu correo
                                </p>
                            </header>

                            {otpEnviado && (
                                <div className="login-alert login-alert--success" role="status">
                                    <span className="login-alert__icon">✅</span>
                                    <span>Código enviado a <strong>{emailOtp}</strong>. Redirigiendo…</span>
                                </div>
                            )}

                            {!otpEnviado && (
                                <form className="login-form" onSubmit={handleSolicitarOtp} noValidate>
                                    <div className={`login-field ${emailOtpErr ? 'login-field--error' : ''}`}>
                                        <label htmlFor="otp-email" className="login-field__label">
                                            Correo electrónico registrado
                                        </label>
                                        <div className="login-field__input-wrapper">
                                            <span className="login-field__icon">✉</span>
                                            <input
                                                id="otp-email" name="email" type="email"
                                                autoComplete="email"
                                                value={emailOtp}
                                                onChange={(e) => {
                                                    setEmailOtp(e.target.value);
                                                    setEmailOtpErr('');
                                                }}
                                                placeholder="correo@ejemplo.com"
                                                className="login-field__input"
                                                disabled={isLoading}
                                                autoFocus
                                                aria-invalid={!!emailOtpErr}
                                                aria-describedby={emailOtpErr ? 'otp-email-err' : undefined}
                                            />
                                        </div>
                                        {emailOtpErr && (
                                            <p id="otp-email-err" className="login-field__error" role="alert">
                                                {emailOtpErr}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        className={`login-submit ${isLoading ? 'login-submit--loading' : ''}`}
                                        disabled={isLoading}
                                    >
                                        {isLoading
                                            ? <><span className="login-submit__spinner" aria-hidden="true" /> Enviando código…</>
                                            : 'Enviar Código OTP'
                                        }
                                    </button>
                                </form>
                            )}

                            <div className="login-form-footer-group">
                                <p className="login-form-footer">
                                    <button type="button" className="login-form-footer__link login-form-footer__link--btn" onClick={volverAlLogin}>
                                        ← Volver al inicio de sesión
                                    </button>
                                </p>
                            </div>
                        </>
                    )}

                    {/* ══════════════════════════════════════════════
                        PASO 3 — Verificar OTP
                    ══════════════════════════════════════════════ */}
                    {paso === PASOS.VERIFICAR_OTP && (
                        <>
                            <header className="login-form-header">
                                <h2 className="login-form-header__title">Ingresa el Código</h2>
                                <p className="login-form-header__subtitle">
                                    Código de 6 dígitos enviado a <strong>{emailWizard}</strong>
                                </p>
                            </header>

                            <form className="login-form" onSubmit={handleVerificarOtp} noValidate>
                                <div className={`login-field ${otpError ? 'login-field--error' : ''}`}>
                                    <label htmlFor="otp-code" className="login-field__label">
                                        Código de verificación
                                    </label>
                                    <div className="login-field__input-wrapper">
                                        <span className="login-field__icon">🔑</span>
                                        <input
                                            id="otp-code"
                                            ref={otpRef}
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            value={otp}
                                            onChange={handleOtpChange}
                                            placeholder="000000"
                                            className="login-field__input login-field__input--otp"
                                            disabled={isLoading}
                                            maxLength={6}
                                            aria-invalid={!!otpError}
                                            aria-describedby={otpError ? 'otp-err' : undefined}
                                        />
                                    </div>
                                    {otpError && (
                                        <p id="otp-err" className="login-field__error" role="alert">
                                            {otpError}
                                        </p>
                                    )}
                                    <p className="login-field__hint">
                                        ⏱ El código expira en 15 minutos.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    className={`login-submit ${isLoading ? 'login-submit--loading' : ''}`}
                                    disabled={isLoading || otp.length !== 6}
                                >
                                    {isLoading
                                        ? <><span className="login-submit__spinner" aria-hidden="true" /> Verificando…</>
                                        : 'Verificar Código'
                                    }
                                </button>
                            </form>

                            <div className="login-form-footer-group">
                                <p className="login-form-footer">
                                    <button
                                        type="button"
                                        className="login-form-footer__link login-form-footer__link--btn"
                                        onClick={() => setPaso(PASOS.SOLICITAR_OTP)}
                                        disabled={isLoading}
                                    >
                                        ¿No recibiste el código? Reenviar
                                    </button>
                                </p>
                                <p className="login-form-footer">
                                    <button type="button" className="login-form-footer__link login-form-footer__link--btn" onClick={volverAlLogin}>
                                        ← Volver al inicio de sesión
                                    </button>
                                </p>
                            </div>
                        </>
                    )}

                    {/* ══════════════════════════════════════════════
                        PASO 4 — Nueva Contraseña
                    ══════════════════════════════════════════════ */}
                    {paso === PASOS.NUEVA_PASSWORD && (
                        <>
                            <header className="login-form-header">
                                <h2 className="login-form-header__title">Nueva Contraseña</h2>
                                <p className="login-form-header__subtitle">
                                    Elige una contraseña segura para tu cuenta
                                </p>
                            </header>

                            <form className="login-form" onSubmit={handleResetPassword} noValidate>

                                {/* Nueva contraseña */}
                                <div className={`login-field ${pwErrors.newPw ? 'login-field--error' : ''}`}>
                                    <label htmlFor="new-pw" className="login-field__label">
                                        Nueva contraseña
                                    </label>
                                    <div className="login-field__input-wrapper">
                                        <span className="login-field__icon">🔒</span>
                                        <input
                                            id="new-pw"
                                            type={showNewPw ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            value={newPw}
                                            onChange={(e) => {
                                                setNewPw(e.target.value);
                                                setPwErrors(p => ({ ...p, newPw: '' }));
                                            }}
                                            placeholder="Mínimo 8 caracteres y 1 número"
                                            className="login-field__input"
                                            disabled={isLoading}
                                            autoFocus
                                            aria-invalid={!!pwErrors.newPw}
                                            aria-describedby={pwErrors.newPw ? 'new-pw-err' : undefined}
                                        />
                                        <button
                                            type="button"
                                            className="login-field__toggle-pw"
                                            onClick={() => setShowNewPw(v => !v)}
                                            tabIndex={-1}
                                            aria-label={showNewPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                        >
                                            {showNewPw ? '🙈' : '👁'}
                                        </button>
                                    </div>
                                    {pwErrors.newPw && (
                                        <p id="new-pw-err" className="login-field__error" role="alert">
                                            {pwErrors.newPw}
                                        </p>
                                    )}
                                    {/* Indicador de fortaleza */}
                                    {newPw && (
                                        <div className="pw-strength">
                                            <div className={`pw-strength__bar ${
                                                newPw.length >= 12 && /[A-Z]/.test(newPw) && /\d/.test(newPw) ? 'pw-strength__bar--fuerte' :
                                                newPw.length >= 8  && /\d/.test(newPw)                        ? 'pw-strength__bar--media'  :
                                                'pw-strength__bar--debil'
                                            }`} />
                                            <span className="pw-strength__label">
                                                {newPw.length >= 12 && /[A-Z]/.test(newPw) && /\d/.test(newPw) ? '💪 Fuerte' :
                                                 newPw.length >= 8  && /\d/.test(newPw)                        ? '👍 Aceptable' :
                                                 '⚠ Débil'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Confirmar contraseña */}
                                <div className={`login-field ${pwErrors.confirmPw ? 'login-field--error' : ''}`}>
                                    <label htmlFor="confirm-pw" className="login-field__label">
                                        Confirmar contraseña
                                    </label>
                                    <div className="login-field__input-wrapper">
                                        <span className="login-field__icon">🔒</span>
                                        <input
                                            id="confirm-pw"
                                            type={showConfirm ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            value={confirmPw}
                                            onChange={(e) => {
                                                setConfirmPw(e.target.value);
                                                setPwErrors(p => ({ ...p, confirmPw: '' }));
                                            }}
                                            placeholder="Repite la contraseña"
                                            className="login-field__input"
                                            disabled={isLoading}
                                            aria-invalid={!!pwErrors.confirmPw}
                                            aria-describedby={pwErrors.confirmPw ? 'confirm-pw-err' : undefined}
                                        />
                                        <button
                                            type="button"
                                            className="login-field__toggle-pw"
                                            onClick={() => setShowConfirm(v => !v)}
                                            tabIndex={-1}
                                            aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                        >
                                            {showConfirm ? '🙈' : '👁'}
                                        </button>
                                    </div>
                                    {pwErrors.confirmPw && (
                                        <p id="confirm-pw-err" className="login-field__error" role="alert">
                                            {pwErrors.confirmPw}
                                        </p>
                                    )}
                                    {/* Indicador de coincidencia */}
                                    {confirmPw && newPw && (
                                        <p className={`login-field__hint ${confirmPw === newPw ? 'login-field__hint--ok' : 'login-field__hint--err'}`}>
                                            {confirmPw === newPw ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    className={`login-submit ${isLoading ? 'login-submit--loading' : ''}`}
                                    disabled={isLoading}
                                >
                                    {isLoading
                                        ? <><span className="login-submit__spinner" aria-hidden="true" /> Guardando…</>
                                        : 'Guardar Nueva Contraseña'
                                    }
                                </button>
                            </form>
                        </>
                    )}

                </div>
            </main>
        </div>
    );
}

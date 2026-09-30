/**
 * CuentaPagoForm.jsx — SIGET
 * Ruta física: resources/js/pages/pagos/CuentaPagoForm.jsx
 *
 * Registrar en app.jsx:
 *   import CuentaPagoForm from './pages/pagos/CuentaPagoForm';
 *   <Route path="/cuentas-pago/crear" element={
 *       <ProtectedRoute><CuentaPagoForm /></ProtectedRoute>
 *   } />
 *
 * Solo se usa para CREAR. La edición de cuentas existentes se hace
 * inline en CuentaPagoList.jsx (mismo patrón que OrganizacionForm/List).
 *
 * CAMBIO (sept-2026, corrección 2 del profesor: proceso de pago) —
 * se agrega el selector de método (pago móvil / transferencia). El
 * campo bancario que se pide cambia según el método: teléfono para
 * pago móvil, número de cuenta para transferencia.
 */

import { useState }              from 'react';
import { useNavigate }           from 'react-router-dom';
import apiClient                 from '../../services/axios';
import './CuentaPagoForm.css';

const FORM_INICIAL = {
    nombre_servicio: '',
    metodo:          'pago_movil',
    banco:           '',
    telefono:        '',
    numero_cuenta:   '',
    cedula_rif:      '',
    titular:         '',
    descripcion:     '',
    activa:          true,
};

export default function CuentaPagoForm() {
    const navigate = useNavigate();

    // ── Estado del formulario ──────────────────────────────────
    const [form,    setForm]    = useState(FORM_INICIAL);
    const [errors,  setErrors]  = useState({});
    const [saving,  setSaving]  = useState(false);

    // ── Toast interno (sin dependencia externa) ────────────────
    const [toast, setToast] = useState(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // ── Manejadores de campo ───────────────────────────────────
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    // ── Envío del formulario ───────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.nombre_servicio.trim()) {
            setErrors({ nombre_servicio: ['El nombre del servicio es obligatorio.'] });
            return;
        }

        setSaving(true);
        setErrors({});

        try {
            await apiClient.post('/v1/cuentas-pago', form);
            showToast('Cuenta de pago registrada correctamente.');
            setTimeout(() => navigate('/cuentas-pago'), 900);

        } catch (err) {
            if (err.response?.status === 422) {
                setErrors(err.response.data?.errors ?? {});
            } else if (err.response?.status === 403) {
                showToast('No tienes permiso para realizar esta acción.', 'error');
            } else {
                showToast(
                    err.response?.data?.message ?? 'Error inesperado. Intenta de nuevo.',
                    'error'
                );
            }
        } finally {
            setSaving(false);
        }
    };

    const fieldErr = (name) => errors[name]?.[0] ?? '';

    // ─────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────
    return (
        <div className="cpform-page">

            {/* ── Toast de notificación ─────────────────────── */}
            {toast && (
                <div className={`cpform-toast cpform-toast--${toast.type}`} role="alert">
                    <span>{toast.type === 'success' ? '✓' : '⚠'}</span>
                    {toast.msg}
                </div>
            )}

            {/* ── Topbar ────────────────────────────────────── */}
            <header className="cpform-topbar">
                <button
                    className="cpform-topbar__back"
                    onClick={() => navigate('/cuentas-pago')}
                    type="button"
                >
                    ← Cuentas de Pago
                </button>
                <div className="cpform-topbar__breadcrumb">
                    <span>SIGET</span>
                    <span>›</span>
                    <span>Cuentas de Pago</span>
                    <span>›</span>
                    <span>Nueva</span>
                </div>
            </header>

            {/* ── Card del formulario ───────────────────────── */}
            <div className="cpform-container">
                <div className="cpform-card">

                    {/* Encabezado de la card */}
                    <div className="cpform-card__header">
                        <div className="cpform-card__header-icon">💳</div>
                        <div>
                            <h1 className="cpform-card__title">Nueva Cuenta de Pago</h1>
                            <p className="cpform-card__subtitle">
                                Registra los datos bancarios que el ciudadano verá al pagar
                                este servicio desde el Portal Ciudadano.
                            </p>
                        </div>
                    </div>

                    {/* Cuerpo del formulario */}
                    <form onSubmit={handleSubmit} className="cpform-body" noValidate>

                        {/* ── Nombre del servicio ───────────── */}
                        <div className="cpform-field">
                            <label className="cpform-label" htmlFor="nombre_servicio">
                                Nombre del servicio <span className="cpform-required">*</span>
                            </label>
                            <input
                                id="nombre_servicio"
                                name="nombre_servicio"
                                type="text"
                                value={form.nombre_servicio}
                                onChange={handleChange}
                                maxLength={100}
                                placeholder="Ej. Gas, Cuota mensual, Aseo urbano..."
                                className={`cpform-input ${fieldErr('nombre_servicio') ? 'cpform-input--error' : ''}`}
                                autoFocus
                            />
                            {fieldErr('nombre_servicio') && (
                                <span className="cpform-field__error">{fieldErr('nombre_servicio')}</span>
                            )}
                        </div>

                        {/* ── Método de pago ─────────────────── */}
                        <div className="cpform-field">
                            <label className="cpform-label" htmlFor="metodo">
                                Método de pago <span className="cpform-required">*</span>
                            </label>
                            <select
                                id="metodo"
                                name="metodo"
                                value={form.metodo}
                                onChange={handleChange}
                                className={`cpform-select ${fieldErr('metodo') ? 'cpform-input--error' : ''}`}
                            >
                                <option value="pago_movil">Pago móvil</option>
                                <option value="transferencia">Transferencia</option>
                            </select>
                            {fieldErr('metodo') && (
                                <span className="cpform-field__error">{fieldErr('metodo')}</span>
                            )}
                        </div>

                        {/* ── Banco ──────────────────────────── */}
                        <div className="cpform-field">
                            <label className="cpform-label" htmlFor="banco">
                                Banco <span className="cpform-required">*</span>
                            </label>
                            <input
                                id="banco"
                                name="banco"
                                type="text"
                                value={form.banco}
                                onChange={handleChange}
                                maxLength={100}
                                placeholder="Ej. Banco de Venezuela (0102)"
                                className={`cpform-input ${fieldErr('banco') ? 'cpform-input--error' : ''}`}
                            />
                            {fieldErr('banco') && (
                                <span className="cpform-field__error">{fieldErr('banco')}</span>
                            )}
                        </div>

                        {/* ── Dato bancario según el método + Cédula/RIF ──── */}
                        <div className="cpform-row">
                            {form.metodo === 'transferencia' ? (
                                <div className="cpform-field">
                                    <label className="cpform-label" htmlFor="numero_cuenta">
                                        Número de cuenta <span className="cpform-required">*</span>
                                    </label>
                                    <input
                                        id="numero_cuenta"
                                        name="numero_cuenta"
                                        type="text"
                                        value={form.numero_cuenta}
                                        onChange={handleChange}
                                        maxLength={20}
                                        placeholder="0102-1234-56-1234567890"
                                        className={`cpform-input ${fieldErr('numero_cuenta') ? 'cpform-input--error' : ''}`}
                                    />
                                    {fieldErr('numero_cuenta') && (
                                        <span className="cpform-field__error">{fieldErr('numero_cuenta')}</span>
                                    )}
                                </div>
                            ) : (
                                <div className="cpform-field">
                                    <label className="cpform-label" htmlFor="telefono">
                                        Teléfono (Pago Móvil) <span className="cpform-required">*</span>
                                    </label>
                                    <input
                                        id="telefono"
                                        name="telefono"
                                        type="text"
                                        value={form.telefono}
                                        onChange={handleChange}
                                        maxLength={20}
                                        placeholder="0412-1234567"
                                        className={`cpform-input ${fieldErr('telefono') ? 'cpform-input--error' : ''}`}
                                    />
                                    {fieldErr('telefono') && (
                                        <span className="cpform-field__error">{fieldErr('telefono')}</span>
                                    )}
                                </div>
                            )}

                            <div className="cpform-field">
                                <label className="cpform-label" htmlFor="cedula_rif">
                                    Cédula/RIF <span className="cpform-required">*</span>
                                </label>
                                <input
                                    id="cedula_rif"
                                    name="cedula_rif"
                                    type="text"
                                    value={form.cedula_rif}
                                    onChange={handleChange}
                                    maxLength={20}
                                    placeholder="V-12345678 o J-12345678-9"
                                    className={`cpform-input ${fieldErr('cedula_rif') ? 'cpform-input--error' : ''}`}
                                />
                                {fieldErr('cedula_rif') && (
                                    <span className="cpform-field__error">{fieldErr('cedula_rif')}</span>
                                )}
                            </div>
                        </div>

                        {/* ── Titular ────────────────────────── */}
                        <div className="cpform-field">
                            <label className="cpform-label" htmlFor="titular">
                                Titular de la cuenta <span className="cpform-required">*</span>
                            </label>
                            <input
                                id="titular"
                                name="titular"
                                type="text"
                                value={form.titular}
                                onChange={handleChange}
                                maxLength={150}
                                placeholder="Ej. Consejo Comunal Ana Karina Rote 2019"
                                className={`cpform-input ${fieldErr('titular') ? 'cpform-input--error' : ''}`}
                            />
                            {fieldErr('titular') && (
                                <span className="cpform-field__error">{fieldErr('titular')}</span>
                            )}
                        </div>

                        {/* ── Descripción ────────────────────── */}
                        <div className="cpform-field">
                            <label className="cpform-label" htmlFor="descripcion">
                                Nota para el ciudadano
                                <span className="cpform-label__hint"> — opcional</span>
                            </label>
                            <textarea
                                id="descripcion"
                                name="descripcion"
                                value={form.descripcion}
                                onChange={handleChange}
                                maxLength={500}
                                rows={3}
                                placeholder="Ej. Indicar el número de vivienda en el concepto del pago..."
                                className={`cpform-textarea ${fieldErr('descripcion') ? 'cpform-input--error' : ''}`}
                            />
                            <span className="cpform-field__count">
                                {form.descripcion.length}/500
                            </span>
                            {fieldErr('descripcion') && (
                                <span className="cpform-field__error">{fieldErr('descripcion')}</span>
                            )}
                        </div>

                        {/* ── Estatus ────────────────────────── */}
                        <div className="cpform-field cpform-field--switch">
                            <span className="cpform-label">Estatus</span>
                            <label className="cpform-switch" htmlFor="activa">
                                <input
                                    id="activa"
                                    name="activa"
                                    type="checkbox"
                                    checked={form.activa}
                                    onChange={handleChange}
                                    className="cpform-switch__input"
                                />
                                <span className="cpform-switch__track" />
                                <span className="cpform-switch__label">
                                    {form.activa
                                        ? <span className="cpform-status cpform-status--active">Activa — visible para el ciudadano al pagar</span>
                                        : <span className="cpform-status cpform-status--inactive">Inactiva — oculta del Portal Ciudadano</span>
                                    }
                                </span>
                            </label>
                        </div>

                        {/* ── Acciones ───────────────────────── */}
                        <div className="cpform-actions">
                            <button
                                type="button"
                                className="cpform-btn cpform-btn--secondary"
                                onClick={() => navigate('/cuentas-pago')}
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="cpform-btn cpform-btn--primary"
                                disabled={saving}
                            >
                                {saving
                                    ? <><span className="cpform-btn__spinner" /> Guardando...</>
                                    : '+ Registrar cuenta de pago'
                                }
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}

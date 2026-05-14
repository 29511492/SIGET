/**
 * ═══════════════════════════════════════════════════════════════
 *  resources/js/i18n/index.js — Configuración de i18next
 * ───────────────────────────────────────────────────────────────
 *  INSTALACIÓN (ejecutar una sola vez):
 *  npm install i18next react-i18next
 *
 *  DECISIÓN ARQUITECTÓNICA — i18n en el frontend:
 *  Las traducciones del frontend (labels, placeholders, mensajes
 *  de error de validación cliente) viven en archivos JSON locales.
 *  Los mensajes de error del BACKEND (credenciales inválidas,
 *  errores de servidor) llegan ya traducidos desde Laravel,
 *  porque enviamos el header Accept-Language en cada request.
 *  Así cada capa maneja su propia capa de traducción.
 * ═══════════════════════════════════════════════════════════════
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from '../locales/es.json';
import en from '../locales/en.json';

i18n
    .use(initReactI18next)
    .init({
        resources: {
            es: { translation: es },
            en: { translation: en },
        },
        lng:         localStorage.getItem('siget_locale') ?? 'es',
        fallbackLng: 'es',
        interpolation: {
            escapeValue: false, // React ya escapa XSS por defecto
        },
    });

export default i18n;

/**
 * resources/js/services/axios.js — Cliente HTTP centralizado
 */

import axios from 'axios';

const apiClient = axios.create({
    baseURL: '/api',
    timeout: 15000,
    headers: {
        'Content-Type':     'application/json',
        'Accept':           'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
});

// ── Request Interceptor ───────────────────────────────────────────
apiClient.interceptors.request.use(
    (config) => {
        const token  = localStorage.getItem('siget_token');
        const locale = localStorage.getItem('siget_locale') ?? 'es';

        if (token) config.headers['Authorization'] = `Bearer ${token}`;
        config.headers['Accept-Language'] = locale;

        return config;
    },
    (error) => Promise.reject(error)
);

// ── Response Interceptor ──────────────────────────────────────────
apiClient.interceptors.response.use(
    (response) => response,

    (error) => {
        if (error.response?.status === 401) {
            const currentPath = window.location.pathname;
            if (currentPath !== '/login' && currentPath !== '/'){
                localStorage.removeItem('siget_token');
                localStorage.removeItem('siget_user');
                window.location.href = '/login';
            }
        }

        if (error.response?.status === 503) {
            console.error('SIGET: Servidor en mantenimiento.');
        }

        return Promise.reject(error);
    }
);

export default apiClient;

/*
 * vite.config.js — proxy para desarrollo local:
 *
 * import { defineConfig } from 'vite';
 * import react from '@vitejs/plugin-react';
 *
 * export default defineConfig({
 *     plugins: [react()],
 *     server: {
 *         proxy: {
 *             '/api': {
 *                 target: 'http://localhost:8000',
 *                 changeOrigin: true,
 *                 secure: false,
 *             },
 *         },
 *     },
 * });
 */

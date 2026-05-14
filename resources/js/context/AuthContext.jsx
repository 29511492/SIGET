/**
 * ═══════════════════════════════════════════════════════════════
 *  resources/js/context/AuthContext.jsx — Estado global de auth
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA — Context API vs. Redux/Zustand:
 *
 *  El estado de autenticación en SIGET tiene exactamente 3 valores:
 *  { token, user, isLoading }. Context API es suficiente para esto.
 *  Redux/Zustand se justificaría si hubiera múltiples slices de
 *  estado interdependientes (carrito + usuario + notificaciones).
 *  Aplicamos Just-in-Time: empezamos con Context, migramos si crece.
 *
 *  SEGURIDAD — ¿Por qué localStorage y no sessionStorage ni cookie?
 *  ─────────────────────────────────────────────────────────────────
 *  localStorage: persiste entre recargas de página (necesario para
 *  que el usuario no tenga que hacer login al cerrar el tab).
 *  sessionStorage: se borra al cerrar el tab (mala UX).
 *  HttpOnly cookie: la opción MÁS segura (inmune a XSS), pero
 *  requiere configuración adicional de CSRF en Laravel Sanctum.
 *  Para la tesis documentamos localStorage con la nota de que en
 *  producción real se migraría a HttpOnly cookies con SPA mode de Sanctum.
 *
 *  REHIDRATACIÓN AL RECARGAR:
 *  Al montar el AuthProvider, se llama a /api/v1/me para verificar
 *  que el token guardado aún es válido. Si el token expiró en el
 *  servidor, se limpia el estado local automáticamente.
 * ═══════════════════════════════════════════════════════════════
 */

import { createContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../services/axios';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    // Inicializar desde localStorage (estado persistido)
    const [user,      setUserState]  = useState(() => {
        try {
            const stored = localStorage.getItem('siget_user');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });
    const [token,     setTokenState] = useState(() => localStorage.getItem('siget_token'));
    const [isLoading, setIsLoading]  = useState(true); // true hasta verificar el token

    // ── Setters que sincronizan estado + localStorage ──────────────
    const setUser = useCallback((userData) => {
        if (userData) {
            localStorage.setItem('siget_user', JSON.stringify(userData));
        } else {
            localStorage.removeItem('siget_user');
        }
        setUserState(userData);
    }, []);

    const setToken = useCallback((tokenValue) => {
        if (tokenValue) {
            localStorage.setItem('siget_token', tokenValue);
        } else {
            localStorage.removeItem('siget_token');
        }
        setTokenState(tokenValue);
    }, []);

    const clearAuth = useCallback(() => {
        localStorage.removeItem('siget_token');
        localStorage.removeItem('siget_user');
        setUserState(null);
        setTokenState(null);
    }, []);

    // ── Rehidratación al montar: verificar token con el servidor ───
    // Si el token en localStorage ya expiró en el servidor,
    // el interceptor de axios limpiará el estado automáticamente.
    useEffect(() => {
        const verifyToken = async () => {
            const storedToken = localStorage.getItem('siget_token');

            if (!storedToken) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await apiClient.get('/v1/me');
                setUser(response.data.data);
            } catch {
                // Token inválido o expirado — limpiar
                clearAuth();
            } finally {
                setIsLoading(false);
            }
        };

        verifyToken();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Helpers de rol (derivados del estado user) ─────────────────
    // Estos helpers centralizan la lógica de roles.
    // Ningún componente debería comparar strings de rol directamente.
    const isAdmin     = user?.rol === 'admin';
    const isOperador  = user?.rol === 'operador' || isAdmin;
    const canWrite    = user?.permisos?.puede_escribir ?? false;
    const canDelete   = user?.permisos?.puede_eliminar ?? false;

    const value = {
        user,
        token,
        isLoading,
        isAdmin,
        isOperador,
        canWrite,
        canDelete,
        setUser,
        setToken,
        clearAuth,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

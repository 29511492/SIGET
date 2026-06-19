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
 *
 *  CORRECCIONES APLICADAS (fix bucle de login):
 *  ─────────────────────────────────────────────
 *  FIX #1 — Se agregaron login() y logout() al contexto.
 *            Login.jsx los necesita para delegar la persistencia
 *            del token aquí y no manejarla directamente en el form.
 *
 *  FIX #2 — login() guarda token Y user en localStorage ANTES de
 *            llamar a setUser/setToken, para que el interceptor de
 *            axios.js encuentre el Bearer token si el Dashboard
 *            dispara peticiones al montar (ej: GET /dashboard/stats).
 *
 *  FIX #3 — login() devuelve el objeto user completo para que
 *            Login.jsx pueda redirigir por rol sin una segunda
 *            petición a /me.
 *
 *  Todo lo demás (isLoading=true, .finally(), helpers de rol,
 *  setUser/setToken/clearAuth) ya estaba correcto en tu versión.
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
    const isAdmin    = user?.rol === 'admin';
    const isOperador = user?.rol === 'operador' || isAdmin;
    const canWrite   = user?.permisos?.puede_escribir ?? false;
    const canDelete  = user?.permisos?.puede_eliminar ?? false;

    // ── ✅ FIX #1 — login() ────────────────────────────────────────
    // Centraliza la persistencia del token y el user en un solo lugar.
    // Login.jsx llama a este método y recibe el user para redirigir
    // por rol, sin manipular localStorage directamente en el form.
    const login = useCallback(async (credentials) => {
        // AuthController@login devuelve:
        // { message: '...', data: { token: '...', user: UserResource } }
        const { data } = await apiClient.post('/v1/login', credentials);
        const { token: newToken, user: loggedUser } = data.data;

        // ✅ FIX #2 — persistir en localStorage ANTES de actualizar
        // el estado de React. El interceptor de axios.js inyecta el
        // Bearer token leyendo localStorage en cada request. Si setUser
        // dispara un re-render que monta el Dashboard antes de que el
        // token esté guardado, GET /dashboard/stats recibiría un 401.
        localStorage.setItem('siget_token', newToken);
        localStorage.setItem('siget_user',  JSON.stringify(loggedUser));

        setTokenState(newToken);
        setUserState(loggedUser);

        // ✅ FIX #3 — devolver el user para que Login.jsx redirija
        // según el rol sin necesitar una segunda petición a /me.
        return loggedUser;
    }, []);

    // ── ✅ FIX #1 — logout() ───────────────────────────────────────
    // Centraliza el cierre de sesión: revoca el token en el backend
    // y limpia el estado local. Si el backend devuelve 401 (token ya
    // expirado), el finally garantiza que el estado quede limpio igual.
    const logout = useCallback(async () => {
        try {
            await apiClient.post('/v1/logout');
        } catch {
            // Silenciar: token ya expirado → limpiar igual en el finally
        } finally {
            clearAuth();
        }
    }, [clearAuth]);

    const value = {
        user,
        token,
        isLoading,
        isAdmin,
        isOperador,
        canWrite,
        canDelete,
        // Métodos expuestos al resto de la app
        login,
        logout,
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

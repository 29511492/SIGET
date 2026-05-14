/**
 * ═══════════════════════════════════════════════════════════════
 *  resources/js/hooks/useAuth.js — Hook de autenticación
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA — Custom Hook como fachada:
 *
 *  Los componentes NO importan AuthContext directamente. Siempre
 *  consumen el contexto a través de este hook. Ventajas:
 *    1. Si el día de mañana AuthContext se reemplaza por Zustand,
 *       se cambia SOLO este archivo — no todos los componentes.
 *    2. El hook puede enriquecerse con lógica adicional
 *       (logging, validaciones) sin tocar los componentes.
 *    3. Lanza un error claro si se usa fuera del AuthProvider,
 *       en vez de fallar silenciosamente con undefined.
 *
 *  USO EN COMPONENTES:
 *  const { user, isAdmin, canWrite, login, logout } = useAuth();
 * ═══════════════════════════════════════════════════════════════
 */

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../services/axios';

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            'useAuth() debe usarse dentro de <AuthProvider>. ' +
            'Verifica que AuthProvider envuelva tu árbol de componentes en app.jsx.'
        );
    }

    const { setUser, setToken, clearAuth, ...rest } = context;

    /**
     * login(credentials)
     * Llama a POST /api/v1/login, persiste token + user, retorna el user.
     *
     * FLUJO COMPLETO React → Laravel:
     * 1. Login.jsx llama a login({ email, password })
     * 2. Este hook llama a apiClient.post('/v1/login', credentials)
     * 3. axios.js inyecta headers (Content-Type, Accept-Language)
     * 4. Laravel valida con LoginRequest → 422 si falla
     * 5. AuthController verifica credenciales → 401 si falla
     * 6. AuthController devuelve { data: { token, user } } → 200
     * 7. Guardamos token y user en Context + localStorage
     * 8. El componente recibe el user y decide a dónde redirigir
     */
    const login = async (credentials) => {
        const response = await apiClient.post('/v1/login', credentials);
        const { token, user } = response.data.data;

        setToken(token);
        setUser(user);

        return user; // El componente decide la redirección según el rol
    };

    /**
     * logout()
     * Revoca el token en el servidor y limpia el estado local.
     */
    const logout = async () => {
        try {
            await apiClient.post('/v1/logout');
        } finally {
            // Limpiar siempre, incluso si el servidor falla
            clearAuth();
        }
    };

    return {
        ...rest,    // user, token, isLoading, isAdmin, isOperador, canWrite, canDelete
        login,
        logout,
    };
}

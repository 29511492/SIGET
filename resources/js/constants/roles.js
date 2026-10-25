/**
 * resources/js/constants/roles.js — SIGET
 *
 * CAMBIO (sept-2026, backlog 11.2 / 14.6: unificar REDIRECT_BY_ROL) —
 * Esta constante vivía DUPLICADA en app.jsx y en Login.jsx. No se
 * había unificado antes por temor a un import circular entre esos
 * dos archivos (Login.jsx podría necesitar algo de app.jsx y
 * viceversa). La solución es este archivo: un módulo neutral que
 * NINGUNO de los dos importa del otro — ambos importan de aquí, así
 * que no hay ciclo posible.
 *
 * Mantener un solo punto de verdad evita que un cambio de destino se
 * actualice en un archivo y se olvide en el otro (como pasó con el
 * fix de 'usuario': /perfil → /dashboard, sept-2026).
 *
 * CAMBIO (oct-2026): el vocero ahora entra directo a /dashboard
 * (antes /mi-comunidad). La pantalla /mi-comunidad se retiró y su ruta
 * quedó como redirección a /dashboard (ver app.jsx).
 */
export const REDIRECT_BY_ROL = {
    admin:    '/dashboard',
    operador: '/dashboard',
    vocero:   '/dashboard',
    usuario:  '/dashboard',
};

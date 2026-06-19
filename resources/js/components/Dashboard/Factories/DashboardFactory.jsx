/**
 * ═══════════════════════════════════════════════════════════════
 *  DashboardFactory.jsx — Strategy Pattern via Component Factory
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA DOCUMENTADA (para tesis):
 *
 *  ¿Por qué Strategy y no Abstract Factory (GoF)?
 *  ────────────────────────────────────────────────
 *  El patrón Abstract Factory GoF está diseñado para crear
 *  FAMILIAS de objetos relacionados (ej: botones + checkboxes +
 *  inputs de diferentes temas). Aplicarlo aquí requeriría:
 *    1. Una interfaz IDashboard abstracta
 *    2. Clases concretas AdminDashboardFactory y VoceroDashboardFactory
 *    3. Un método create() que retorne instancias
 *
 *  En React, los componentes son funciones, no clases instanciables.
 *  Aplicar Abstract Factory produciría código artificialmente complejo
 *  que viola el principio KISS (Keep It Simple, Stupid).
 *
 *  SOLUCIÓN ELEGANTE: Strategy Pattern vía Component Factory Function
 *  ───────────────────────────────────────────────────────────────────
 *  Se implementa una función pura que mapea un `rol` (string) a
 *  un componente React (función). Esta es la implementación idiomática
 *  del patrón Strategy en React: el "contexto" es DashboardPage,
 *  las "estrategias" son AdminDashboard, VoceroDashboard y
 *  UsuarioDashboard, y el "selector de estrategia" es
 *  getDashboardComponent().
 *
 *  BENEFICIOS para la tesis:
 *  - Open/Closed Principle: agregar un nuevo rol (ej: 'operador')
 *    solo requiere agregar una entrada al REGISTRY. Cero cambios
 *    en DashboardPage ni en los componentes existentes.
 *  - Single Responsibility: la lógica de "qué dashboard mostrar"
 *    está aislada en este archivo. DashboardPage no sabe nada
 *    de los roles — solo recibe un componente y lo renderiza.
 *  - Testeable: getDashboardComponent('admin') es una función pura
 *    que retorna un valor predecible y verificable con Jest.
 *
 * ───────────────────────────────────────────────────────────────
 *  FIX (junio 2026) — Separación de rol "usuario" y "vocero"
 * ───────────────────────────────────────────────────────────────
 *  El rol "usuario" estaba mapeado a VoceroDashboard, causando:
 *    1. Sidebar con módulos que el usuario no puede ver
 *       (Familias, Habitantes, etc. requieren Capa 2)
 *    2. Peticiones a /v1/vocero/resumen y /v1/vocero/tareas,
 *       endpoints inexistentes → vista en "Cargando..." indefinido
 *
 *  Solución: se crea UsuarioDashboard (Portal Ciudadano), un
 *  componente propio para el rol usuario que:
 *    - No tiene sidebar de módulos administrativos
 *    - Solo consume endpoints de Capa 1 (auth:sanctum, todos los roles)
 *    - Presenta un diseño visual tipo portal ciudadano
 * ═══════════════════════════════════════════════════════════════
 */

import AdminDashboard    from '../Views/AdminDashboard';
import OperadorDashboard from '../Views/OperadorDashboard';
import VoceroDashboard   from '../Views/VoceroDashboard';
import UsuarioDashboard  from '../Views/UsuarioDashboard';
import FallbackDashboard from '../Views/FallbackDashboard';

/**
 * REGISTRY de estrategias por rol.
 *
 * Patrón: Registry + Strategy.
 * Para agregar un nuevo rol, SOLO se agrega una entrada aquí.
 * Ningún otro archivo necesita modificarse. (Open/Closed Principle)
 *
 * @type {Record<string, React.ComponentType>}
 */
const DASHBOARD_REGISTRY = {
    admin:    AdminDashboard,
    operador: OperadorDashboard,
    vocero:   VoceroDashboard,
    usuario:  UsuarioDashboard,  // FIX: ya no comparte vista con vocero
};

/**
 * getDashboardComponent(rol)
 *
 * Función factory pura: recibe un rol y devuelve el componente
 * React correspondiente. Si el rol es desconocido, devuelve el
 * FallbackDashboard en vez de lanzar un error (Defensive Programming).
 *
 * NOTA: Devuelve el COMPONENTE (la función), no el JSX.
 * DashboardPage se encarga de renderizarlo con <Component />.
 * Esto permite que DashboardPage le pase props sin que la factory
 * necesite conocer qué props existen. Separación limpia.
 *
 * @param {string} rol - El rol del usuario autenticado
 * @returns {React.ComponentType} - El componente a renderizar
 */
export function getDashboardComponent(rol) {
    const Component = DASHBOARD_REGISTRY[rol];

    if (!Component) {
        console.warn(
            `[DashboardFactory] Rol desconocido: "${rol}". ` +
            `Mostrando FallbackDashboard. ` +
            `Roles válidos: ${Object.keys(DASHBOARD_REGISTRY).join(', ')}`
        );
        return FallbackDashboard;
    }

    return Component;
}

/**
 * Exportación del registry para introspección
 * (útil en tests y en el panel de admin para listar roles)
 */
export const ROLES_DISPONIBLES = Object.keys(DASHBOARD_REGISTRY);

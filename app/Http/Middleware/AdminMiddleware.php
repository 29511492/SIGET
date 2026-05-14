<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ═══════════════════════════════════════════════════════════════
 *  AdminMiddleware — Control de Acceso Basado en Roles (RBAC)
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA — ¿Por qué un middleware y no una Policy?
 *
 *  Las Policies de Laravel son ideales para autorizar acciones
 *  sobre un MODELO específico (¿puede este usuario editar ESTE habitante?).
 *  El middleware es ideal para proteger GRUPOS de rutas según el rol
 *  general del usuario (¿puede este rol acceder a rutas de escritura?).
 *
 *  SIGET usa ambos en su momento:
 *  - AdminMiddleware → protección de rutas (este archivo)
 *  - Policies         → granularidad sobre registros específicos (futuro)
 *
 *  USO EN routes/api.php:
 *  ──────────────────────
 *  // Solo lectura (admin + operador + vocero):
 *  Route::middleware(['auth:sanctum', 'role:admin,operador,vocero'])
 *
 *  // Escritura (admin + operador):
 *  Route::middleware(['auth:sanctum', 'role:admin,operador'])
 *
 *  // Solo admin (delete, configuración):
 *  Route::middleware(['auth:sanctum', 'role:admin'])
 *
 *  REGISTRO en bootstrap/app.php (Laravel 11):
 *  ────────────────────────────────────────────
 *  ->withMiddleware(function (Middleware $middleware) {
 *      $middleware->alias([
 *          'role' => \App\Http\Middleware\AdminMiddleware::class,
 *      ]);
 *  })
 * ═══════════════════════════════════════════════════════════════
 */
class AdminMiddleware
{
    /**
     * @param  Request  $request
     * @param  Closure  $next
     * @param  string   ...$roles  Roles permitidos para esta ruta.
     *                             Se pasan como: 'role:admin,operador'
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        // Verificación 1: usuario autenticado
        // (Sanctum ya garantiza esto con auth:sanctum, pero es buena práctica)
        if (! $user) {
            return response()->json([
                'message' => __('auth.unauthenticated'),
            ], 401);
        }

        // Verificación 2: el rol del usuario está entre los permitidos
        if (! in_array($user->rol, $roles, strict: true)) {
            return response()->json([
                'message' => __('auth.unauthorized'),
                'errors'  => [
                    'rol' => [
                        __('auth.unauthorized_role', [
                            'rol'      => $user->rol,
                            'required' => implode(' o ', $roles),
                        ]),
                    ],
                ],
            ], 403);
        }

        return $next($request);
    }
}

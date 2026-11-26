<?php

/**
 * ═══════════════════════════════════════════════════════════════
 *  bootstrap/app.php — SIGET
 * ───────────────────────────────────────────────────────────────
 *  CORRECCIÓN: "Route [login] not defined"
 *
 *  Causa: Cuando un token Sanctum falta o expira, Laravel lanza
 *  AuthenticationException. Su handler por defecto llama a
 *  redirect()->route('login') — pero en una SPA pura no existe
 *  ninguna ruta nombrada 'login'; hay un endpoint POST /api/v1/login.
 *  Resultado: "Route [login] not defined".
 *
 *  Solución: Interceptar AuthenticationException ANTES de que
 *  llegue al handler de redirect. Si la petición es a /api/*
 *  o espera JSON, devolver 401 JSON directamente.
 *
 *  Esta solución ya estaba parcialmente implementada, pero faltaba
 *  el return explícito en el bloque de AuthenticationException
 *  para cortar el flujo y evitar que el handler por defecto siga
 *  ejecutándose y busque la ruta 'login'.
 *
 *  CORRECCIÓN (nov-2026): el return del handler no alcanzaba cuando la
 *  petición pedía otro formato (p. ej. Accept: application/pdf en las
 *  descargas de PDF con responseType 'blob'). El middleware Authenticate
 *  calcula el destino del redirect ANTES de lanzar la excepción, así que
 *  el handler nunca llegaba a ejecutarse y salía el 500 «Route [login] not
 *  defined». Ahora redirectGuestsTo() devuelve null para /api/*: no hay
 *  redirect y el handler responde 401 JSON siempre.
 * ═══════════════════════════════════════════════════════════════
 */

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))

    // ── Registro de archivos de rutas ──────────────────────────────
    ->withRouting(
        web:        __DIR__ . '/../routes/web.php',
        api:        __DIR__ . '/../routes/api.php',
        commands:   __DIR__ . '/../routes/console.php',
        health:     '/up',
        apiPrefix:  'api',
    )

    // ── Registro de middleware ─────────────────────────────────────
    ->withMiddleware(function (Middleware $middleware) {

        /**
         * Alias de middleware personalizados.
         * Permite usar 'role:admin,operador' en las rutas
         * en vez del namespace completo de la clase.
         */
        $middleware->alias([
            'role' => \App\Http\Middleware\AdminMiddleware::class,
        ]);

        /**
         * Middleware global para APIs:
         * Sanctum gestiona la autenticación stateless con tokens.
         * Se agrega al grupo 'api' para que aplique a todas las
         * rutas definidas en routes/api.php.
         */
        $middleware->appendToGroup('api', [
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
        ]);

        /**
         * Invitados en rutas /api/*: sin redirect (null). Evita el 500
         * «Route [login] not defined» cuando la petición no declara
         * Accept: application/json (descargas de PDF, por ejemplo) y deja
         * que el handler de AuthenticationException responda 401 JSON.
         */
        $middleware->redirectGuestsTo(
            fn (Request $request) => $request->is('api/*') ? null : route('login')
        );

    })

    // ── Manejo de excepciones ──────────────────────────────────────
    ->withExceptions(function (Exceptions $exceptions) {

        /**
         * Respuesta JSON para errores de autenticación en la API.
         * Sin esto, Laravel devuelve un redirect HTML 302 cuando
         * el token es inválido — lo cual React no puede procesar.
         */
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, Request $request) {
            // ✅ FIX: return explícito en TODOS los casos de la API.
            // Sin el return en el else, Laravel continúa hacia el handler
            // por defecto que llama redirect()->route('login') — que no
            // existe en una SPA stateless — causando el error 500.
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'message' => 'No autenticado. Por favor, inicia sesión.',
                    'errors'  => [],
                ], 401);
            }

            // Rutas web (no API) — devolver null para que Laravel
            // use su handler por defecto solo en rutas web reales.
            return null;
        });

        /**
         * Respuesta JSON para errores de autorización (403).
         */
        $exceptions->render(function (\Illuminate\Auth\Access\AuthorizationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'message' => __('No tienes permiso para realizar esta acción.'),
                    'errors'  => [],
                ], 403);
            }
        });

        /**
         * Respuesta JSON para modelos no encontrados (404).
         * Sin esto, Laravel devuelve una página HTML de error.
         */
        $exceptions->render(function (\Illuminate\Database\Eloquent\ModelNotFoundException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $model = class_basename($e->getModel());
                return response()->json([
                    'message' => "Recurso {$model} no encontrado.",
                    'errors'  => [],
                ], 404);
            }
        });

        /**
         * ── Validación 422 ─────────────────────────────────────────
         * FormRequest fallido — por si no está sobrescrito en el Request.
         */
        $exceptions->render(function (\Illuminate\Validation\ValidationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'message' => 'Los datos proporcionados no son válidos.',
                    'errors'  => $e->errors(),
                ], 422);
            }
        });

    })
    ->create();

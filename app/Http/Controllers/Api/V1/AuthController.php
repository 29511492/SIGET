<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * ═══════════════════════════════════════════════════════════════
 *  AuthController — Namespace: App\Http\Controllers\Api\V1
 * ───────────────────────────────────────────────────────────────
 *  ⚠️  NAMESPACE CRÍTICO: La 'V' de V1 es MAYÚSCULA.
 *  App\Http\Controllers\Api\V1  ← CORRECTO
 *  App\Http\Controllers\Api\v1  ← INCORRECTO (causa 404 silencioso)
 *
 *  PATRÓN DE RESPUESTA UNIFORME (todos los endpoints de SIGET):
 *  ┌────────────────────────────────────────────────────────────┐
 *  │  Éxito 200:  { "message": "...", "data": { ... } }        │
 *  │  Error 401:  { "message": "...", "errors": { ... } }      │
 *  │  Error 422:  { "message": "...", "errors": { ... } }      │
 *  │  Error 429:  { "message": "...", "errors": {} }           │
 *  └────────────────────────────────────────────────────────────┘
 *
 *  Este patrón permite que el frontend maneje todos los errores
 *  con una sola lógica: siempre leer response.data.message
 *  para el mensaje principal y response.data.errors para el detalle.
 * ═══════════════════════════════════════════════════════════════
 */
class AuthController extends Controller
{
    private const MAX_ATTEMPTS  = 5;   // Intentos antes de bloquear
    private const DECAY_SECONDS = 60;  // Segundos de bloqueo

    // ─────────────────────────────────────────────────────────────
    //  POST /api/v1/login
    // ─────────────────────────────────────────────────────────────
    /**
     * Autentica un usuario y devuelve un Bearer Token de Sanctum.
     *
     * La request ya llega VALIDADA por LoginRequest (email y password
     * cumplen las reglas). El controlador solo verifica credenciales,
     * emite el token y construye la respuesta.
     *
     * @param LoginRequest $request — email: string, password: string
     * @return JsonResponse
     *
     * Respuesta exitosa (200):
     * {
     *   "message": "Sesión iniciada correctamente.",
     *   "data": {
     *     "token": "1|abc123...",
     *     "user": {
     *       "id": 1,
     *       "name": "Carlos Pérez",
     *       "email": "carlos@siget.ve",
     *       "rol": "admin",
     *       "permisos": { "puede_escribir": true, "puede_eliminar": true, ... }
     *     }
     *   }
     * }
     */
    public function login(LoginRequest $request): JsonResponse
    {
        // ── 1. Rate limiting ───────────────────────────────────────
        $throttleKey = Str::lower($request->email) . '|' . $request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return response()->json([
                'message' => "Demasiados intentos. Espera {$seconds} segundos.",
                'errors'  => [],
            ], 429);
        }

        // ── 2. Buscar usuario en PostgreSQL ────────────────────────
        /** @var User|null $user */
        $user = User::where('email', $request->email)->first();

        // ── 3. Verificar contraseña con Hash::check() ──────────────
        // Hash::check() compara el texto plano con el hash bcrypt
        // de la base de datos de forma segura (timing-safe).
        if (! $user || ! Hash::check($request->password, $user->password)) {
            RateLimiter::hit($throttleKey, self::DECAY_SECONDS);

            return response()->json([
                'message' => 'Las credenciales no coinciden con nuestros registros.',
                'errors'  => [
                    'email' => ['Las credenciales no coinciden con nuestros registros.'],
                ],
            ], 401);
        }

        // ── 4. Credenciales correctas: limpiar rate limit ──────────
        RateLimiter::clear($throttleKey);

        // ── 5. Política de sesión única ────────────────────────────
        // Se revocan todos los tokens anteriores del usuario.
        // Si estaba logueado en otro dispositivo, esa sesión queda inválida.
        $user->tokens()->delete();

        // ── 6. Emitir nuevo token Sanctum ──────────────────────────
        // El nombre del token incluye timestamp para identificarlo en auditorías.
        // Las abilities restringen qué puede hacer este token específico
        // según el rol del usuario — doble barrera de seguridad.
        $tokenResult = $user->createToken(
            name:      'siget-spa-' . now()->timestamp,
            abilities: $this->abilitiesPorRol($user->rol),
        );

        // ── 7. Devolver JSON estructurado ──────────────────────────
        // UserResource transforma el modelo: expone rol y permisos,
        // NUNCA expone password, remember_token ni tokens de Sanctum.
        return response()->json([
            'message' => 'Sesión iniciada correctamente.',
            'data'    => [
                'token' => $tokenResult->plainTextToken,
                'user'  => new UserResource($user),
            ],
        ], 200);
    }

    // ─────────────────────────────────────────────────────────────
    //  POST /api/v1/logout  [auth:sanctum]
    // ─────────────────────────────────────────────────────────────
    public function logout(Request $request): JsonResponse
    {
        // Revoca solo el token actual (no todos los dispositivos)
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Sesión cerrada correctamente.',
        ], 200);
    }

    // ─────────────────────────────────────────────────────────────
    //  GET /api/v1/me  [auth:sanctum]
    // ─────────────────────────────────────────────────────────────
    /**
     * Devuelve el usuario autenticado actualmente.
     * React llama a este endpoint al recargar la página para
     * rehidratar el estado de AuthContext con datos frescos.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'data' => new UserResource($request->user()),
        ], 200);
    }

    // ── Helper privado: abilities por rol ─────────────────────────
    /**
     * DECISIÓN DE SEGURIDAD — Doble barrera:
     * Barrera 1: AdminMiddleware verifica $user->rol en cada request.
     * Barrera 2: Las abilities del token limitan sus capacidades.
     * Si alguien intercepta un token de 'vocero', ese token no tiene
     * la ability 'admin:write' y Sanctum rechazará acciones de escritura.
     */
    private function abilitiesPorRol(string $rol): array
    {
        return match ($rol) {
            'admin'    => ['admin:read', 'admin:write', 'admin:delete'],
            'operador' => ['admin:read', 'admin:write'],
            'vocero'   => ['admin:read'],
            default    => ['admin:read'],
        };
    }
}

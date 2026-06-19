<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    private const MAX_ATTEMPTS  = 5;   // Rate limiter de IP (capa de red)
    private const DECAY_SECONDS = 60;
    private const MAX_PW_FAILS  = 3;   // Intentos antes de bloquear cuenta

    // ─────────────────────────────────────────────────────────────
    //  POST /api/v1/register  — Público
    // ─────────────────────────────────────────────────────────────
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create([
            'name'     => $request->name,
            'cedula'   => $request->cedula,
            'email'    => $request->email,
            'password' => $request->password, // el cast 'hashed' lo encripta automáticamente
            'rol'      => 'usuario',           // rol base por defecto
        ]);

        $token = $user->createToken(
            name:      'siget-spa-' . now()->timestamp,
            abilities: ['admin:read'],
        )->plainTextToken;

        return response()->json([
            'message' => 'Cuenta creada exitosamente.',
            'data'    => [
                'token' => $token,
                'user'  => new UserResource($user),
            ],
        ], 201);
    }

    // ─────────────────────────────────────────────────────────────
    //  POST /api/v1/login  — Público
    // ─────────────────────────────────────────────────────────────
    public function login(LoginRequest $request): JsonResponse
    {
        // ── 1. Rate limiter por IP (capa de red) ───────────────────
        $throttleKey = Str::lower($request->email) . '|' . $request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return response()->json([
                'message' => "Demasiados intentos. Espera {$seconds} segundos.",
                'errors'  => [],
            ], 429);
        }

        // ── 2. Buscar usuario ──────────────────────────────────────
        /** @var User|null $user */
        $user = User::where('email', $request->email)->first();

        // ── 3. Verificar si la cuenta existe y contraseña es válida
        if (! $user || ! Hash::check($request->password, $user->password)) {

            RateLimiter::hit($throttleKey, self::DECAY_SECONDS);

            // Si el usuario existe, registrar intento fallido
            if ($user) {
                $user->registrarIntentoFallido();

                // Informar al frontend si la cuenta acaba de bloquearse
                if ($user->is_locked) {
                    return response()->json([
                        'message' => 'Tu cuenta ha sido bloqueada por múltiples intentos fallidos. Revisa tu correo para desbloquearla.',
                        'errors'  => ['email' => ['Cuenta bloqueada.']],
                        'locked'  => true,
                    ], 423); // 423 Locked — código HTTP semánticamente correcto
                }

                $restantes = self::MAX_PW_FAILS - $user->failed_attempts;
                return response()->json([
                    'message' => "Credenciales incorrectas. Te quedan {$restantes} intento(s) antes del bloqueo.",
                    'errors'  => ['email' => ['Las credenciales no coinciden.']],
                    'locked'  => false,
                ], 401);
            }

            return response()->json([
                'message' => 'Las credenciales no coinciden con nuestros registros.',
                'errors'  => ['email' => ['Las credenciales no coinciden.']],
            ], 401);
        }

        // ── 4. Verificar si la cuenta está bloqueada ───────────────
        if ($user->is_locked) {
            return response()->json([
                'message' => 'Tu cuenta está bloqueada. Revisa tu correo para desbloquearla.',
                'errors'  => ['email' => ['Cuenta bloqueada.']],
                'locked'  => true,
            ], 423);
        }

        // ── 5. Login exitoso — limpiar contadores ──────────────────
        RateLimiter::clear($throttleKey);
        $user->limpiarIntentos();
        $user->tokens()->delete();

        $token = $user->createToken(
            name:      'siget-spa-' . now()->timestamp,
            abilities: $this->abilitiesPorRol($user->rol),
        )->plainTextToken;

        return response()->json([
            'message' => 'Sesión iniciada correctamente.',
            'data'    => [
                'token' => $token,
                'user'  => new UserResource($user),
            ],
        ], 200);
    }

    // ─────────────────────────────────────────────────────────────
    //  POST /api/v1/logout  [auth:sanctum]
    // ─────────────────────────────────────────────────────────────
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Sesión cerrada correctamente.',
        ], 200);
    }

    // ─────────────────────────────────────────────────────────────
    //  GET /api/v1/me  [auth:sanctum]
    // ─────────────────────────────────────────────────────────────
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'data' => new UserResource($request->user()),
        ], 200);
    }

    // ── Helper privado ────────────────────────────────────────────
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

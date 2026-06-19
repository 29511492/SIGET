<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * ═══════════════════════════════════════════════════════════════
 *  User — Modelo de usuario
 * ───────────────────────────────────────────────────────────────
 *  TRAIT CRÍTICO: HasApiTokens
 *  Sin este trait, el método $user->createToken() no existe
 *  y el AuthController lanzará un error fatal al intentar
 *  emitir el token de Sanctum.
 *
 *  Verificar que este trait esté importado es el segundo punto
 *  de diagnóstico más común después del bootstrap/app.php.
 * ═══════════════════════════════════════════════════════════════
 */
class User extends Authenticatable
{
    use HasApiTokens;   // ← CRÍTICO para Sanctum — sin esto, no hay tokens
    use HasFactory;
    use Notifiable;
    use SoftDeletes;    // deleted_at — los usuarios se desactivan, no se eliminan

    protected $fillable = [
        'name',
        'cedula',
        'email',
        'password',
        'rol',
        'habitante_id',
        'failed_attempts',
        'is_locked',
        'locked_at',
        'otp_code',
        'otp_expires_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'otp_code',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
            'deleted_at'        => 'datetime',
            'locked_at'         => 'datetime',
            'otp_expires_at'    => 'datetime',
            'is_locked'         => 'boolean',
            'failed_attempts'   => 'integer',
        ];
    }

    // ─── Helpers de seguridad ──────────────────────────────────────
    /**
     * Incrementa el contador de intentos fallidos.
     * Si llega a 3, bloquea la cuenta automáticamente.
     */
    public function registrarIntentoFallido(): void
    {
        $this->increment('failed_attempts');
        if ($this->failed_attempts >= 3) {
            $this->update([
                'is_locked' => true,
                'locked_at' => now(),
            ]);
        }
    }

    //Limpia los intentos fallidos tras un login exitoso.
    public function limpiarIntentos(): void
    {
        $this->update([
            'failed_attempts' => 0,
            'is_locked'       => false,
            'locked_at'       => null,
        ]);
    }

    //Genera y guarda un OTP de 6 dígitos con expiración de 15 minutos.
    // Retorna el código en texto plano para enviarlo por correo.
    public function generarOtp(): string
    {
        $codigo = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $this->update([
            'otp_code'       => $codigo,
            'otp_expires_at' => now()->addMinutes(15),
        ]);

        return $codigo;
    }

    //Verifica si el OTP proporcionado es válido y no ha expirado.
    public function otpEsValido(string $codigo): bool
    {
        return $this->otp_code === $codigo
            && $this->otp_expires_at !== null
            && now()->lessThanOrEqualTo($this->otp_expires_at);
    }

    //Limpia el OTP después de usarlo exitosamente.
    public function limpiarOtp(): void
    {
        $this->update([
            'otp_code'       => null,
            'otp_expires_at' => null,
        ]);
    }

    //Desbloquea la cuenta y limpia todos los campos de seguridad.
    public function desbloquear(): void
    {
        $this->update([
            'is_locked'       => false,
            'locked_at'       => null,
            'failed_attempts' => 0,
            'otp_code'        => null,
            'otp_expires_at'  => null,
        ]);
    }

    // ── Relación con el censo ──────────────────────────────────────
    public function habitante(): BelongsTo
    {
        return $this->belongsTo(Habitante::class);
    }

    // ── Helpers de rol (usados en Policies y Middleware) ───────────
    public function esAdmin(): bool
    {
        return $this->rol === 'admin';
    }

    public function esOperador(): bool
    {
        return in_array($this->rol, ['admin', 'operador'], true);
    }

    public function puedeEliminar(): bool
    {
        return $this->rol === 'admin';
    }
}

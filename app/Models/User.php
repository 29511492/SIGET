<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;
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
 *  RELACIONES: cada FK hacia `users` en la base de datos tiene su
 *  relación inversa (hasMany) declarada aquí. Ver la matriz de
 *  relaciones del proyecto.
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
            'habitante_id'      => 'integer',
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

    // Limpia los intentos fallidos tras un login exitoso.
    public function limpiarIntentos(): void
    {
        $this->update([
            'failed_attempts' => 0,
            'is_locked'       => false,
            'locked_at'       => null,
        ]);
    }

    // Genera un OTP de 6 dígitos con expiración de 15 minutos.
    // ERR-04 (nov-2026): en la base de datos se guarda CON HASH (bcrypt),
    // nunca en texto plano. Retorna el código en texto plano solo para
    // enviarlo por correo; después de este método no se puede recuperar.
    public function generarOtp(): string
    {
        $codigo = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $this->update([
            'otp_code'       => Hash::make($codigo),
            'otp_expires_at' => now()->addMinutes(15),
        ]);

        return $codigo;
    }

    // Verifica si el OTP proporcionado es válido y no ha expirado.
    // Compara contra el hash guardado. Si quedara un valor que no es un
    // hash (código viejo en texto plano), se rechaza sin lanzar error.
    public function otpEsValido(string $codigo): bool
    {
        if ($this->otp_code === null || $this->otp_expires_at === null) {
            return false;
        }

        if (now()->greaterThan($this->otp_expires_at)) {
            return false;
        }

        return Hash::isHashed($this->otp_code)
            && Hash::check($codigo, $this->otp_code);
    }

    // Limpia el OTP después de usarlo exitosamente.
    public function limpiarOtp(): void
    {
        $this->update([
            'otp_code'       => null,
            'otp_expires_at' => null,
        ]);
    }

    // Desbloquea la cuenta y limpia todos los campos de seguridad.
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

    // ── Relaciones ─────────────────────────────────────────────────

    /** Registro del censo vinculado a este usuario (opcional). */
    public function habitante(): BelongsTo
    {
        return $this->belongsTo(Habitante::class)->withTrashed();
    }

    public function noticias(): HasMany
    {
        return $this->hasMany(Noticia::class);
    }

    /** Sugerencias que este usuario envió. */
    public function sugerencias(): HasMany
    {
        return $this->hasMany(Sugerencia::class);
    }

    /** Sugerencias que este usuario revisó (admin). */
    public function sugerenciasRevisadas(): HasMany
    {
        return $this->hasMany(Sugerencia::class, 'revisada_por');
    }

    /** Pagos que este usuario registró por el Portal Ciudadano. */
    public function pagos(): HasMany
    {
        return $this->hasMany(PagoQr::class);
    }

    /** Pagos que este usuario verificó o rechazó. */
    public function pagosVerificados(): HasMany
    {
        return $this->hasMany(PagoQr::class, 'verificado_por');
    }

    public function comunicados(): HasMany
    {
        return $this->hasMany(Comunicado::class);
    }

    public function auditorias(): HasMany
    {
        return $this->hasMany(Auditoria::class);
    }

    /** Proyectos que este usuario registró. */
    public function proyectos(): HasMany
    {
        return $this->hasMany(Proyecto::class);
    }

    /** Entregas de beneficios que este usuario registró. */
    public function beneficiosRegistrados(): HasMany
    {
        return $this->hasMany(Beneficio::class);
    }

    // ── Helpers de rol (usados en Policies y Middleware) ───────────
    public function esAdmin(): bool
    {
        return $this->rol === 'admin';
    }

    public function puedeEliminar(): bool
    {
        return $this->rol === 'admin';
    }

    /**
     * Quién puede validar (verificar/rechazar) pagos QR.
     * Corrección 3 del profesor (sept-2026): antes cualquier rol de
     * Capa 2 (admin, operador, vocero) podía validar — contradecía
     * la tabla de roles del documento. Ahora solo admin y vocero
     * (el rol operador se eliminó en oct-2026, Fase 1 de 14.7-E).
     */
    public function puedeValidarPagos(): bool
    {
        return in_array($this->rol, ['admin', 'vocero'], true);
    }
}

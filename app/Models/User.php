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
        'email',
        'password',
        'rol',
        'habitante_id',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
            'deleted_at'        => 'datetime',
        ];
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

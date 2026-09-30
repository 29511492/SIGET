<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

/**
 * PagoQr — pago registrado con comprobante.
 *
 * Máquina de estados: pendiente → verificado | rechazado
 * El cambio de estado solo lo puede hacer un operador o admin
 * a través de PagoQrController::validar().
 *
 * Dos flujos conviven en la misma tabla:
 *   - admin/operador: habitante_id poblado, user_id null
 *   - Portal Ciudadano: user_id poblado, habitante_id null
 *
 * CAMBIO (sept-2026, corrección 2 del profesor): se agregan
 * `metodo_pago` (copiado de la cuenta elegida al momento de pagar —
 * así el histórico no cambia si el admin edita la cuenta después) y
 * `banco_origen` (desde qué banco pagó el ciudadano).
 *
 * Todas las relaciones usan withTrashed(): un pago es un registro
 * histórico y debe conservar a quien lo hizo aunque ese habitante,
 * usuario, familia, etc. haya sido dado de baja.
 */
class PagoQr extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'pagos_qr';

    public const ESTADOS = ['pendiente', 'verificado', 'rechazado'];

    protected $fillable = [
        'habitante_id',
        'user_id',
        'familia_id',
        'organizacion_id',
        'cuenta_pago_id',
        'verificado_por',
        'referencia_bancaria',
        'monto',
        'concepto_pago',
        'metodo_pago',
        'banco_origen',
        'comprobante_path',
        'estado',
        'motivo_rechazo',
        'fecha_pago',
        'fecha_verificacion',
    ];

    protected $casts = [
        'monto'               => 'decimal:2',
        'fecha_pago'          => 'datetime',
        'fecha_verificacion'  => 'datetime',
        'habitante_id'        => 'integer',
        'user_id'             => 'integer',
        'familia_id'          => 'integer',
        'organizacion_id'     => 'integer',
        'cuenta_pago_id'      => 'integer',
        'verificado_por'      => 'integer',
    ];

    // ── Cache-Aside ───────────────────────────────────────────
    protected static function booted(): void
    {
        static::saved(fn ()   => Cache::forget('pagos_pendientes_count'));
        static::deleted(fn () => Cache::forget('pagos_pendientes_count'));
    }

    // ── Relaciones ────────────────────────────────────────────

    /** Habitante que realizó el pago (flujo admin/operador). */
    public function habitante(): BelongsTo
    {
        return $this->belongsTo(Habitante::class)->withTrashed();
    }

    /** Usuario que registró el pago directamente (flujo Portal Ciudadano). */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    /** Familia del habitante (para agrupar pagos por núcleo). */
    public function familia(): BelongsTo
    {
        return $this->belongsTo(Familia::class)->withTrashed();
    }

    /** Servicio público al que corresponde el pago (módulo Organizaciones). */
    public function organizacion(): BelongsTo
    {
        return $this->belongsTo(Organizacion::class)->withTrashed();
    }

    /** Cuenta de pago (servicio + datos bancarios) elegida al pagar. */
    public function cuentaPago(): BelongsTo
    {
        return $this->belongsTo(CuentaPago::class, 'cuenta_pago_id')->withTrashed();
    }

    /** Operador que verificó o rechazó el pago. */
    public function verificador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verificado_por')->withTrashed();
    }

    // ── Scopes ────────────────────────────────────────────────

    public function scopePendientes(Builder $query): Builder
    {
        return $query->where('estado', 'pendiente');
    }

    public function scopeDeUsuario(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    // ── Helpers ───────────────────────────────────────────────

    /** URL pública del comprobante almacenado en storage. */
    public function getComprobanteUrlAttribute(): ?string
    {
        return $this->comprobante_path
            ? asset('storage/' . $this->comprobante_path)
            : null;
    }

    public function esPendiente(): bool   { return $this->estado === 'pendiente';   }
    public function esVerificado(): bool  { return $this->estado === 'verificado';  }
    public function esRechazado(): bool   { return $this->estado === 'rechazado';   }
}

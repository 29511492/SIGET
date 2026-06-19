<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

/**
 * Máquina de estados: pendiente → verificado | rechazado
 * El cambio de estado solo lo puede hacer un operador o admin
 * a través de PagoQrController::validar().
 *
 * FIX (junio 2026): se agrega 'user_id' nullable y su relación user().
 * Permite que un pago se registre directamente desde el rol "usuario"
 * sin depender de que tenga un habitante_id vinculado en la tabla
 * users. habitante_id sigue existiendo para el flujo de admin/operador.
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
        'verificado_por',
        'referencia_bancaria',
        'monto',
        'concepto_pago',
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
        return $this->belongsTo(Habitante::class);
    }

    /** Usuario que registró el pago directamente (flujo Portal Ciudadano). */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Familia del habitante (para agrupar pagos por núcleo). */
    public function familia(): BelongsTo
    {
        return $this->belongsTo(Familia::class);
    }

    /** Servicio público al que corresponde el pago. */
    public function organizacion(): BelongsTo
    {
        return $this->belongsTo(Organizacion::class);
    }

    /** Operador que verificó o rechazó el pago. */
    public function verificador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verificado_por');
    }

    // ── Scopes ────────────────────────────────────────────────

    public function scopePendientes($query)
    {
        return $query->where('estado', 'pendiente');
    }

    public function scopeDeUsuario($query, int $userId)
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

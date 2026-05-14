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
 */
class PagoQr extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'pagos_qr';

    public const ESTADOS = ['pendiente', 'verificado', 'rechazado'];

    protected $fillable = [
        'habitante_id',
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

    /** Habitante que realizó el pago. */
    public function habitante(): BelongsTo
    {
        return $this->belongsTo(Habitante::class);
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

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

class Proyecto extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'proyectos';

    protected $fillable = [
        'sede_id',
        'comite_id',
        'user_id',
        'nombre_proyecto',
        'objetivo',
        'monto_aprobado',
        'fuente_financiamiento',
        'estatus',
        'fecha_inicio',
        'fecha_fin',
    ];

    protected $casts = [
        'monto_aprobado' => 'decimal:2',
        'fecha_inicio'   => 'date',
        'fecha_fin'      => 'date',
        'sede_id'        => 'integer',
        'comite_id'      => 'integer',
        'user_id'        => 'integer',
    ];

    // ─── Cache-Aside (Regla 3.7) ────────────────────────────────────────────
    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget('dashboard_stats'));
        static::deleted(fn () => Cache::forget('dashboard_stats'));
    }

    // ─── Relaciones ─────────────────────────────────────────────────────────
    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    public function comite(): BelongsTo
    {
        return $this->belongsTo(Comite::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ─── Scopes ─────────────────────────────────────────────────────────────
    public function scopePorEstatus($query, string $estatus)
    {
        return $query->where('estatus', $estatus);
    }

    public function scopePorSede($query, int $sedeId)
    {
        return $query->where('sede_id', $sedeId);
    }
}

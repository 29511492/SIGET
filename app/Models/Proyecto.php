<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
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

    // ─── Cache-Aside ────────────────────────────────────────────────────────
    protected static function booted(): void
    {
        static::saved(fn ()   => Cache::forget('dashboard_stats'));
        static::deleted(fn () => Cache::forget('dashboard_stats'));
    }

    // ─── Relaciones ─────────────────────────────────────────────────────────
    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class)->withTrashed();
    }

    public function comite(): BelongsTo
    {
        return $this->belongsTo(Comite::class);
    }

    /** Operador que registró el proyecto. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    // ─── Scopes ─────────────────────────────────────────────────────────────
    public function scopePorEstatus(Builder $query, string $estatus): Builder
    {
        return $query->where('estatus', $estatus);
    }

    public function scopePorSede(Builder $query, int $sedeId): Builder
    {
        return $query->where('sede_id', $sedeId);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

/**
 * Familia — núcleo familiar del censo.
 *
 * Campo relevante para el dashboard:
 *   condicion_vivienda: enum('optima','regular','critica')
 *   Usado en: WHERE condicion_vivienda = 'critica'
 *
 * Cache-Aside: el modelo que muta los datos es responsable de
 * invalidar el caché del dashboard, no el controlador que lee.
 */
class Familia extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'familias';

    protected $fillable = [
        'sede_id', 'calle_id', 'codigo_vivienda',
        'nombre_responsable', 'punto_referencia',
        'cantidad_bombonas', 'capacidad_bombona',
        'posee_agua_potable', 'posee_luz', 'posee_aseo',
        'condicion_vivienda',
    ];

    protected $casts = [
        'sede_id'            => 'integer',
        'calle_id'           => 'integer',
        'cantidad_bombonas'  => 'integer',
        'posee_agua_potable' => 'boolean',
        'posee_luz'          => 'boolean',
        'posee_aseo'         => 'boolean',
    ];

    protected static function booted(): void
    {
        static::saved(fn ()   => Cache::forget('dashboard_stats'));
        static::deleted(fn () => Cache::forget('dashboard_stats'));
    }

    // ── Relaciones ────────────────────────────────────────────────
    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class)->withTrashed();
    }

    public function calle(): BelongsTo
    {
        return $this->belongsTo(Calle::class);
    }

    public function habitantes(): HasMany
    {
        return $this->hasMany(Habitante::class);
    }

    public function beneficios(): HasMany
    {
        return $this->hasMany(Beneficio::class);
    }

    public function pagos(): HasMany
    {
        return $this->hasMany(PagoQr::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

/**
 * ═══════════════════════════════════════════════════════════════
 *  Habitante — Persona del padrón comunal
 * ───────────────────────────────────────────────────────────────
 *  PATCH aplicado: se agrega booted() con Cache::forget.
 *
 *  DECISIÓN — ¿Por qué invalidar caché aquí y no en el controlador?
 *  El Dashboard cuenta habitantes y personas con discapacidad.
 *  Si el controlador invalidara el caché, cualquier otro punto del
 *  sistema que cree habitantes (importaciones masivas, seeders,
 *  otras rutas futuras) NO invalidaría el caché porque no pasan
 *  por ese controlador. El evento del modelo se dispara SIEMPRE
 *  que Eloquent persiste, sin importar el origen. Esto es el
 *  patrón Cache-Aside: el modelo es la única fuente de verdad.
 * ═══════════════════════════════════════════════════════════════
 */
class Habitante extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'habitantes';

    protected $fillable = [
        'familia_id',
        'cedula',
        'nombres',
        'apellidos',
        'fecha_nacimiento',
        'sexo',
        'es_discapacitado',
        'tipo_discapacidad',
        'enfermedad_cronica',
        'nivel_educativo',
    ];

    protected $casts = [
        'fecha_nacimiento' => 'date',
        'es_discapacitado' => 'boolean',
        'deleted_at'       => 'datetime',
    ];

    /**
     * Cache-Aside: invalida 'dashboard_stats' en cada cambio.
     * El dashboard cuenta total_habitantes y con_discapacidad.
     * Ambos conteos deben actualizarse cuando se registra o elimina
     * un habitante o cuando cambia su estado de discapacidad.
     */
    protected static function booted(): void
    {
        static::saved(function () {
            Cache::forget('dashboard_stats');
        });

        static::deleted(function () {
            Cache::forget('dashboard_stats');
        });
    }

    // ── Relaciones ────────────────────────────────────────────────

    public function familia(): BelongsTo
    {
        return $this->belongsTo(Familia::class);
    }

    public function vocero(): HasOne
    {
        return $this->hasOne(Vocero::class);
    }

    public function user(): HasOne
    {
        return $this->hasOne(User::class);
    }
}

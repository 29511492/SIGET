<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;

/**
 * ═══════════════════════════════════════════════════════════════
 *  Vocero — Representante comunal vinculado al padrón
 * ───────────────────────────────────────────────────────────────
 *  Tabla: voceros
 *  Sin SoftDeletes: un vocero dado de baja cambia a esta_activo=false.
 *  Los registros históricos de mandatos anteriores se conservan.
 *
 *  CACHE-ASIDE:
 *  El dashboard cuenta total_voceros con WHERE esta_activo = true.
 *  Cuando un vocero se activa, desactiva o crea, el caché debe
 *  invalidarse para que el contador refleje el estado real.
 * ═══════════════════════════════════════════════════════════════
 */
class Vocero extends Model
{
    use HasFactory;

    protected $table = 'voceros';

    protected $fillable = [
        'habitante_id',
        'sede_id',
        'comite_id',
        'unidad_comunal',
        'fecha_eleccion',
        'fecha_fin',
        'esta_activo',
    ];

    protected $casts = [
        'fecha_eleccion' => 'date',
        'fecha_fin'      => 'date',
        'esta_activo'    => 'boolean',
        'habitante_id'   => 'integer',
        'sede_id'        => 'integer',
        'comite_id'      => 'integer',
    ];

    /**
     * Cache-Aside: invalida 'dashboard_stats' en cada cambio.
     * El dashboard cuenta total_voceros (WHERE esta_activo = true).
     * Al crear un vocero o cambiar esta_activo, el total debe actualizarse.
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

    /**
     * El habitante que ocupa el cargo de vocero.
     * Acceso: $vocero->habitante->nombres
     */
    public function habitante(): BelongsTo
    {
        return $this->belongsTo(Habitante::class);
    }

    /**
     * La sede donde ejerce el vocero.
     * La FK usa onDelete('restrict') — no se puede borrar una sede
     * si tiene voceros activos vinculados.
     */
    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    /**
     * El comité al que pertenece el vocero (nullable).
     * Si el comité se elimina, comite_id queda en null (SET NULL).
     */
    public function comite(): BelongsTo
    {
        return $this->belongsTo(Comite::class);
    }

    // ── Scopes de consulta frecuente ──────────────────────────────

    /**
     * Scope para voceros activos.
     * Uso: Vocero::activos()->with([...])->get()
     */
    public function scopeActivos($query)
    {
        return $query->where('esta_activo', true);
    }
}

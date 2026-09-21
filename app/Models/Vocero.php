<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
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
 *  Un habitante puede tener varios registros (uno por mandato).
 *
 *  CACHE-ASIDE:
 *  El dashboard cuenta total_voceros con WHERE esta_activo = true.
 *  Al crear, activar o desactivar un vocero, el caché se invalida.
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

    protected static function booted(): void
    {
        static::saved(fn ()   => Cache::forget('dashboard_stats'));
        static::deleted(fn () => Cache::forget('dashboard_stats'));
    }

    // ── Relaciones ────────────────────────────────────────────────

    /** Habitante que ocupa el cargo. Acceso: $vocero->habitante->nombres */
    public function habitante(): BelongsTo
    {
        return $this->belongsTo(Habitante::class)->withTrashed();
    }

    /**
     * Sede donde ejerce el vocero. La FK usa onDelete('restrict'):
     * no se puede borrar físicamente una sede con voceros.
     */
    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class)->withTrashed();
    }

    /** Comité del vocero (nullable, set null al eliminar el comité). */
    public function comite(): BelongsTo
    {
        return $this->belongsTo(Comite::class);
    }

    // ── Scopes ────────────────────────────────────────────────────

    /** Voceros activos. Uso: Vocero::activos()->with([...])->get() */
    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('esta_activo', true);
    }
}

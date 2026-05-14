<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 *  Tabla: calles
 *  Migración: 2026_03_30_000001_create_calles_table.php
 *
 *  Campos definidos en la migración:
 *  - sede_id:  foreignId → sedes (CASCADE)
 *  - nombre:   string(150)
 *
 *  RELACIONES:
 *  - Una Calle pertenece a una Sede    (belongsTo)
 *  - Una Calle tiene muchas Familias   (hasMany)
 *
 *  NOTA: No tiene SoftDeletes porque si una calle desaparece
 *  físicamente del sistema, sus familias pasan a calle_id = null
 *  (SET NULL definido en la migración con onDelete('set null')).
 * ═══════════════════════════════════════════════════════════════
 */
class Calle extends Model
{
    use HasFactory;

    protected $table = 'calles';

    protected $fillable = [
        'sede_id',
        'nombre',
    ];

    // ── Relaciones ────────────────────────────────────────────────

    /**
     * Una calle pertenece a una sede.
     * Acceso: $calle->sede->nombre
     */
    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    /**
     * Una calle agrupa muchas familias/viviendas.
     * Acceso: $calle->familias()->where('condicion_vivienda', 'critica')->count()
     */
    public function familias(): HasMany
    {
        return $this->hasMany(Familia::class);
    }
}

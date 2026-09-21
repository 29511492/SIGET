<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 *  Tabla: calles
 *  Migración: 2026_04_23_051747_create_calles_table.php
 *
 *  Campos:
 *  - sede_id:  foreignId → sedes (CASCADE)
 *  - nombre:   string(150)
 *
 *  RELACIONES:
 *  - Una Calle pertenece a una Sede    (belongsTo, withTrashed)
 *  - Una Calle tiene muchas Familias   (hasMany)
 *
 *  Sin SoftDeletes: si una calle se elimina físicamente, sus
 *  familias quedan con calle_id = null (SET NULL en familias).
 */
class Calle extends Model
{
    use HasFactory;

    protected $table = 'calles';

    protected $fillable = [
        'sede_id',
        'nombre',
    ];

    protected $casts = [
        'sede_id' => 'integer',
    ];

    // ── Relaciones ────────────────────────────────────────────────

    /** Acceso: $calle->sede->nombre */
    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class)->withTrashed();
    }

    /** Acceso: $calle->familias()->where('condicion_vivienda', 'critica')->count() */
    public function familias(): HasMany
    {
        return $this->hasMany(Familia::class);
    }
}

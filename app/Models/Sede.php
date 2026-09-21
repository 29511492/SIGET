<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * ═══════════════════════════════════════════════════════════════
 *  Sede — Sede comunal (Casa Comunal, Centro de Salud, etc.)
 * ───────────────────────────────────────────────────────────────
 *  ENUMs de la migración:
 *  tipo_sede: administrativa|salud|educativa|deportiva|cultural|otra
 *  estado_infraestructura: optima|regular|critica
 *
 *  Al crear los modelos de Cartografía (cartografia.sede_id),
 *  agregar aquí su relación hasMany.
 * ═══════════════════════════════════════════════════════════════
 */
class Sede extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'sedes';

    protected $fillable = [
        'nombre',
        'direccion',
        'tipo_sede',
        'estado_infraestructura',
        'observaciones',
    ];

    // ── Relaciones ────────────────────────────────────────────────

    public function calles(): HasMany
    {
        return $this->hasMany(Calle::class);
    }

    public function familias(): HasMany
    {
        return $this->hasMany(Familia::class);
    }

    /** Voceros asignados a esta sede. Acceso: $sede->voceros()->activos()->count() */
    public function voceros(): HasMany
    {
        return $this->hasMany(Vocero::class);
    }

    public function proyectos(): HasMany
    {
        return $this->hasMany(Proyecto::class);
    }
}

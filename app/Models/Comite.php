<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * ═══════════════════════════════════════════════════════════════
 *  Comite — Comité comunal normalizado
 * ───────────────────────────────────────────────────────────────
 *  Tabla: comites
 *  nombre: string(100) unique — evita duplicados como "Salud"/"salud"
 *  descripcion: text nullable
 * ═══════════════════════════════════════════════════════════════
 */
class Comite extends Model
{
    use HasFactory;

    protected $table = 'comites';

    protected $fillable = [
        'nombre',
        'descripcion',
    ];

    // ── Relaciones ────────────────────────────────────────────────

    /**
     * Voceros que pertenecen a este comité.
     * comite_id es nullable en voceros (SET NULL al eliminar comite).
     */
    public function voceros(): HasMany
    {
        return $this->hasMany(Vocero::class);
    }

    public function proyectos(): HasMany
    {
        return $this->hasMany(Proyecto::class);
    }
}

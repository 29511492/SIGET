<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * ═══════════════════════════════════════════════════════════════
 *  Encuesta — Campaña de censo territorial (gas, CLAP, otras)
 * ───────────────────────────────────────────────────────────────
 *  Tabla: encuestas
 *  Migración: 2026_09_15_000001_create_encuestas_table.php
 *
 *  SoftDeletes: se conservan las campañas cerradas para historial.
 *
 *  SIN CACHÉ: el mapa de calor se calcula siempre en vivo (ver
 *  MapaCalorController). La versión original invalidaba una clave
 *  'mapa_calor_stats' que ya nadie leía; se eliminó ese código.
 *
 *  RELACIONES:
 *  - Una Encuesta tiene muchas EncuestaRespuesta (hasMany)
 * ═══════════════════════════════════════════════════════════════
 */
class Encuesta extends Model
{
    use HasFactory, SoftDeletes;

    /** Tipos válidos. 'bombona_gas' activa la predicción de agotamiento. */
    public const TIPO_GAS   = 'bombona_gas';
    public const TIPO_CLAP  = 'bolsa_clap';
    public const TIPO_OTRO  = 'otro';
    public const TIPOS      = [self::TIPO_GAS, self::TIPO_CLAP, self::TIPO_OTRO];

    protected $table = 'encuestas';

    protected $fillable = [
        'nombre',
        'tipo',
        'descripcion',
        'fecha_inicio',
        'fecha_cierre',
        'activa',
    ];

    protected $casts = [
        'fecha_inicio' => 'date',
        'fecha_cierre' => 'date',
        'activa'       => 'boolean',
    ];

    // ── Relaciones ────────────────────────────────────────────────

    public function respuestas(): HasMany
    {
        return $this->hasMany(EncuestaRespuesta::class);
    }

    // ── Scopes ────────────────────────────────────────────────────

    public function scopeActivas(Builder $query): Builder
    {
        return $query->where('activa', true);
    }

    public function scopeDeTipo(Builder $query, string $tipo): Builder
    {
        return $query->where('tipo', $tipo);
    }

    // ── Helpers ───────────────────────────────────────────────────

    public function esDeGas(): bool
    {
        return $this->tipo === self::TIPO_GAS;
    }
}

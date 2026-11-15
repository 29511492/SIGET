<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * ═══════════════════════════════════════════════════════════════
 *  Encuesta — Campaña de censo territorial (gas, CLAP, agua, vivienda…)
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

    /**
     * Tipos válidos. El tipo decide cómo se calcula y se pinta el mapa de calor
     * (ver modo()):
     *  - bombona_gas        → predicción de agotamiento por fechas de entrega
     *  - bolsa_clap, combo_alimenticio, otro → cobertura (familias con entrega / total)
     *  - agua               → estado del servicio por familia (llega, intermitente, no llega)
     *  - condicion_vivienda → se calcula del censo (familias.condicion_vivienda);
     *                         no admite respuestas propias
     */
    public const TIPO_GAS       = 'bombona_gas';
    public const TIPO_CLAP      = 'bolsa_clap';
    public const TIPO_COMBO     = 'combo_alimenticio';
    public const TIPO_AGUA      = 'agua';
    public const TIPO_VIVIENDA  = 'condicion_vivienda';
    public const TIPO_OTRO      = 'otro';
    public const TIPOS          = [
        self::TIPO_GAS,
        self::TIPO_CLAP,
        self::TIPO_COMBO,
        self::TIPO_AGUA,
        self::TIPO_VIVIENDA,
        self::TIPO_OTRO,
    ];

    /** Estados válidos de una respuesta en las encuestas de agua (columna `estado`). */
    public const ESTADOS_AGUA = ['llega', 'intermitente', 'no_llega'];

    /** Modos de cálculo del mapa de calor (los consume MapaCalorController y el front). */
    public const MODO_AGOTAMIENTO = 'prediccion_agotamiento';
    public const MODO_COBERTURA   = 'cobertura';
    public const MODO_ESTADO      = 'estado_agua';
    public const MODO_VIVIENDA    = 'condicion_vivienda';

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

    /** Encuesta que registra un estado por familia (agua), no una cantidad. */
    public function esDeEstado(): bool
    {
        return $this->tipo === self::TIPO_AGUA;
    }

    /** Encuesta cuyo mapa sale del censo de familias, sin respuestas propias. */
    public function esDelCenso(): bool
    {
        return $this->tipo === self::TIPO_VIVIENDA;
    }

    /** Las encuestas del censo no admiten registrar entregas ni estados. */
    public function aceptaRespuestas(): bool
    {
        return ! $this->esDelCenso();
    }

    /** Modo de cálculo del mapa de calor para esta encuesta. */
    public function modo(): string
    {
        return match ($this->tipo) {
            self::TIPO_GAS      => self::MODO_AGOTAMIENTO,
            self::TIPO_AGUA     => self::MODO_ESTADO,
            self::TIPO_VIVIENDA => self::MODO_VIVIENDA,
            default             => self::MODO_COBERTURA,
        };
    }
}

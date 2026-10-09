<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * ═══════════════════════════════════════════════════════════════
 *  EncuestaRespuesta — Entrega registrada por familia
 * ───────────────────────────────────────────────────────────────
 *  Tabla: encuesta_respuestas
 *  Migración: 2026_09_15_000002_create_encuesta_respuestas_table.php
 *
 *  SoftDeletes: una corrección no destruye el historial que usa el
 *  EstimadorConsumoService para proyectar el agotamiento.
 *
 *  RELACIONES (ambas con withTrashed, regla 25 del Documento Maestro):
 *  - Pertenece a una Encuesta  (belongsTo)  ↔ Encuesta::respuestas
 *  - Pertenece a una Familia   (belongsTo)  ↔ Familia::encuestaRespuestas
 * ═══════════════════════════════════════════════════════════════
 */
class EncuestaRespuesta extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'encuesta_respuestas';

    protected $fillable = [
        'encuesta_id',
        'familia_id',
        'cantidad',
        'fecha_entrega',
        'observaciones',
    ];

    protected $casts = [
        'encuesta_id'   => 'integer',
        'familia_id'    => 'integer',
        'cantidad'      => 'integer',
        'fecha_entrega' => 'date',
    ];

    // ── Relaciones ────────────────────────────────────────────────

    public function encuesta(): BelongsTo
    {
        return $this->belongsTo(Encuesta::class)->withTrashed();
    }

    public function familia(): BelongsTo
    {
        return $this->belongsTo(Familia::class)->withTrashed();
    }
}

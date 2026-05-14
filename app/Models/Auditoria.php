<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ═══════════════════════════════════════════════════════════════
 *  Auditoria — SIGET
 * ───────────────────────────────────────────────────────────────
 *  DECISIONES DE DISEÑO:
 *
 *  1. Sin SoftDeletes — los logs de auditoría son INMUTABLES.
 *     Nunca se eliminan ni se editan. Patrón: Append-Only Log.
 *
 *  2. Sin updated_at — la migración solo define created_at.
 *     Desactivar updated_at con $timestamps = false causaría
 *     que Eloquent tampoco gestione created_at. En su lugar,
 *     se declara $updatedAt = false para desactivar solo ese campo.
 *
 *  3. Casts 'array' para valor_anterior y valor_nuevo:
 *     La migración usa json nativo de PostgreSQL/MySQL.
 *     El cast 'array' hace que Eloquent serialice/deserialice
 *     automáticamente — en el Resource se devuelven como arrays PHP.
 *
 *  4. Sin booted() con Cache::forget — los registros de auditoría
 *     no afectan las estadísticas del Dashboard.
 * ═══════════════════════════════════════════════════════════════
 */
class Auditoria extends Model
{
    // Solo created_at — sin updated_at (tabla append-only)
    const UPDATED_AT = null;

    protected $table = 'auditorias';

    protected $fillable = [
        'user_id',
        'accion',
        'tabla_afectada',
        'registro_id',
        'direccion_ip',
        'user_agent',
        'valor_anterior',
        'valor_nuevo',
    ];

    protected $casts = [
        'user_id'         => 'integer',
        'registro_id'     => 'integer',
        'valor_anterior'  => 'array',   // JSON nativo → array PHP automático
        'valor_nuevo'     => 'array',
        'created_at'      => 'datetime',
    ];

    // ── Relaciones ────────────────────────────────────────────────

    /**
     * Operador que realizó la acción.
     * nullable: acciones del sistema pueden no tener user_id.
     */
    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}

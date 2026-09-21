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
 *     `const UPDATED_AT = null` desactiva solo ese campo y deja
 *     que Eloquent siga gestionando created_at.
 *
 *  3. Casts 'array' para valor_anterior y valor_nuevo: la
 *     migración usa json nativo, y el cast serializa/deserializa
 *     automáticamente.
 *
 *  4. Sin Cache-Aside — los registros de auditoría no afectan
 *     las estadísticas del Dashboard.
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
    ];

    // ── Relaciones ────────────────────────────────────────────────

    /**
     * Operador que realizó la acción. Nullable: las acciones del
     * sistema pueden no tener user_id. withTrashed: el log conserva
     * al autor aunque el usuario haya sido dado de baja.
     */
    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withTrashed();
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * App\Models\Sugerencia
 *
 * Modelo de sugerencias/quejas enviadas por usuarios al Consejo Comunal.
 * Workflow: pendiente → en_revision → resuelta → archivada
 *
 * Relaciones:
 *   - belongsTo User (quien envió)
 *   - belongsTo User (quien revisó)
 *
 * No implementa Cache-Aside porque las sugerencias no afectan
 * los contadores del Dashboard.
 */
class Sugerencia extends Model
{
    use SoftDeletes;

    protected $table = 'sugerencias';

    protected $fillable = [
        'user_id',
        'revisada_por',
        'mensaje',
        'respuesta',
        'categoria',
        'prioridad',
        'revisada',
        'revisada_en',
    ];

    protected $casts = [
        'revisada'    => 'boolean',
        'revisada_en' => 'datetime',
    ];

    // ── Relaciones ─────────────────────────────────────────────
    public function autor()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function revisor()
    {
        return $this->belongsTo(User::class, 'revisada_por');
    }

    // ── Scopes ─────────────────────────────────────────────────
    public function scopePendientes($query)
    {
        return $query->where('revisada', false);
    }

    public function scopeRevisadas($query)
    {
        return $query->where('revisada', true);
    }

    public function scopeDeUsuario($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopePorCategoria($query, string $categoria)
    {
        return $query->where('categoria', $categoria);
    }

    public function scopePorPrioridad($query, string $prioridad)
    {
        return $query->where('prioridad', $prioridad);
    }
}

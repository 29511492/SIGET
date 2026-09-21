<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * App\Models\Sugerencia
 *
 * Sugerencias/quejas enviadas por usuarios al Consejo Comunal.
 * Estado: `revisada` = false → pendiente; true → revisada (con
 * `respuesta`, `revisada_por` y `revisada_en` opcionales).
 *
 * Relaciones (withTrashed: se conserva el autor/revisor aunque el
 * usuario haya sido dado de baja):
 *   - belongsTo User (autor: quien envió)
 *   - belongsTo User (revisor: quien revisó)
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
        'user_id'      => 'integer',
        'revisada_por' => 'integer',
        'revisada'     => 'boolean',
        'revisada_en'  => 'datetime',
    ];

    // ── Relaciones ─────────────────────────────────────────────
    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withTrashed();
    }

    public function revisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revisada_por')->withTrashed();
    }

    // ── Scopes ─────────────────────────────────────────────────
    public function scopePendientes(Builder $query): Builder
    {
        return $query->where('revisada', false);
    }

    public function scopeRevisadas(Builder $query): Builder
    {
        return $query->where('revisada', true);
    }

    public function scopeDeUsuario(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    public function scopePorCategoria(Builder $query, string $categoria): Builder
    {
        return $query->where('categoria', $categoria);
    }

    public function scopePorPrioridad(Builder $query, string $prioridad): Builder
    {
        return $query->where('prioridad', $prioridad);
    }
}

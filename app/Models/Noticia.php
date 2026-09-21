<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

/**
 * App\Models\Noticia
 *
 * Noticias comunales publicadas por admin/operador.
 * Los demás roles solo pueden leer las noticias publicadas.
 *
 * Relaciones:
 *   - belongsTo User (autor) — withTrashed: la noticia conserva
 *     a su autor aunque el usuario haya sido dado de baja.
 *
 * Cache-Aside: invalida 'noticias_recientes' en saved/deleted
 * para que el widget de noticias siempre muestre datos actualizados.
 */
class Noticia extends Model
{
    use SoftDeletes;

    protected $table = 'noticias';

    protected $fillable = [
        'user_id',
        'titulo',
        'contenido',
        'publicado',
        'published_at',
    ];

    protected $casts = [
        'user_id'      => 'integer',
        'publicado'    => 'boolean',
        'published_at' => 'datetime',
    ];

    // ── Cache-Aside ────────────────────────────────────────────
    protected static function booted(): void
    {
        static::saved(fn ()   => Cache::forget('noticias_recientes'));
        static::deleted(fn () => Cache::forget('noticias_recientes'));
    }

    // ── Relaciones ─────────────────────────────────────────────
    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withTrashed();
    }

    // ── Scopes ─────────────────────────────────────────────────

    /** Solo noticias publicadas — para roles de lectura. */
    public function scopePublicadas(Builder $query): Builder
    {
        return $query->where('publicado', true)
                     ->whereNotNull('published_at');
    }

    /** Ordena por fecha de publicación descendente. */
    public function scopeRecientes(Builder $query): Builder
    {
        return $query->orderBy('published_at', 'desc');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

/**
 * App\Models\Noticia
 *
 * Modelo de noticias comunales publicadas por admin/operador.
 * Los demás roles solo pueden leer las noticias publicadas.
 *
 * Relaciones:
 *   - belongsTo User (autor)
 *
 * Cache-Aside: invalida 'noticias_recientes' en saved/deleted
 * para que el widget de noticias en MiComunidad y PerfilPage
 * siempre muestre datos actualizados.
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
        'publicado'    => 'boolean',
        'published_at' => 'datetime',
    ];

    // ── Relaciones ─────────────────────────────────────────────
    public function autor()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // ── Cache-Aside ────────────────────────────────────────────
    protected static function booted(): void
    {
        static::saved(fn ()  => Cache::forget('noticias_recientes'));
        static::deleted(fn () => Cache::forget('noticias_recientes'));
    }

    // ── Scopes ─────────────────────────────────────────────────

    /**
     * Solo noticias publicadas — para roles de lectura
     */
    public function scopePublicadas($query)
    {
        return $query->where('publicado', true)
                     ->whereNotNull('published_at');
    }

    /**
     * Ordena por fecha de publicación descendente
     */
    public function scopeRecientes($query)
    {
        return $query->orderBy('published_at', 'desc');
    }
}

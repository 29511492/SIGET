<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

class Beneficio extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'beneficios';

    protected $fillable = [
        'familia_id',
        'user_id',
        'nombre_beneficio',
        'fecha_entrega',
        'observaciones',
    ];

    protected $casts = [
        'fecha_entrega' => 'date',
        'familia_id'    => 'integer',
        'user_id'       => 'integer',
    ];

    // ── Cache-Aside — igual que Proyecto, Familia, Habitante ────────────────
    protected static function booted(): void
    {
        static::saved(fn ()   => Cache::forget('dashboard_stats'));
        static::deleted(fn () => Cache::forget('dashboard_stats'));
    }

    // ── Relaciones ───────────────────────────────────────────────────────────
    public function familia(): BelongsTo
    {
        return $this->belongsTo(Familia::class);
    }

    // Alias semántico para trazabilidad — consistente con el Resource
    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}

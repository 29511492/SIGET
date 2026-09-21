<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

/**
 * ═══════════════════════════════════════════════════════════════
 *  Habitante — Persona del padrón comunal
 * ───────────────────────────────────────────────────────────────
 *  Cache-Aside: invalida 'dashboard_stats' en cada cambio, porque
 *  el Dashboard cuenta total_habitantes y con_discapacidad. El
 *  evento del modelo se dispara SIEMPRE que Eloquent persiste,
 *  sin importar el origen (controlador, seeder, importación).
 *
 *  RELACIONES:
 *  - Un habitante puede tener VARIOS registros de vocero (un
 *    mandato por registro, ver migración de voceros).
 *  - Un habitante tiene, como máximo, un usuario vinculado.
 * ═══════════════════════════════════════════════════════════════
 */
class Habitante extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'habitantes';

    protected $fillable = [
        'familia_id',
        'cedula',
        'nombres',
        'apellidos',
        'fecha_nacimiento',
        'sexo',
        'es_discapacitado',
        'tipo_discapacidad',
        'enfermedad_cronica',
        'nivel_educativo',
    ];

    protected $casts = [
        'familia_id'       => 'integer',
        'fecha_nacimiento' => 'date',
        'es_discapacitado' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::saved(fn ()   => Cache::forget('dashboard_stats'));
        static::deleted(fn () => Cache::forget('dashboard_stats'));
    }

    // ── Relaciones ────────────────────────────────────────────────

    public function familia(): BelongsTo
    {
        return $this->belongsTo(Familia::class)->withTrashed();
    }

    /** Mandatos de vocero de este habitante (puede haber varios). */
    public function voceros(): HasMany
    {
        return $this->hasMany(Vocero::class);
    }

    /** Usuario del sistema vinculado a este habitante (users.habitante_id). */
    public function user(): HasOne
    {
        return $this->hasOne(User::class);
    }

    /** Pagos registrados por el flujo admin/operador a nombre del habitante. */
    public function pagos(): HasMany
    {
        return $this->hasMany(PagoQr::class);
    }
}

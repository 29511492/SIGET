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
 *
 *  INTEGRIDAD (oct-2026, pendiente 14.8-I.2):
 *  Al dar de baja (soft delete) a un habitante, sus mandatos de
 *  vocero activos se cierran (esta_activo = false). La tabla
 *  voceros no tiene SoftDeletes, así que sin esto un habitante
 *  dado de baja seguiría figurando como vocero activo y
 *  conservaría su zona en el mapa de calor y en vocero/resumen.
 *  Restaurar al habitante NO reactiva sus mandatos: si vuelve a
 *  ser vocero, se registra un mandato nuevo.
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
        static::saved(fn () => Cache::forget('dashboard_stats'));

        // Baja (soft delete): cerrar mandatos de vocero y luego invalidar
        // el caché. Si el habitante se da de baja dentro de una
        // DB::transaction (FamiliaController), el cierre del mandato
        // queda en la misma transacción: todo o nada.
        static::deleted(function (Habitante $habitante) {
            $habitante->cerrarMandatosActivos();
            Cache::forget('dashboard_stats');
        });
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

    // ── Lógica de dominio ─────────────────────────────────────────

    /**
     * Cierra los mandatos de vocero activos de este habitante:
     * esta_activo = false y fecha_fin = hoy (solo si estaba vacía,
     * para no pisar una fecha de fin ya registrada).
     *
     * Se actualiza modelo por modelo (no con un UPDATE masivo) para
     * que Vocero dispare su evento saved y invalide el caché.
     * Es idempotente: si no hay mandatos activos, no hace nada.
     *
     * @return int Cantidad de mandatos cerrados.
     */
    public function cerrarMandatosActivos(): int
    {
        $cerrados = 0;

        $this->voceros()->activos()->get()->each(
            function (Vocero $vocero) use (&$cerrados) {
                $vocero->update([
                    'esta_activo' => false,
                    'fecha_fin'   => $vocero->fecha_fin ?? now()->toDateString(),
                ]);
                $cerrados++;
            }
        );

        return $cerrados;
    }
}
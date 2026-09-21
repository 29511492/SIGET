<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Comunicado extends Model
{
    use SoftDeletes;

    protected $table = 'comunicados';

    protected $fillable = [
        'user_id',
        'destinatario',
        'cargo_destinatario',
        'asunto',
        'cuerpo',
        'estado',
        'numero_oficio',
    ];

    protected $casts = [
        'user_id' => 'integer',
    ];

    // ─── Relaciones ────────────────────────────────────────────────────────────

    /** Redactor del comunicado (withTrashed: se conserva al dar de baja al usuario). */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    // ─── Scopes ────────────────────────────────────────────────────────────────

    public function scopeEnviados(Builder $query): Builder
    {
        return $query->where('estado', 'enviado');
    }

    public function scopeBorradores(Builder $query): Builder
    {
        return $query->where('estado', 'borrador');
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Genera el número de oficio correlativo automático.
     * Formato: CC-YYYY-NNNN  (CC = Consejo Comunal)
     * Se llama antes de guardar.
     */
    public static function generarNumeroOficio(): string
    {
        $anio    = now()->year;
        $ultimo  = self::whereYear('created_at', $anio)
                       ->whereNotNull('numero_oficio')
                       ->withTrashed()
                       ->count();

        $correlativo = str_pad($ultimo + 1, 4, '0', STR_PAD_LEFT);

        return "CC-{$anio}-{$correlativo}";
    }
}

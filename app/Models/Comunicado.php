<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
        'user_id'    => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    // ─── Relaciones ────────────────────────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ─── Scopes ────────────────────────────────────────────────────────────────

    public function scopeEnviados($query)
    {
        return $query->where('estado', 'enviado');
    }

    public function scopeBorradores($query)
    {
        return $query->where('estado', 'borrador');
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Genera el número de oficio correlativo automático.
     * Formato: CC-YYYY-NNNN  (CC = Consejo Comunal)
     * Se llama desde el servicio antes de guardar.
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

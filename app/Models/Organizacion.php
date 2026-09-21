<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

class Organizacion extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'organizaciones';

    public const TIPOS_SERVICIO = [
        'agua'          => 'Agua',
        'electricidad'  => 'Electricidad',
        'gas'           => 'Gas',
        'salud'         => 'Salud',
        'educacion'     => 'Educación',
        'seguridad'     => 'Seguridad',
        'transporte'    => 'Transporte',
        'otro'          => 'Otro',
    ];

    protected $fillable = [
        'nombre',
        'tipo_servicio',
        'contacto',
        'descripcion',
        'estatus',
    ];

    protected $casts = [
        'estatus' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::saved(fn ()   => Cache::forget('organizaciones_index'));
        static::deleted(fn () => Cache::forget('organizaciones_index'));
    }

    // ── Relaciones ────────────────────────────────────────────────

    /** Pagos vinculados a este servicio (pagos_qr.organizacion_id). */
    public function pagos(): HasMany
    {
        return $this->hasMany(PagoQr::class);
    }
}

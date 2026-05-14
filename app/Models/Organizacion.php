<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

class Organizacion extends Model
{
    use HasFactory, SoftDeletes;   // ← SoftDeletes activo — deleted_at existe en la tabla

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
        'estatus',        // ← columna confirmada en la nueva migración
    ];

    protected $casts = [
        'estatus'    => 'boolean',
        'deleted_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::saved(fn ()   => Cache::forget('organizaciones_index'));
        static::deleted(fn () => Cache::forget('organizaciones_index'));
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * App\Models\CuentaPago
 *
 * Representa una cuenta bancaria de destino para pagos QR del
 * Consejo Comunal, asociada a un servicio (Gas, Cuota, Aseo, etc.).
 * El admin/operador la gestiona; el rol "usuario" la consulta de
 * solo lectura al momento de pagar (Capa 1).
 */
class CuentaPago extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'cuentas_pago';

    protected $fillable = [
        'nombre_servicio',
        'banco',
        'telefono',
        'cedula_rif',
        'titular',
        'descripcion',
        'activa',
    ];

    protected $casts = [
        'activa' => 'boolean',
    ];

    // ── Relaciones ────────────────────────────────────────────
    public function pagos(): HasMany
    {
        return $this->hasMany(PagoQr::class, 'cuenta_pago_id');
    }

    // ── Scopes ────────────────────────────────────────────────
    public function scopeActivas($query)
    {
        return $query->where('activa', true);
    }
}

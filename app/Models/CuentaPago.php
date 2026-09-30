<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * App\Models\CuentaPago
 *
 * Cuenta de destino para pagos QR del Consejo Comunal, asociada a un
 * servicio (Gas, Cuota, Aseo, etc.) y a un método de pago.
 * El admin/operador la gestiona; el rol "usuario" la consulta de
 * solo lectura al momento de pagar (Capa 1).
 *
 * CAMBIO (sept-2026, corrección 2 del profesor): antes solo existía
 * pago móvil de forma implícita. Ahora cada cuenta declara su
 * `metodo` (ver METODOS). Un mismo servicio con dos métodos se
 * modela como dos cuentas (misma nombre_servicio, distinto metodo).
 */
class CuentaPago extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'cuentas_pago';

    /**
     * Métodos de pago soportados. Fuente única de verdad — agregar un
     * método nuevo aquí y en la validación de los FormRequest, sin
     * tocar el esquema.
     */
    public const METODOS = ['pago_movil', 'transferencia'];

    public const METODOS_LABEL = [
        'pago_movil'    => 'Pago móvil',
        'transferencia' => 'Transferencia',
    ];

    protected $fillable = [
        'nombre_servicio',
        'metodo',
        'banco',
        'telefono',
        'numero_cuenta',
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
    public function scopeActivas(Builder $query): Builder
    {
        return $query->where('activa', true);
    }

    public function scopeDeMetodo(Builder $query, string $metodo): Builder
    {
        return $query->where('metodo', $metodo);
    }

    // ── Helpers ───────────────────────────────────────────────
    public function esPagoMovil(): bool
    {
        return $this->metodo === 'pago_movil';
    }

    public function esTransferencia(): bool
    {
        return $this->metodo === 'transferencia';
    }
}

<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * CuentaPagoResource
 *
 * Transforma el modelo CuentaPago para el frontend.
 * Todos los valores son primitivos — nunca objetos anidados.
 */
class CuentaPagoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'nombre_servicio'  => $this->nombre_servicio,
            'metodo'           => $this->metodo,
            'metodo_label'     => match($this->metodo) {
                'pago_movil'    => 'Pago móvil',
                'transferencia' => 'Transferencia',
                default         => $this->metodo,
            },
            'banco'            => $this->banco,
            'telefono'         => $this->telefono,
            'numero_cuenta'    => $this->numero_cuenta,
            'cedula_rif'       => $this->cedula_rif,
            'titular'          => $this->titular,
            'descripcion'      => $this->descripcion,
            'activa'           => $this->activa,
            'created_at'       => $this->created_at?->toDateString(),
        ];
    }
}

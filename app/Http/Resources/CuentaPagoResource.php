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
            'banco'            => $this->banco,
            'telefono'         => $this->telefono,
            'cedula_rif'       => $this->cedula_rif,
            'titular'          => $this->titular,
            'descripcion'      => $this->descripcion,
            'activa'           => $this->activa,
            'created_at'       => $this->created_at?->toDateString(),
        ];
    }
}

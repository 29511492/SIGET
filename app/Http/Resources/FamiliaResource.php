<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ═══════════════════════════════════════════════════════════════
 *  Transforma Familia para el frontend
 * ───────────────────────────────────────────────────────────────
 *  Devuelve la familia recién creada en el store().
 *  React usará este objeto para mostrar el mensaje de éxito
 *  y redirigir al perfil de la familia.
 * ═══════════════════════════════════════════════════════════════
 */
class FamiliaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                 => $this->id,
            'codigo_vivienda'    => $this->codigo_vivienda,
            'nombre_responsable' => $this->nombre_responsable,
            'condicion_vivienda' => $this->condicion_vivienda,
            'cantidad_bombonas'  => $this->cantidad_bombonas,
            'capacidad_bombona'  => $this->capacidad_bombona,
            'posee_agua_potable' => $this->posee_agua_potable,
            'punto_referencia'   => $this->punto_referencia,

            // Relaciones cargadas con load()
            'sede'  => $this->whenLoaded('sede',  fn () => [
                'id'     => $this->sede->id,
                'nombre' => $this->sede->nombre,
            ]),
            'calle' => $this->whenLoaded('calle', fn () => [
                'id'     => $this->calle->id,
                'nombre' => $this->calle->nombre,
            ]),

            'created_at' => $this->created_at?->toDateString(),
        ];
    }
}

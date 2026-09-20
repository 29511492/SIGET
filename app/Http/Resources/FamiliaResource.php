<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ═══════════════════════════════════════════════════════════════
 *  Transforma Familia para el frontend
 * ───────────────────────────────────────────────────────────────
 *  Devuelve la familia (recién creada, editada, o consultada).
 *
 *  CAMBIO (sept-2026): incluye 'habitantes' cuando la relación fue
 *  eager-loaded (siempre lo está desde store/update/show — ver
 *  FamiliaController). HabitanteResource se reutiliza tal cual
 *  estaba, sin cambios: solo dejó de tener sus propios endpoints.
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
            'posee_luz'          => $this->posee_luz,
            'posee_aseo'         => $this->posee_aseo,
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

            // Habitantes de la familia — ya no tienen endpoint propio,
            // viajan anidados dentro de la familia (sept-2026).
            'habitantes' => HabitanteResource::collection($this->whenLoaded('habitantes')),

            'created_at' => $this->created_at?->toDateString(),
        ];
    }
}

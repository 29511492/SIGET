<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EncuestaRespuestaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'encuesta_id'    => $this->encuesta_id,
            'familia_id'     => $this->familia_id,
            'familia_nombre' => $this->whenLoaded('familia', fn () => $this->familia->nombre_responsable),
            'calle_nombre'   => $this->whenLoaded('familia', fn () => $this->familia->calle?->nombre),
            'cantidad'       => $this->cantidad,
            'fecha_entrega'  => $this->fecha_entrega?->format('Y-m-d'),
            'observaciones'  => $this->observaciones,
            'created_at'     => $this->created_at,
        ];
    }
}

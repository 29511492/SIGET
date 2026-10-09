<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EncuestaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'nombre'           => $this->nombre,
            'tipo'             => $this->tipo,
            'descripcion'      => $this->descripcion,
            'fecha_inicio'     => $this->fecha_inicio?->format('Y-m-d'),
            'fecha_cierre'     => $this->fecha_cierre?->format('Y-m-d'),
            'activa'           => $this->activa,
            // Solo está presente cuando el controlador hizo withCount('respuestas')
            // (únicamente para admin: al vocero no se le exponen totales globales).
            'total_respuestas' => $this->whenCounted('respuestas'),
            'created_at'       => $this->created_at,
        ];
    }
}

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
            // Cómo se calcula el mapa de esta encuesta, y si admite registrar
            // entregas/estados (la de condición de vivienda sale del censo).
            'modo'             => $this->modo(),
            'acepta_respuestas' => $this->aceptaRespuestas(),
            'descripcion'      => $this->descripcion,
            'fecha_inicio'     => $this->fecha_inicio?->format('Y-m-d'),
            'fecha_cierre'     => $this->fecha_cierre?->format('Y-m-d'),
            // Servicio controlado (solo tipo pago_servicio)
            'cuenta_pago_id'     => $this->cuenta_pago_id,
            'cuenta_pago_nombre' => $this->whenLoaded('cuentaPago', fn () => $this->cuentaPago?->nombre_servicio),
            'activa'           => $this->activa,
            // Solo está presente cuando el controlador hizo withCount('respuestas')
            // (únicamente para admin: al vocero no se le exponen totales globales).
            'total_respuestas' => $this->whenCounted('respuestas'),
            'created_at'       => $this->created_at,
        ];
    }
}

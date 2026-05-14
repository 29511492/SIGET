<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ═══════════════════════════════════════════════════════════════
 *  HabitanteResource — Transforma Habitante para el frontend
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN: Se calcula la edad en el backend (no en el frontend).
 *  Razón: la edad depende de la fecha actual del servidor, que es
 *  la fuente de verdad. Si se calcula en el frontend puede diferir
 *  según la zona horaria del navegador del usuario.
 * ═══════════════════════════════════════════════════════════════
 */
class HabitanteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'cedula'           => $this->cedula,
            'nombres'          => $this->nombres,
            'apellidos'        => $this->apellidos,
            'nombre_completo'  => "{$this->nombres} {$this->apellidos}",
            'fecha_nacimiento' => $this->fecha_nacimiento?->format('Y-m-d'),
            // Edad calculada en el servidor — fuente de verdad única
            'edad'             => $this->fecha_nacimiento?->age,
            'sexo'             => $this->sexo,

            // Indicadores sociales
            'es_discapacitado'  => $this->es_discapacitado,
            'tipo_discapacidad' => $this->tipo_discapacidad,
            'enfermedad_cronica'=> $this->enfermedad_cronica,
            'nivel_educativo'   => $this->nivel_educativo,

            // Familia vinculada (solo si fue eager-loaded)
            'familia' => $this->whenLoaded('familia', fn () => [
                'id'                 => $this->familia->id,
                'codigo_vivienda'    => $this->familia->codigo_vivienda,
                'nombre_responsable' => $this->familia->nombre_responsable,
            ]),

            'created_at' => $this->created_at?->toDateString(),
        ];
    }
}

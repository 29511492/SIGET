<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ═══════════════════════════════════════════════════════════════
 *  VoceroResource — Transforma Vocero para el frontend
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN: Se aplana el nombre del habitante al nivel del vocero.
 *  En vez de que el frontend haga vocero.habitante.nombres + apellidos,
 *  el Resource devuelve directamente vocero.nombre_vocero.
 *  Esto reduce el acoplamiento entre el frontend y la estructura
 *  interna del backend — si la relación cambia, solo se modifica aquí.
 * ═══════════════════════════════════════════════════════════════
 */
class VoceroResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'unidad_comunal' => $this->unidad_comunal,
            'fecha_eleccion' => $this->fecha_eleccion?->format('Y-m-d'),
            'fecha_fin'      => $this->fecha_fin?->format('Y-m-d'),
            'esta_activo'    => $this->esta_activo,

            // Datos del habitante aplanados para la tabla del frontend
            'habitante' => $this->whenLoaded('habitante', fn () => [
                'id'            => $this->habitante->id,
                'nombre_vocero' => "{$this->habitante->nombres} {$this->habitante->apellidos}",
                'cedula'        => $this->habitante->cedula,
            ]),

            'sede' => $this->whenLoaded('sede', fn () => [
                'id'     => $this->sede->id,
                'nombre' => $this->sede->nombre,
            ]),

            'comite' => $this->whenLoaded('comite', fn () => $this->comite ? [
                'id'     => $this->comite->id,
                'nombre' => $this->comite->nombre,
            ] : null),

            'created_at' => $this->created_at?->toDateString(),
        ];
    }
}

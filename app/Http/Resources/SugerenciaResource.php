<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * SugerenciaResource
 *
 * Transforma el modelo Sugerencia para el frontend.
 * Expone solo los campos necesarios — nunca deleted_at.
 * El campo 'es_mia' permite al frontend saber si la sugerencia
 * pertenece al usuario autenticado sin exponer user_id directamente.
 */
class SugerenciaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'mensaje'     => $this->mensaje,
            'respuesta'   => $this->respuesta,
            'categoria'   => $this->categoria,
            'prioridad'   => $this->prioridad,
            'revisada'    => $this->revisada,
            'revisada_en' => $this->revisada_en?->toDateTimeString(),
            'fecha_legible' => $this->created_at?->locale('es')->diffForHumans(),
            'created_at'  => $this->created_at?->toDateString(),

            // Indica si pertenece al usuario autenticado
            'es_mia'      => $request->user()?->id === $this->user_id,

            // Autor — solo expuesto para admin/operador/vocero
            'autor'       => $this->whenLoaded('autor', fn () => [
                'id'   => $this->autor?->id,
                'name' => $this->autor?->name ?? 'Usuario eliminado',
            ]),

            // Revisor — quien marcó como revisada
            'revisor'     => $this->whenLoaded('revisor', fn () => [
                'id'   => $this->revisor?->id,
                'name' => $this->revisor?->name ?? '—',
            ]),
        ];
    }
}

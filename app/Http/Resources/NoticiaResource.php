<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * NoticiaResource
 *
 * Transforma el modelo Noticia para el frontend.
 * Expone solo los campos necesarios — nunca deleted_at.
 * El campo 'extracto' es los primeros 150 caracteres del
 * contenido, útil para el widget de vista previa.
 */
class NoticiaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'titulo'       => $this->titulo,
            'contenido'    => $this->contenido,
            'extracto'     => mb_strimwidth(strip_tags($this->contenido), 0, 150, '...'),
            'publicado'    => $this->publicado,
            'published_at' => $this->published_at?->toDateTimeString(),
            'fecha_legible'=> $this->published_at?->locale('es')->diffForHumans(),
            'autor'        => $this->whenLoaded('autor', fn () => [
                'id'   => $this->autor->id,
                'name' => $this->autor->name,
            ]),
            'created_at'   => $this->created_at?->toDateString(),
        ];
    }
}

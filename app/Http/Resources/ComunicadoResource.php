<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ComunicadoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                 => $this->id,
            'numero_oficio'      => $this->numero_oficio,
            'destinatario'       => $this->destinatario,
            'cargo_destinatario' => $this->cargo_destinatario,
            'asunto'             => $this->asunto,
            'cuerpo'             => $this->cuerpo,
            'estado'             => $this->estado,
            'created_at'         => $this->created_at?->format('d/m/Y H:i'),
            'updated_at'         => $this->updated_at?->format('d/m/Y H:i'),
            // Auditoría: quién lo creó
            'autor' => $this->whenLoaded('user', fn() => [
                'id'     => $this->user->id,
                'nombre' => $this->user->name,
            ]),
        ];
    }
}

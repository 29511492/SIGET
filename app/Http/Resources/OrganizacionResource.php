<?php

namespace App\Http\Resources;

use App\Models\Organizacion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrganizacionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'nombre'              => $this->nombre,
            'tipo_servicio'       => $this->tipo_servicio,
            'tipo_servicio_label' => Organizacion::TIPOS_SERVICIO[$this->tipo_servicio] ?? $this->tipo_servicio,
            'contacto'            => $this->contacto,
            'descripcion'         => $this->descripcion,
            'estatus'             => $this->estatus,              // boolean
            'estatus_label'       => $this->estatus ? 'Activo' : 'Inactivo',
            'created_at'          => $this->created_at?->toDateString(),
        ];
    }
}

<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProyectoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                    => $this->id,
            'nombre_proyecto'       => $this->nombre_proyecto,
            'objetivo'              => $this->objetivo,
            'monto_aprobado'        => $this->monto_aprobado,
            'fuente_financiamiento' => $this->fuente_financiamiento,
            'estatus'               => $this->estatus,
            'fecha_inicio'          => $this->fecha_inicio?->format('Y-m-d'),
            'fecha_fin'             => $this->fecha_fin?->format('Y-m-d'),

            // Relaciones aplanadas — evita N+1 con eager loading en el Controller
            'sede_id'               => $this->sede_id,
            'sede_nombre'           => $this->sede?->nombre ?? null,
            'comite_id'             => $this->comite_id,
            'comite_nombre'         => $this->comite?->nombre ?? null,
            'user_id'               => $this->user_id,
            'registrado_por'        => $this->user?->name ?? null,
            'created_at'            => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'            => $this->updated_at?->format('Y-m-d H:i:s'),
        ];
    }
}

<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Todos los valores son primitivos — nunca objetos anidados,
 * para evitar "Objects are not valid as a React child".
 */
class PagoQrResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                   => $this->id,
            'estado'               => $this->estado,
            'estado_label'         => match($this->estado) {
                'pendiente'   => 'Pendiente',
                'verificado'  => 'Verificado',
                'rechazado'   => 'Rechazado',
                default       => $this->estado,
            },

            // ── Datos del pago ────────────────────────────────
            'referencia_bancaria'  => $this->referencia_bancaria,
            'monto'                => $this->monto,
            'concepto_pago'        => $this->concepto_pago,
            'motivo_rechazo'       => $this->motivo_rechazo,
            'fecha_pago'           => $this->fecha_pago?->toDateString(),
            'fecha_verificacion'   => $this->fecha_verificacion?->toDateTimeString(),

            // ── Comprobante ───────────────────────────────────
            'comprobante_path'     => $this->comprobante_path,
            'comprobante_url'      => $this->comprobante_url, // accessor del modelo

            // ── Relaciones aplanadas ──────────────────────────
            'habitante_id'         => $this->habitante_id,
            'habitante_nombre'     => $this->whenLoaded('habitante', fn () =>
                trim(($this->habitante->nombres ?? '') . ' ' . ($this->habitante->apellidos ?? ''))
            ),

            'familia_id'           => $this->familia_id,
            'familia_responsable'  => $this->whenLoaded('familia', fn () =>
                $this->familia?->nombre_responsable
            ),

            'organizacion_id'      => $this->organizacion_id,
            'organizacion_nombre'  => $this->whenLoaded('organizacion', fn () =>
                $this->organizacion?->nombre
            ),

            'verificado_por'       => $this->verificado_por,
            'verificador_nombre'   => $this->whenLoaded('verificador', fn () =>
                $this->verificador?->name
            ),

            'created_at'           => $this->created_at?->toDateString(),
        ];
    }
}

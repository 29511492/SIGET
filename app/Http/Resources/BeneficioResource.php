<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ═══════════════════════════════════════════════════════════════
 *  BeneficioResource — SIGET
 * ───────────────────────────────────────────────────────────────
 *  Transforma Beneficio para el frontend.
 *
 *  Campos expuestos: exactamente los declarados en $fillable del
 *  modelo Beneficio.php — sin inventar campos adicionales.
 *
 *  Relaciones (con whenLoaded para lazy-safety):
 *    - familia       → id + nombre_responsable + codigo_vivienda
 *    - registradoPor → id + name  (trazabilidad del operador)
 * ═══════════════════════════════════════════════════════════════
 */
class BeneficioResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            // ── Campos propios del modelo ────────────────────────
            'id'               => $this->id,
            'nombre_beneficio' => $this->nombre_beneficio,
            'fecha_entrega'    => $this->fecha_entrega?->toDateString(),
            'observaciones'    => $this->observaciones,

            // ── Claves foráneas (por si el frontend las necesita) ─
            'familia_id'       => $this->familia_id,
            'user_id'          => $this->user_id,

            // ── Relación: familia beneficiada ─────────────────────
            // whenLoaded() garantiza que no se lanza una query extra
            // si la relación no fue cargada con with() o load().
            'familia_responsable' => $this->whenLoaded( 'familia', fn ()
                => $this->familia->nombre_responsable,
                null
            ),

            'familia_codigo' => $this->whenLoaded( 'familia', fn ()
                => $this->familia->codigo_vivienda,
                null
            ),
            // ── Relación: operador que registró (trazabilidad) ────
            // Alias 'registradoPor' definido en Beneficio::registradoPor()
            // apunta a users.id via FK user_id.
            'registrado_por' => $this->whenLoaded('registradoPor', fn ()
                =>$this->registradoPor->name,
                null
            ),

            // ── Metadatos ────────────────────────────────────────
            'created_at' => $this->created_at?->toDateString(),
        ];
    }
}

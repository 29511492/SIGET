<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ═══════════════════════════════════════════════════════════════
 *  AuditoriaResource — SIGET
 * ───────────────────────────────────────────────────────────────
 *  Transforma un registro de auditoría para el frontend.
 *
 *  Decisiones de diseño:
 *  - 'operador' aplana el nombre del usuario (string, no objeto)
 *    para que el frontend pueda renderizarlo directamente en <td>.
 *  - 'created_at' se formatea en dos versiones: fecha legible para
 *    mostrar y timestamp ISO para ordenar/filtrar en el cliente.
 *  - 'valor_anterior' y 'valor_nuevo' se devuelven tal cual (JSON)
 *    para que el frontend pueda inspeccionarlos en un <pre> o modal.
 * ═══════════════════════════════════════════════════════════════
 */
class AuditoriaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,

            // ── Quién realizó la acción ────────────────────────────
            // String aplanado — nunca un objeto, para evitar el error
            // "Objects are not valid as a React child"
            'operador'       => $this->whenLoaded(
                'usuario',
                fn () => $this->usuario->name,
                'Sistema'   // fallback si user_id es null (acción del sistema)
            ),
            'operador_email' => $this->whenLoaded(
                'usuario',
                fn () => $this->usuario->email,
                null
            ),

            // ── Qué se hizo ────────────────────────────────────────
            'accion'         => $this->accion,          // 'creado' | 'actualizado' | 'soft_eliminado'
            'tabla_afectada' => $this->tabla_afectada,
            'registro_id'    => $this->registro_id,

            // ── Contexto técnico ───────────────────────────────────
            'direccion_ip'   => $this->direccion_ip,
            'user_agent'     => $this->user_agent,

            // ── Valores antes/después ──────────────────────────────
            // Se devuelven como arrays (el cast 'array' en el modelo
            // los deserializa automáticamente desde JSON nativo).
            'valor_anterior' => $this->valor_anterior,
            'valor_nuevo'    => $this->valor_nuevo,

            // ── Fechas ────────────────────────────────────────────
            // Dos versiones para que el frontend elija:
            //   'fecha_legible' → para mostrar en la tabla
            //   'fecha_iso'     → para ordenar o usar en <time datetime="">
            'fecha_legible'  => $this->created_at?->format('d/m/Y H:i:s'),
            'fecha_iso'      => $this->created_at?->toIso8601String(),
        ];
    }
}

<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ═══════════════════════════════════════════════════════════════
 *  DashboardStatsResource — Patrón API Response
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA — ¿Por qué un Resource para un array simple?
 *
 *  El controlador podría devolver el array directamente con
 *  response()->json(['data' => $stats]). Pero usar un Resource
 *  tiene tres ventajas:
 *
 *  1. CONTRATO EXPLÍCITO: Este archivo documenta exactamente qué
 *     claves existen en la respuesta. El frontend sabe qué esperar.
 *     Un array anónimo no tiene documentación — este Resource sí.
 *
 *  2. ENRIQUECIMIENTO FUTURO: Si en el futuro se agrega metadata
 *     (ej: timestamp del último censo, delta vs mes anterior),
 *     se agrega aquí sin tocar el controlador.
 *
 *  3. CONSISTENCIA: Todos los endpoints de SIGET usan Resources.
 *     Un endpoint que devuelva un array crudo rompe la consistencia
 *     arquitectónica del sistema. Uniformidad = mantenibilidad.
 *
 *  NOTA: Para este caso específico usamos JsonResource sobre un
 *  array (no sobre un Model). Laravel lo soporta nativamente
 *  pasando el array como `new DashboardStatsResource($array)`.
 * ═══════════════════════════════════════════════════════════════
 */
class DashboardStatsResource extends JsonResource
{
    /**
     * Transforma el array de estadísticas en la respuesta final.
     *
     * Las claves DEBEN coincidir exactamente con STAT_CARDS_CONFIG
     * en AdminDashboard.jsx. Un cambio de nombre aquí sin actualizar
     * el frontend resultará en tarjetas mostrando 0.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            // ── Datos del censo ───────────────────────────────────
            'total_familias'     => $this->resource['total_familias']     ?? 0,
            'total_habitantes'   => $this->resource['total_habitantes']   ?? 0,
            'viviendas_criticas' => $this->resource['viviendas_criticas'] ?? 0,
            'con_discapacidad'   => $this->resource['con_discapacidad']   ?? 0,
            'total_voceros'      => $this->resource['total_voceros']      ?? 0,
            'total_proyectos'    => $this->resource['total_proyectos']    ?? 0,
            'total_beneficios'   => $this->resource['total_beneficios']   ?? 0,

            // ── Metadata del snapshot ─────────────────────────────
            // Indica al frontend cuándo se calcularon estos datos.
            // Útil para mostrar "Actualizado hace X minutos".
            'generado_en' => now()->toIso8601String(),

            // ── Campos reservados para futuras expansiones ────────
            // 'delta_familias_mes'    => null,
            // 'ultimo_censo'          => null,
        ];
    }
}

<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\DashboardStatsResource;
use App\Models\Beneficio;
use App\Models\Familia;
use App\Models\Habitante;
use App\Models\Proyecto;
use App\Models\Vocero;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * ═══════════════════════════════════════════════════════════════
 *  DashboardController — Estadísticas globales del censo
 * ───────────────────────────────────────────────────────────────
 *  RUTA: GET /api/v1/dashboard/stats
 *  PROTECCIÓN: auth:sanctum (cualquier rol autenticado puede leer)
 *
 *  DECISIÓN ARQUITECTÓNICA — Caché de conteos:
 *  Los conteos del dashboard son costosos (COUNT sobre tablas grandes)
 *  y cambian con poca frecuencia. Se almacenan en caché por 5 minutos.
 *  Cuando se registra una nueva familia u habitante, el evento
 *  correspondiente debe llamar Cache::forget('dashboard_stats')
 *  para invalidar el caché. Patrón: Cache-Aside.
 *
 *  CLAVES DE RESPUESTA:
 *  Las claves del JSON coinciden 1:1 con STAT_CARDS_CONFIG del frontend.
 *  Cualquier cambio aquí DEBE reflejarse en el array del componente.
 * ═══════════════════════════════════════════════════════════════
 */
class DashboardController extends Controller
{
    /**
     * GET /api/v1/dashboard/stats
     *
     * Devuelve los conteos del censo para las tarjetas del dashboard.
     * Usa caché de 5 minutos para evitar N queries por cada carga de página.
     */
    public function stats(Request $request): JsonResponse
    {
        $stats = Cache::remember('dashboard_stats', now()->addMinutes(5), function () {
            return $this->calcularEstadisticas();
        });

        return response()->json([
            'message' => 'Estadísticas cargadas correctamente.',
            'data'    => $stats,
        ], 200);
    }

    /**
     * Calcula todos los conteos en una sola pasada eficiente.
     *
     * DECISIÓN: Se usan consultas separadas en lugar de un JOIN masivo.
     * Razón: cada conteo tiene condiciones distintas. Un JOIN único
     * generaría filas duplicadas que distorsionarían los COUNT.
     * Las 6 queries son simples (solo COUNT con WHERE) — PostgreSQL
     * las resuelve en microsegundos con los índices correctos.
     *
     * @return array<string, int>
     */
    private function calcularEstadisticas(): array
    {
        return [
            // ── Claves 1:1 con STAT_CARDS_CONFIG del frontend ────────

            /**
             * Total de familias/viviendas registradas en el censo.
             * softDeletes: withTrashed() NO se usa — solo familias activas.
             */
            'total_familias' => Familia::count(),

            /**
             * Total de habitantes en el padrón comunal.
             * No filtra por familia — es el conteo global del censo.
             */
            'total_habitantes' => Habitante::count(),

            /**
             * Viviendas en estado crítico de infraestructura.
             * Campo: familias.condicion_vivienda = 'critica'
             * (ENUM definido en la migración: 'optima', 'regular', 'critica')
             */
            'viviendas_criticas' => Familia::where('condicion_vivienda', 'critica')->count(),

            /**
             * Habitantes con alguna discapacidad registrada.
             * Campo: habitantes.es_discapacitado = true (boolean)
             * (Definido en la migración como boolean, default false)
             */
            'con_discapacidad' => Habitante::where('es_discapacitado', true)->count(),

            /**
             * Voceros activos en el sistema.
             * Campo: voceros.esta_activo = true (boolean)
             * Solo cuenta voceros con mandato vigente.
             */
            'total_voceros' => Vocero::where('esta_activo', true)->count(),

            /**
             * Proyectos registrados en el sistema.
             * Cuenta TODOS los proyectos (todos los estatus).
             * Si se desea solo activos: ->whereIn('estatus', ['aprobado', 'en_ejecucion'])
             */
            'total_proyectos' => Proyecto::count(),

            /**
             * Total de beneficios entregados a familias.
             * Es el conteo de registros en la tabla beneficios.
             */
            'total_beneficios' => Beneficio::count(),
        ];
    }
}

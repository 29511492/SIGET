<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Habitante;
use App\Models\Familia;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ReporteController extends Controller
{
    /**
     * GET /api/v1/reportes/constancia-residencia/{habitante}
     *
     * Genera en caliente la constancia de residencia de un habitante.
     * No persiste nada en BD — extrae datos de los modelos existentes.
     *
     * CORRECCIÓN (nov-2026, ERR-05 / RG-004 / CU-003, flujo 1): si la
     * familia del habitante fue dada de baja, o el habitante no tiene
     * familia, NO se genera el PDF y se responde 422 con un mensaje
     * claro. Habitante::familia() usa withTrashed() a propósito (para
     * conservar el historial), por eso la comprobación es explícita.
     * Un habitante dado de baja ya responde 404 por el route-model
     * binding (SoftDeletes).
     */
    public function constanciaResidencia(Habitante $habitante): Response|JsonResponse
    {
        // Cargar relaciones necesarias para la constancia
        $habitante->load(['familia.sede', 'familia.calle']);

        if ($habitante->familia === null) {
            return $this->constanciaRechazada(
                'No se puede emitir la constancia de residencia: el habitante no está asociado a ninguna familia.'
            );
        }

        if ($habitante->familia->trashed()) {
            return $this->constanciaRechazada(
                'No se puede emitir la constancia de residencia: la familia de este habitante fue dada de baja.'
            );
        }

        $datos = [
            'habitante'   => $habitante,
            'familia'     => $habitante->familia,
            'sede'        => $habitante->familia?->sede,
            'calle'       => $habitante->familia?->calle,
            'fecha_emision' => now()->locale('es')->isoFormat('D [de] MMMM [de] YYYY'),
            'titulo_doc'  => 'CONSTANCIA DE RESIDENCIA',
        ];

        $pdf = Pdf::loadView('pdf.constancia_residencia', $datos)
                  ->setPaper('letter', 'portrait');

        $nombreArchivo = 'constancia_residencia_' . str_replace(' ', '_', strtolower($habitante->nombres)) . '.pdf';

        return $pdf->download($nombreArchivo);
    }

    /** Respuesta 422 uniforme para las constancias que no proceden. */
    private function constanciaRechazada(string $mensaje): JsonResponse
    {
        return response()->json([
            'message' => $mensaje,
            'errors'  => ['habitante' => [$mensaje]],
        ], 422);
    }

    /**
     * GET /api/v1/reportes/estadisticas-dashboard
     *
     * Genera en caliente el reporte resumen del dashboard.
     * Extrae directamente de los modelos, sin tabla de reportes.
     */
    public function estadisticasDashboard(): Response
    {
        $datos = [
            'total_familias'     => \App\Models\Familia::count(),
            'total_habitantes'   => \App\Models\Habitante::count(),
            'con_discapacidad'   => \App\Models\Habitante::where('es_discapacitado', true)->count(),
            'viviendas_criticas' => \App\Models\Familia::where('condicion_vivienda', 'critica')->count(),
            'viviendas_regulares'=> \App\Models\Familia::where('condicion_vivienda', 'regular')->count(),
            'viviendas_optimas'  => \App\Models\Familia::where('condicion_vivienda', 'optima')->count(),
            'fecha_emision'      => now()->locale('es')->isoFormat('D [de] MMMM [de] YYYY H:mm [hrs]'),
            'titulo_doc'         => 'REPORTE DE ESTADÍSTICAS COMUNALES',
        ];

        $pdf = Pdf::loadView('pdf.estadisticas_dashboard', $datos)
                  ->setPaper('letter', 'portrait');

        return $pdf->download('reporte_estadisticas_' . now()->format('Y-m-d') . '.pdf');
    }
}

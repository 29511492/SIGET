<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\EncuestaRespuesta\StoreEncuestaRespuestaMasivaRequest;
use App\Http\Requests\EncuestaRespuesta\StoreEncuestaRespuestaRequest;
use App\Http\Requests\EncuestaRespuesta\UpdateEncuestaRespuestaRequest;
use App\Http\Resources\EncuestaRespuestaResource;
use App\Models\Encuesta;
use App\Models\EncuestaRespuesta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * ═══════════════════════════════════════════════════════════════
 *  EncuestaRespuestaController — Entregas por familia
 * ───────────────────────────────────────────────────────────────
 *  Todas las rutas son de Capa 4 (solo admin): el listado incluye
 *  nombres de responsables de familia (datos del censo).
 *
 *  GET    /api/v1/encuestas/{encuesta}/respuestas             → index()
 *  POST   /api/v1/encuestas/{encuesta}/respuestas             → store()
 *  POST   /api/v1/encuestas/{encuesta}/respuestas/masivo      → storeMasivo()
 *  PUT    /api/v1/encuesta-respuestas/{encuestaRespuesta}     → update()
 *  DELETE /api/v1/encuesta-respuestas/{encuestaRespuesta}     → destroy()
 * ═══════════════════════════════════════════════════════════════
 */
class EncuestaRespuestaController extends Controller
{
    public function index(Request $request, Encuesta $encuesta): JsonResponse
    {
        $porPagina = min(max($request->integer('per_page', 20), 1), 50);

        $respuestas = $encuesta->respuestas()
            ->with('familia.calle')
            ->orderByDesc('fecha_entrega')
            ->orderByDesc('id')
            ->paginate($porPagina);

        return response()->json([
            'message' => 'Respuestas obtenidas correctamente.',
            'data'    => EncuestaRespuestaResource::collection($respuestas),
            'meta'    => [
                'current_page' => $respuestas->currentPage(),
                'last_page'    => $respuestas->lastPage(),
                'total'        => $respuestas->total(),
            ],
        ]);
    }

    public function store(StoreEncuestaRespuestaRequest $request, Encuesta $encuesta): JsonResponse
    {
        $respuesta = $encuesta->respuestas()->create($request->validated());

        return response()->json([
            'message' => 'Respuesta registrada correctamente.',
            'data'    => new EncuestaRespuestaResource($respuesta->load('familia.calle')),
        ], 201);
    }

    /**
     * Registra la MISMA entrega para varias familias a la vez.
     * POST /v1/encuestas/{encuesta}/respuestas/masivo
     *
     * Propuesta de la compañera que diseñó el módulo (el camión de gas reparte
     * por calle, no familia por familia), adaptada al proyecto (oct-2026):
     *  · Todo ocurre en una transacción: o se guardan todas o ninguna.
     *  · Si una familia ya tiene una entrega ese mismo día en esta encuesta, se
     *    omite (un doble clic no duplica registros). Se detecta con UNA consulta
     *    para todo el lote, no una por familia.
     *  · Cada entrega se crea con create() para que la auditoría y las demás
     *    reglas del modelo se apliquen igual que en el registro individual.
     */
    public function storeMasivo(StoreEncuestaRespuestaMasivaRequest $request, Encuesta $encuesta): JsonResponse
    {
        $datos = $request->validated();
        $ids   = array_values(array_unique(array_map('intval', $datos['familia_ids'])));

        $registradas = 0;
        $omitidas    = 0;

        DB::transaction(function () use ($datos, $encuesta, $ids, &$registradas, &$omitidas) {
            // Familias que ya tienen una entrega ese día en esta encuesta
            $yaTienen = EncuestaRespuesta::query()
                ->where('encuesta_id', $encuesta->id)
                ->whereDate('fecha_entrega', $datos['fecha_entrega'])
                ->whereIn('familia_id', $ids)
                ->pluck('familia_id')
                ->map(fn ($id) => (int) $id)
                ->flip();

            foreach ($ids as $familiaId) {
                if ($yaTienen->has($familiaId)) {
                    $omitidas++;
                    continue;
                }

                $encuesta->respuestas()->create([
                    'familia_id'    => $familiaId,
                    'cantidad'      => $datos['cantidad'],
                    'fecha_entrega' => $datos['fecha_entrega'],
                    'observaciones' => $datos['observaciones'] ?? null,
                ]);

                $registradas++;
            }
        });

        $mensaje = $registradas === 0
            ? 'No se registró ninguna entrega.'
            : 'Se ' . ($registradas === 1 ? 'registró 1 entrega.' : "registraron {$registradas} entregas.");

        if ($omitidas > 0) {
            $mensaje .= $omitidas === 1
                ? ' 1 familia se omitió porque ya tenía una entrega ese mismo día.'
                : " {$omitidas} familias se omitieron porque ya tenían una entrega ese mismo día.";
        }

        return response()->json([
            'message' => $mensaje,
            'data'    => [
                'registradas' => $registradas,
                'omitidas'    => $omitidas,
            ],
        ], $registradas > 0 ? 201 : 200);
    }

    public function update(UpdateEncuestaRespuestaRequest $request, EncuestaRespuesta $encuestaRespuesta): JsonResponse
    {
        $encuestaRespuesta->update($request->validated());

        return response()->json([
            'message' => 'Respuesta actualizada correctamente.',
            'data'    => new EncuestaRespuestaResource($encuestaRespuesta->load('familia.calle')),
        ]);
    }

    /** SoftDelete: la corrección no destruye el historial del estimador. */
    public function destroy(EncuestaRespuesta $encuestaRespuesta): JsonResponse
    {
        $encuestaRespuesta->delete();

        return response()->json([
            'message' => 'Respuesta eliminada correctamente.',
        ]);
    }
}

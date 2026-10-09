<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\EncuestaRespuesta\StoreEncuestaRespuestaRequest;
use App\Http\Requests\EncuestaRespuesta\UpdateEncuestaRespuestaRequest;
use App\Http\Resources\EncuestaRespuestaResource;
use App\Models\Encuesta;
use App\Models\EncuestaRespuesta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ═══════════════════════════════════════════════════════════════
 *  EncuestaRespuestaController — Entregas por familia
 * ───────────────────────────────────────────────────────────────
 *  Todas las rutas son de Capa 4 (solo admin): el listado incluye
 *  nombres de responsables de familia (datos del censo).
 *
 *  GET    /api/v1/encuestas/{encuesta}/respuestas             → index()
 *  POST   /api/v1/encuestas/{encuesta}/respuestas             → store()
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

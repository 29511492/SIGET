<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Encuesta\StoreEncuestaRequest;
use App\Http\Requests\Encuesta\UpdateEncuestaRequest;
use App\Http\Resources\EncuestaResource;
use App\Models\Encuesta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ═══════════════════════════════════════════════════════════════
 *  EncuestaController — Campañas de censo territorial
 * ───────────────────────────────────────────────────────────────
 *  GET    /api/v1/encuestas              → index()   [admin + vocero]
 *  POST   /api/v1/encuestas              → store()   [solo admin]
 *  GET    /api/v1/encuestas/{encuesta}   → show()    [solo admin]
 *  PUT    /api/v1/encuestas/{encuesta}   → update()  [solo admin]
 *  DELETE /api/v1/encuestas/{encuesta}   → destroy() [solo admin]
 *
 *  El vocero solo necesita la LISTA (selector del mapa de calor).
 *  Al vocero no se le calculan totales de respuestas: serían cifras
 *  globales de todas las sedes.
 * ═══════════════════════════════════════════════════════════════
 */
class EncuestaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Encuesta::query()
            ->when($request->filled('tipo'), fn ($q) => $q->deTipo((string) $request->input('tipo')))
            ->when($request->boolean('solo_activas'), fn ($q) => $q->activas());

        if ($request->user()->esAdmin()) {
            $query->withCount('respuestas');
        }

        // Tope de per_page (misma regla que familias): sin él, ?per_page=999999
        // permitiría extraer todo en una sola petición.
        $porPagina = min(max($request->integer('per_page', 15), 1), 50);

        $encuestas = $query->orderByDesc('created_at')->orderByDesc('id')->paginate($porPagina);

        return response()->json([
            'message' => 'Encuestas obtenidas correctamente.',
            'data'    => EncuestaResource::collection($encuestas),
            'meta'    => [
                'current_page' => $encuestas->currentPage(),
                'last_page'    => $encuestas->lastPage(),
                'total'        => $encuestas->total(),
            ],
        ]);
    }

    public function store(StoreEncuestaRequest $request): JsonResponse
    {
        // refresh(): 'activa' toma su default (true) de la BD; sin recargar
        // el modelo, la respuesta devolvería activa = null.
        $encuesta = Encuesta::create($request->validated())->refresh();

        return response()->json([
            'message' => 'Encuesta creada correctamente.',
            'data'    => new EncuestaResource($encuesta),
        ], 201);
    }

    public function show(Encuesta $encuesta): JsonResponse
    {
        $encuesta->loadCount('respuestas');

        return response()->json([
            'message' => 'Encuesta obtenida correctamente.',
            'data'    => new EncuestaResource($encuesta),
        ]);
    }

    public function update(UpdateEncuestaRequest $request, Encuesta $encuesta): JsonResponse
    {
        $encuesta->update($request->validated());
        $encuesta->loadCount('respuestas');

        return response()->json([
            'message' => 'Encuesta actualizada correctamente.',
            'data'    => new EncuestaResource($encuesta),
        ]);
    }

    /**
     * SoftDelete: las entregas registradas se conservan en el historial.
     */
    public function destroy(Encuesta $encuesta): JsonResponse
    {
        $encuesta->delete();

        return response()->json([
            'message' => 'Encuesta eliminada correctamente.',
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Habitante\StoreHabitanteRequest;
use App\Http\Requests\Habitante\UpdateHabitanteRequest;
use App\Http\Resources\HabitanteResource;
use App\Models\Habitante;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * ═══════════════════════════════════════════════════════════════
 *  HabitanteController — CRUD completo
 * ───────────────────────────────────────────────────────────────
 *  GET    /api/v1/habitantes          → index()   [todos los roles]
 *  POST   /api/v1/habitantes          → store()   [admin+operador]
 *  GET    /api/v1/habitantes/{id}     → show()    [todos los roles]
 *  PUT    /api/v1/habitantes/{id}     → update()  [admin+operador]
 *  DELETE /api/v1/habitantes/{id}     → destroy() [solo admin]
 * ═══════════════════════════════════════════════════════════════
 */
class HabitanteController extends Controller
{
    // ─────────────────────────────────────────────────────────────
    //  GET /api/v1/habitantes
    // ─────────────────────────────────────────────────────────────
    /**
     * Lista paginada de habitantes con búsqueda opcional.
     * Parámetros: ?familia_id=1  ?search=carlos  ?per_page=20
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Habitante::with('familia')
            ->when($request->familia_id, fn ($q) =>
                $q->where('familia_id', $request->familia_id)
            )
            ->when($request->search, fn ($q) =>
                $q->where(function ($q) use ($request) {
                    $q->where('nombres',   'ilike', "%{$request->search}%")
                    ->orWhere('apellidos','ilike', "%{$request->search}%")
                    ->orWhere('cedula',   'ilike', "%{$request->search}%");
                })
            )
            ->orderBy('apellidos')
            ->orderBy('nombres');

        return HabitanteResource::collection(
            $query->paginate($request->per_page ?? 20)
        );
    }

    // ─────────────────────────────────────────────────────────────
    //  POST /api/v1/habitantes
    // ─────────────────────────────────────────────────────────────
    public function store(StoreHabitanteRequest $request): JsonResponse
    {
        $habitante = Habitante::create($request->validated());
        $habitante->load('familia');

        return response()->json([
            'message' => 'Habitante registrado correctamente.',
            'data'    => new HabitanteResource($habitante),
        ], 201);
    }

    // ─────────────────────────────────────────────────────────────
    //  GET /api/v1/habitantes/{habitante}
    // ─────────────────────────────────────────────────────────────
    public function show(Habitante $habitante): JsonResponse
    {
        $habitante->load(['familia.sede', 'familia.calle', 'vocero']);

        return response()->json([
            'data' => new HabitanteResource($habitante),
        ], 200);
    }

    // ─────────────────────────────────────────────────────────────
    //  PUT /api/v1/habitantes/{habitante}
    // ─────────────────────────────────────────────────────────────
    public function update(UpdateHabitanteRequest $request, Habitante $habitante): JsonResponse
    {
        $datos = $request->validated();

        // Si se desmarca discapacidad, borrar el tipo para consistencia
        if (isset($datos['es_discapacitado']) && !$datos['es_discapacitado']) {
            $datos['tipo_discapacidad'] = null;
        }

        $habitante->update($datos);
        $habitante->load('familia');

        return response()->json([
            'message' => 'Habitante actualizado correctamente.',
            'data'    => new HabitanteResource($habitante),
        ], 200);
    }

    // ─────────────────────────────────────────────────────────────
    //  DELETE /api/v1/habitantes/{habitante}
    // ─────────────────────────────────────────────────────────────
    public function destroy(Habitante $habitante): JsonResponse
    {
        $nombre = "{$habitante->nombres} {$habitante->apellidos}";
        $habitante->delete();

        return response()->json([
            'message' => "{$nombre} fue dado de baja del padrón correctamente.",
        ], 200);
    }
}

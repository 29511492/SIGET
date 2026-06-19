<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sugerencia\StoreSugerenciaRequest;
use App\Http\Requests\Sugerencia\RevisarSugerenciaRequest;
use App\Http\Resources\SugerenciaResource;
use App\Models\Sugerencia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * SugerenciaController
 *
 * Gestión de sugerencias y quejas comunales.
 *
 * auth:sanctum (todos los roles):
 *   POST /sugerencias              → store()   enviar sugerencia
 *   GET  /sugerencias/mis          → mis()     ver las propias
 *
 * Capa 2 (admin + operador + vocero):
 *   GET  /sugerencias              → index()   ver todas con filtros
 *
 * Capa 3 (admin + operador):
 *   PATCH /sugerencias/{id}/revisar → revisar() marcar revisada + responder
 *
 * Capa 4 (solo admin):
 *   DELETE /sugerencias/{id}       → destroy() SoftDelete
 */
class SugerenciaController extends Controller
{
    // ─────────────────────────────────────────────────────────────
    //  TODOS LOS ROLES AUTENTICADOS
    // ─────────────────────────────────────────────────────────────

    /**
     * POST /api/v1/sugerencias
     * Enviar una nueva sugerencia. Cualquier rol autenticado puede enviar.
     */
    public function store(StoreSugerenciaRequest $request): JsonResponse
    {
        $sugerencia = Sugerencia::create([
            'user_id'   => $request->user()->id,
            'mensaje'   => $request->mensaje,
            'categoria' => $request->categoria,
            'prioridad' => $request->input('prioridad', 'media'),
        ]);

        $sugerencia->load('autor');

        return response()->json([
            'message' => 'Sugerencia enviada correctamente. Gracias por tu aporte.',
            'data'    => new SugerenciaResource($sugerencia),
        ], 201);
    }

    /**
     * GET /api/v1/sugerencias/mis
     * Lista las sugerencias del usuario autenticado.
     * Permite al usuario hacer seguimiento de sus envíos.
     */
    public function mis(Request $request): JsonResponse
    {
        $sugerencias = Sugerencia::deUsuario($request->user()->id)
            ->with('revisor')
            ->latest()
            ->paginate(10);

        return response()->json([
            'message' => 'Sugerencias obtenidas correctamente.',
            'data'    => SugerenciaResource::collection($sugerencias->items()),
            'meta'    => [
                'current_page' => $sugerencias->currentPage(),
                'last_page'    => $sugerencias->lastPage(),
                'total'        => $sugerencias->total(),
                'per_page'     => $sugerencias->perPage(),
            ],
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    //  CAPA 2 — Lectura (admin + operador + vocero)
    // ─────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/sugerencias
     * Listado de todas las sugerencias con filtros.
     * Soporta filtro por: revisada, categoria, prioridad, búsqueda.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Sugerencia::with(['autor', 'revisor'])->latest();

        if ($request->filled('revisada')) {
            $revisada = filter_var($request->revisada, FILTER_VALIDATE_BOOLEAN);
            $query->where('revisada', $revisada);
        }

        if ($request->filled('categoria')) {
            $query->porCategoria($request->categoria);
        }

        if ($request->filled('prioridad')) {
            $query->porPrioridad($request->prioridad);
        }

        if ($request->filled('buscar')) {
            $query->where('mensaje', 'ilike', '%' . $request->buscar . '%');
        }

        $sugerencias = $query->paginate(15);

        return response()->json([
            'message' => 'Sugerencias obtenidas correctamente.',
            'data'    => SugerenciaResource::collection($sugerencias->items()),
            'meta'    => [
                'current_page' => $sugerencias->currentPage(),
                'last_page'    => $sugerencias->lastPage(),
                'total'        => $sugerencias->total(),
                'per_page'     => $sugerencias->perPage(),
                'pendientes'   => Sugerencia::pendientes()->count(),
            ],
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    //  CAPA 3 — Escritura (admin + operador)
    // ─────────────────────────────────────────────────────────────

    /**
     * PATCH /api/v1/sugerencias/{sugerencia}/revisar
     * Marca la sugerencia como revisada y opcionalmente responde.
     * Registra quién la revisó y cuándo.
     */
    public function revisar(
        RevisarSugerenciaRequest $request,
        Sugerencia $sugerencia
    ): JsonResponse {
        $sugerencia->update([
            'revisada'     => true,
            'revisada_en'  => now(),
            'revisada_por' => $request->user()->id,
            'respuesta'    => $request->respuesta,
            'prioridad'    => $request->input('prioridad', $sugerencia->prioridad),
        ]);

        $sugerencia->load(['autor', 'revisor']);

        return response()->json([
            'message' => 'Sugerencia marcada como revisada.',
            'data'    => new SugerenciaResource($sugerencia),
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    //  CAPA 4 — Solo admin
    // ─────────────────────────────────────────────────────────────

    /**
     * DELETE /api/v1/sugerencias/{sugerencia}
     * SoftDelete — el registro queda en BD con deleted_at.
     */
    public function destroy(Sugerencia $sugerencia): JsonResponse
    {
        $sugerencia->delete();

        return response()->json([
            'message' => 'Sugerencia eliminada correctamente.',
        ]);
    }
}

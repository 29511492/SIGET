<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Familia\StoreFamiliaRequest;
use App\Http\Requests\Familia\UpdateFamiliaRequest;
use App\Http\Resources\FamiliaResource;
use App\Models\Familia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Log;

/**
 * ═══════════════════════════════════════════════════════════════
 *  FamiliaController — CRUD completo
 * ───────────────────────────────────────────────────────────────
 *  GET    /api/v1/familias           → index()   [todos los roles]
 *  POST   /api/v1/familias           → store()   [admin+operador]
 *  GET    /api/v1/familias/{id}      → show()    [todos los roles]
 *  PUT    /api/v1/familias/{id}      → update()  [admin+operador]
 *  DELETE /api/v1/familias/{id}      → destroy() [solo admin]
 * ═══════════════════════════════════════════════════════════════
 */

class FamiliaController extends Controller
{
    // ─────────────────────────────────────────────────────────────
    //  GET /api/v1/familias
    // ─────────────────────────────────────────────────────────────
    /**
     * Lista paginada de familias con sus relaciones básicas.
     * El frontend puede pasar ?sede_id=1 para filtrar por sede.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Familia::with(['sede', 'calle'])
            ->when($request->sede_id, fn ($q) =>
                $q->where('sede_id', $request->sede_id)
            )
            ->when($request->condicion, fn ($q) =>
                $q->where('condicion_vivienda', $request->condicion)
            )
            // NUEVO: búsqueda de texto para el select de HabitanteForm
            ->when($request->search, fn ($q) =>
                $q->where(function ($inner) use ($request) {
                    $inner->where('nombre_responsable', 'ilike', "%{$request->search}%")
                        ->orWhere('codigo_vivienda',  'ilike', "%{$request->search}%");
                })
            )
            ->orderBy('codigo_vivienda');

        // Lista plana para el buscador de HabitanteForm
        if ($request->boolean('sin_paginar')) {
            return FamiliaResource::collection(
                $query->limit(20)->get()
            );
        }

        return FamiliaResource::collection(
            $query->paginate($request->per_page ?? 20)
        );
    }

    // ─────────────────────────────────────────────────────────────
    //  POST /api/v1/familias
    // ─────────────────────────────────────────────────────────────
    public function store(StoreFamiliaRequest $request): JsonResponse
    {
        $familia = Familia::create($request->validated());

        // Cargar relaciones para la respuesta — evita N+1 en el Resource
        $familia->load(['sede', 'calle']);

        return response()->json([
            'message' => 'Familia registrada correctamente.',
            'data'    => new FamiliaResource($familia),
        ], 201); // 201 Created — estándar REST para recursos nuevos
    }

    // ─────────────────────────────────────────────────────────────
    //  GET /api/v1/familias/{familia}
    // ─────────────────────────────────────────────────────────────
    /**
     * Perfil completo de una familia con sus habitantes y beneficios.
     */
    public function show(Familia $familia): JsonResponse
    {
        $familia->load(['sede', 'calle', 'habitantes', 'beneficios']);

        return response()->json([
            'data' => new FamiliaResource($familia),
        ], 200);
    }

    // ─────────────────────────────────────────────────────────────
    //  PUT /api/v1/familias/{familia}
    // ─────────────────────────────────────────────────────────────
    public function update(UpdateFamiliaRequest $request, Familia $familia): JsonResponse
    {
        try {
            $familia->update($request->validated());

            // Recargar relaciones para devolver la fila completa al frontend
            $familia->load(['sede', 'calle']);

            return response()->json([
                'message' => 'Familia actualizada correctamente.',
                'data'    => new FamiliaResource($familia),
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error al actualizar familia', [
                'familia_id' => $familia->id,
                'datos'      => $request->validated(),
                'error'      => $e->getMessage(),
                'trace'      => $e->getTraceAsString(),
            ]);

            return response()->json([
                'message' => 'Error interno al actualizar la familia. Revisa los logs del servidor.',
                'errors'  => [],
            ], 500);
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  DELETE /api/v1/familias/{familia}
    // ─────────────────────────────────────────────────────────────
    public function destroy(Familia $familia): JsonResponse
    {
        $familia->delete();

        return response()->json([
            'message' => 'Familia eliminada correctamente.',
        ], 200);
    }
}

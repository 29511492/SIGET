<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Beneficio\StoreBeneficioRequest;
use App\Http\Requests\Beneficio\UpdateBeneficioRequest;
use App\Http\Resources\BeneficioResource;
use App\Models\Beneficio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BeneficioController extends Controller
{
    // ─── GET /v1/beneficios ─────────────────────────────────────────────────
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Beneficio::with(['familia', 'registradoPor']);

        // Búsqueda ilike (PostgreSQL, Regla 3.8)
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->whereHas('familia', function ($q) use ($search) {
                $q->where('apellido_familia', 'ilike', "%{$search}%")
                  ->orWhere('codigo_vivienda', 'ilike', "%{$search}%");
            });
        }

        // Filtro por familia
        if ($familiaId = $request->query('familia_id')) {
            $query->where('familia_id', (int) $familiaId);
        }

        $beneficios = $query->orderBy('fecha_entrega', 'desc')->paginate(10);

        return BeneficioResource::collection($beneficios);
    }

    // ─── POST /v1/beneficios ────────────────────────────────────────────────
    public function store(StoreBeneficioRequest $request): JsonResponse
    {
        $beneficio = Beneficio::create([
            ...$request->validated(),
            'user_id' => $request->user()->id,   // trazabilidad automática
        ]);

        $beneficio->load(['familia', 'registradoPor']);

        return response()->json([
            'message' => 'Beneficio registrado exitosamente.',
            'data'    => new BeneficioResource($beneficio),
        ], 201);
    }

    // ─── GET /v1/beneficios/{beneficio} ─────────────────────────────────────
    public function show(Beneficio $beneficio): JsonResponse
    {
        $beneficio->load(['familia', 'registradoPor']);

        return response()->json([
            'message' => 'Beneficio obtenido.',
            'data'    => new BeneficioResource($beneficio),
        ]);
    }

    // ─── PUT /v1/beneficios/{beneficio} ─────────────────────────────────────
    public function update(UpdateBeneficioRequest $request, Beneficio $beneficio): JsonResponse
    {
        $beneficio->update($request->validated());
        $beneficio->load(['familia', 'registradoPor']);

        return response()->json([
            'message' => 'Beneficio actualizado exitosamente.',
            'data'    => new BeneficioResource($beneficio),
        ]);
    }

    // ─── DELETE /v1/beneficios/{beneficio} ──────────────────────────────────
    public function destroy(Beneficio $beneficio): JsonResponse
    {
        $beneficio->delete(); // SoftDelete — booted() invalida dashboard_stats

        return response()->json([
            'message' => 'Beneficio eliminado correctamente.',
        ]);
    }
}

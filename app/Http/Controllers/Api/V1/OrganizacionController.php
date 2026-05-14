<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Organizacion\StoreOrganizacionRequest;
use App\Http\Requests\Organizacion\UpdateOrganizacionRequest;
use App\Http\Resources\OrganizacionResource;
use App\Models\Organizacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrganizacionController extends Controller
{
    // ─── GET /v1/organizaciones/form-data ────────────────────────
    // Ruta estática — SIEMPRE antes que {org} en api.php
    public function formData(): JsonResponse
    {
        $tipos = collect(Organizacion::TIPOS_SERVICIO)
            ->map(fn ($label, $value) => ['value' => $value, 'label' => $label])
            ->values();

        return response()->json([
            'message' => 'OK',
            'data'    => ['tipos_servicio' => $tipos],
        ]);
    }

    // ─── GET /v1/organizaciones ──────────────────────────────────
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Organizacion::orderBy('nombre');

        if ($request->filled('tipo_servicio')) {
            $query->where('tipo_servicio', $request->input('tipo_servicio'));
        }

        // Filtro de estatus: si no se pasa, muestra solo activos por defecto
        if ($request->has('estatus')) {
            $query->where('estatus', filter_var($request->input('estatus'), FILTER_VALIDATE_BOOLEAN));
        } else {
            $query->where('estatus', true);
        }

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(function ($q) use ($s) {
                $q->where('nombre',      'ilike', "%{$s}%")
                  ->orWhere('descripcion','ilike', "%{$s}%");
            });
        }

        return OrganizacionResource::collection($query->paginate(15));
    }

    // ─── GET /v1/organizaciones/{org} ────────────────────────────
    public function show(Organizacion $org): JsonResponse
    {
        return response()->json([
            'message' => 'OK',
            'data'    => new OrganizacionResource($org),
        ]);
    }

    // ─── POST /v1/organizaciones ─────────────────────────────────
    public function store(StoreOrganizacionRequest $request): JsonResponse
    {
        $org = Organizacion::create($request->validated());

        return response()->json([
            'message' => 'Organización registrada correctamente.',
            'data'    => new OrganizacionResource($org),
        ], 201);
    }

    // ─── PUT /v1/organizaciones/{org} ────────────────────────────
    public function update(UpdateOrganizacionRequest $request, Organizacion $org): JsonResponse
    {
        $org->update($request->validated());

        return response()->json([
            'message' => 'Organización actualizada correctamente.',
            'data'    => new OrganizacionResource($org),
        ]);
    }

    // ─── DELETE /v1/organizaciones/{org} ─────────────────────────
    // Soft-delete: rellena deleted_at, el registro se conserva.
    public function destroy(Organizacion $org): JsonResponse
    {
        $org->delete();

        return response()->json([
            'message' => 'Organización dada de baja correctamente.',
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Proyecto\StoreProyectoRequest;
use App\Http\Requests\Proyecto\UpdateProyectoRequest;
use App\Http\Resources\ProyectoResource;
use App\Models\Comite;
use App\Models\Proyecto;
use App\Models\Sede;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProyectoController extends Controller
{
    // ─── GET /v1/proyectos ───────────────────────────────────────────────────
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Proyecto::with(['sede', 'comite', 'user']);

        // Búsqueda por nombre — ilike (PostgreSQL, case-insensitive, Regla 3.8)
        if ($search = $request->query('search')) {
            $query->where('nombre_proyecto', 'ilike', '%' . $search . '%');
        }

        // Filtro por estatus
        if ($estatus = $request->query('estatus')) {
            $query->where('estatus', $estatus);
        }

        // Filtro por sede
        if ($sedeId = $request->query('sede_id')) {
            $query->where('sede_id', (int) $sedeId);
        }

        $proyectos = $query->orderBy('created_at', 'desc')->paginate(15);

        return ProyectoResource::collection($proyectos);
    }

    // ─── POST /v1/proyectos ──────────────────────────────────────────────────
    public function store(StoreProyectoRequest $request): JsonResponse
    {
        $proyecto = Proyecto::create([
            ...$request->validated(),
            'user_id' => $request->user()->id,
        ]);

        $proyecto->load(['sede', 'comite', 'user']);

        return response()->json([
            'message' => 'Proyecto creado exitosamente.',
            'data'    => new ProyectoResource($proyecto),
        ], 201);
    }

    // ─── GET /v1/proyectos/{proyecto} ────────────────────────────────────────
    public function show(Proyecto $proyecto): JsonResponse
    {
        $proyecto->load(['sede', 'comite', 'user']);

        return response()->json([
            'message' => 'Proyecto obtenido.',
            'data'    => new ProyectoResource($proyecto),
        ]);
    }

    // ─── PUT /v1/proyectos/{proyecto} ────────────────────────────────────────
    public function update(UpdateProyectoRequest $request, Proyecto $proyecto): JsonResponse
    {
        $proyecto->update($request->validated());
        $proyecto->load(['sede', 'comite', 'user']);

        return response()->json([
            'message' => 'Proyecto actualizado exitosamente.',
            'data'    => new ProyectoResource($proyecto),
        ]);
    }

    // ─── DELETE /v1/proyectos/{proyecto} ─────────────────────────────────────
    public function destroy(Proyecto $proyecto): JsonResponse
    {
        $proyecto->delete(); // SoftDelete — el booted() invalida el caché

        return response()->json([
            'message' => 'Proyecto eliminado correctamente.',
        ]);
    }

    // ─── GET /v1/proyectos/form-data (Patrón BFF — Regla de Voceros) ─────────
    // IMPORTANTE: Esta ruta DEBE registrarse ANTES de la ruta dinámica {proyecto}
    // en api.php para evitar que "form-data" sea interpretado como un ID (Regla 3.5)
    public function getFormData(): JsonResponse
    {
        $sedes   = Sede::select('id', 'nombre')->orderBy('nombre')->get();
        $comites = Comite::select('id', 'nombre')->orderBy('nombre')->get();

        return response()->json([
            'message' => 'Datos del formulario cargados.',
            'data'    => [
                'sedes'   => $sedes,
                'comites' => $comites,
            ],
        ]);
    }
}

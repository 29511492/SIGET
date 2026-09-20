<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Familia\StoreFamiliaRequest;
use App\Http\Requests\Familia\UpdateFamiliaRequest;
use App\Http\Resources\FamiliaResource;
use App\Models\Familia;
use App\Models\Habitante;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * ═══════════════════════════════════════════════════════════════
 *  FamiliaController — CRUD completo + habitantes anidados
 * ───────────────────────────────────────────────────────────────
 *  GET    /api/v1/familias           → index()   [todos los roles]
 *  POST   /api/v1/familias           → store()   [admin+operador]
 *  GET    /api/v1/familias/{id}      → show()    [todos los roles]
 *  PUT    /api/v1/familias/{id}      → update()  [admin+operador]
 *  DELETE /api/v1/familias/{id}      → destroy() [solo admin]
 *
 *  CAMBIO ARQUITECTÓNICO (sept-2026, instrucción del profesor):
 *  El módulo de Habitantes se elimina como módulo independiente.
 *  Los habitantes de una familia ahora se crean, editan y dan de
 *  baja DENTRO del mismo formulario de Familia (un array
 *  `habitantes[]` en el payload de store()/update()). Ya no
 *  existen endpoints /api/v1/habitantes — el modelo Habitante se
 *  sigue usando internamente, pero solo a través de este
 *  controlador.
 *
 *  store() y update() envuelven la familia + sus habitantes en
 *  una única transacción de base de datos (DB::transaction): o se
 *  guarda todo, o no se guarda nada. Evita familias con
 *  habitantes a medio registrar si algo falla a mitad de camino.
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
            ->when($request->search, fn ($q) =>
                $q->where(function ($inner) use ($request) {
                    $inner->where('nombre_responsable', 'ilike', "%{$request->search}%")
                        ->orWhere('codigo_vivienda',  'ilike', "%{$request->search}%");
                })
            )
            ->orderBy('codigo_vivienda');

        // Lista plana (ya no la usa el buscador de HabitanteForm, que
        // fue eliminado, pero se conserva por si otro módulo la usa)
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
        $datos          = $request->validated();
        $habitantesData = $datos['habitantes'] ?? [];
        unset($datos['habitantes']);

        $familia = DB::transaction(function () use ($datos, $habitantesData) {
            $familia = Familia::create($datos);

            foreach ($habitantesData as $h) {
                if (empty($h['es_discapacitado'])) {
                    $h['tipo_discapacidad'] = null;
                }
                $h['familia_id'] = $familia->id;
                Habitante::create($h);
            }

            return $familia;
        });

        // Cargar relaciones para la respuesta — evita N+1 en el Resource
        $familia->load(['sede', 'calle', 'habitantes']);

        return response()->json([
            'message' => 'Familia y habitantes registrados correctamente.',
            'data'    => new FamiliaResource($familia),
        ], 201); // 201 Created — estándar REST para recursos nuevos
    }

    // ─────────────────────────────────────────────────────────────
    //  GET /api/v1/familias/{familia}
    // ─────────────────────────────────────────────────────────────
    /**
     * Perfil completo de una familia, incluyendo sus habitantes —
     * usado tanto para el perfil de consulta como para precargar
     * el modal de edición en FamiliaList.jsx.
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
            $datos          = $request->validated();
            $habitantesData = $datos['habitantes'] ?? null;
            unset($datos['habitantes']);

            DB::transaction(function () use ($datos, $habitantesData, $familia) {
                $familia->update($datos);

                // Si el payload no trae la clave 'habitantes' en absoluto,
                // no se toca el padrón de esta familia — permite mandar
                // solo los datos de la vivienda sin reenviar habitantes.
                if ($habitantesData === null) {
                    return;
                }

                $idsEnviados = collect($habitantesData)->pluck('id')->filter()->all();

                // Dar de baja (soft delete) los habitantes que ya NO vienen
                // en el payload — el usuario los quitó desde el formulario.
                // Nota: whereNotIn con array vacío no excluye nada (todos
                // los habitantes actuales se dan de baja), que es lo
                // correcto si el usuario quitó a todos.
                $familia->habitantes()
                    ->whereNotIn('id', $idsEnviados)
                    ->get()
                    ->each(fn (Habitante $h) => $h->delete());

                foreach ($habitantesData as $h) {
                    if (empty($h['es_discapacitado'])) {
                        $h['tipo_discapacidad'] = null;
                    }

                    if (!empty($h['id'])) {
                        // Habitante existente — actualizar. UpdateFamiliaRequest
                        // ya verificó que este id pertenece a esta familia.
                        $familia->habitantes()
                            ->where('id', $h['id'])
                            ->update(collect($h)->except('id')->all());
                    } else {
                        // Habitante nuevo agregado durante la edición
                        $h['familia_id'] = $familia->id;
                        Habitante::create($h);
                    }
                }
            });

            // Recargar relaciones para devolver la fila completa al frontend
            $familia->load(['sede', 'calle', 'habitantes']);

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

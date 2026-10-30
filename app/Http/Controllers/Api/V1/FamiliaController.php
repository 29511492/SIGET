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
 *
 *  MANDATOS DE VOCERO (oct-2026, pendiente 14.8-I.2):
 *  Dar de baja a un habitante cierra sus mandatos de vocero
 *  activos. La regla vive en Habitante::cerrarMandatosActivos(),
 *  disparada por el evento `deleted` del modelo, así que update()
 *  la aplica sola (usa $h->delete() por modelo). destroy() la
 *  refuerza de forma explícita porque no depende de cómo cascadee
 *  Familia::booted().
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

        // Corrección 3 (sept-2026): tope de per_page — sin esto,
        // ?per_page=999999 permite extraer todo el censo en una sola
        // petición (persistencia/robustez, backlog 11.2).
        $porPagina = min(max((int) ($request->per_page ?? 20), 1), 50);

        return FamiliaResource::collection(
            $query->paginate($porPagina)
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
                $this->crearHabitante($h, $familia->id);
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
                //
                // Oct-2026: cada $h->delete() dispara el evento `deleted`
                // de Habitante, que cierra sus mandatos de vocero activos
                // dentro de esta misma transacción.
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
                        $this->crearHabitante($h, $familia->id);
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
            // Corrección 3 (sept-2026): el log ya NO guarda 'datos' —
            // antes incluía validated() completo (nombres, cédulas de
            // toda la familia) en texto plano en laravel.log. El
            // family_id ya es suficiente para ubicar el registro en la
            // BD si hace falta investigar el error.
            Log::error('Error al actualizar familia', [
                'familia_id' => $familia->id,
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
    //  Helper — crear un habitante nuevo dentro de una familia
    // ─────────────────────────────────────────────────────────────
    /**
     * Corrección 3 (sept-2026, backlog 11.2: "cédula duplicada tras
     * dar de baja a un habitante"): antes, dar de baja a un habitante
     * y luego intentar registrar a otro (o al mismo) con esa cédula
     * chocaba contra el índice único de la BD, porque el soft delete
     * no libera la cédula.
     *
     * Ahora: si existe un habitante DADO DE BAJA con esa misma
     * cédula, se restaura ese registro con los datos nuevos en vez
     * de crear uno nuevo — incluyendo reasignarlo a esta familia
     * (la persona pudo haberse mudado a otro núcleo familiar). Si no
     * hay ningún habitante de baja con esa cédula, se crea uno nuevo
     * como antes.
     *
     * Restaurar al habitante NO reactiva sus mandatos de vocero
     * cerrados al darlo de baja (oct-2026): si vuelve a ser vocero,
     * se registra un mandato nuevo desde el módulo de Voceros.
     *
     * StoreFamiliaRequest y UpdateFamiliaRequest ya validan la
     * cédula ignorando los registros dados de baja (whereNull
     * deleted_at), así que esta cédula puede llegar aquí sin haber
     * sido rechazada por la validación.
     */
    private function crearHabitante(array $datos, int $familiaId): Habitante
    {
        $datos['familia_id'] = $familiaId;
        $cedula = $datos['cedula'] ?? null;

        if ($cedula) {
            $habitanteDeBaja = Habitante::onlyTrashed()
                ->where('cedula', $cedula)
                ->first();

            if ($habitanteDeBaja) {
                $habitanteDeBaja->restore();
                $habitanteDeBaja->update($datos);

                return $habitanteDeBaja->fresh();
            }
        }

        return Habitante::create($datos);
    }

    // ─────────────────────────────────────────────────────────────
    //  DELETE /api/v1/familias/{familia}
    // ─────────────────────────────────────────────────────────────
    /**
     * Da de baja la familia (soft delete). Oct-2026: además, cierra
     * los mandatos de vocero activos de TODOS sus habitantes.
     *
     * Se hace de forma explícita y no solo por el evento `deleted`
     * de Habitante, porque la cascada Familia → habitantes puede
     * ejecutarse como UPDATE/DELETE masivo (que no dispara eventos
     * de modelo). cerrarMandatosActivos() es idempotente: si el
     * evento ya los cerró, aquí no encuentra nada que cerrar.
     * withTrashed() incluye a los habitantes recién dados de baja
     * por la cascada.
     */
    public function destroy(Familia $familia): JsonResponse
    {
        DB::transaction(function () use ($familia) {
            $familia->delete();

            Habitante::withTrashed()
                ->where('familia_id', $familia->id)
                ->get()
                ->each(fn (Habitante $h) => $h->cerrarMandatosActivos());
        });

        return response()->json([
            'message' => 'Familia eliminada correctamente.',
        ], 200);
    }
}

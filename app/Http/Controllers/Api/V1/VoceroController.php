<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vocero\StoreVoceroRequest;
use App\Http\Requests\Vocero\UpdateVoceroRequest;
use App\Http\Resources\VoceroResource;
use App\Models\Comite;
use App\Models\Encuesta;
use App\Models\EncuestaRespuesta;
use App\Models\Familia;
use App\Models\Habitante;
use App\Models\PagoQr;
use App\Models\Sede;
use App\Models\Vocero;
use App\Services\EstimadorConsumoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Log;

/**
 * ═══════════════════════════════════════════════════════════════
 *  VoceroController — CRUD completo del módulo de voceros
 * ───────────────────────────────────────────────────────────────
 *  RUTAS:
 *  GET    /api/v1/voceros/form-data  → getFormData() [lectura]
 *  GET    /api/v1/voceros            → index()        [lectura]
 *  POST   /api/v1/voceros            → store()        [admin+operador]
 *  GET    /api/v1/voceros/{id}       → show()         [lectura]
 *  PUT    /api/v1/voceros/{id}       → update()       [admin+operador]
 *  DELETE /api/v1/voceros/{id}       → destroy()      [solo admin]
 *  GET    /api/v1/vocero/resumen     → resumen()      [solo vocero]
 *  GET    /api/v1/vocero/tareas      → tareas()       [solo vocero]
 *
 *  NOTA SOBRE ORDEN DE RUTAS:
 *  La ruta GET voceros/form-data DEBE registrarse ANTES que
 *  GET voceros/{vocero} en api.php. Si se registra después,
 *  Laravel intentará resolver "form-data" como un ID de vocero
 *  y fallará con 404 o un error de tipo.
 * ═══════════════════════════════════════════════════════════════
 */
class VoceroController extends Controller
{
    // ─────────────────────────────────────────────────────────────
    //  GET /api/v1/voceros/form-data
    // ─────────────────────────────────────────────────────────────
    /**
     * Devuelve todos los datos necesarios para el formulario de
     * registro/edición en UNA SOLA petición HTTP.
     *
     * DECISIÓN ARQUITECTÓNICA — Por qué un endpoint dedicado:
     * El formulario VoceroForm necesita 3 listas: habitantes, sedes
     * y comités. Hacer 3 peticiones separadas al montar el componente
     * crea un "request waterfall" que aumenta el tiempo de carga.
     * Con un endpoint que devuelve las 3 listas juntas, React hace
     * una sola petición y renderiza el formulario completo de inmediato.
     *
     * Patrón: Backend for Frontend (BFF) — el endpoint está diseñado
     * específicamente para las necesidades de la UI, no para un CRUD genérico.
     */
    public function getFormData(): JsonResponse
    {
        return response()->json([
            'data' => [
                'habitantes' => Habitante::select('id', 'nombres', 'apellidos', 'cedula')
                    ->whereNull('deleted_at')
                    ->orderBy('apellidos')
                    ->orderBy('nombres')
                    ->get()
                    ->map(fn ($h) => [
                        'id'     => $h->id,
                        'label'  => "{$h->apellidos}, {$h->nombres}" .
                                    ($h->cedula ? " — {$h->cedula}" : ''),
                    ]),

                'sedes' => Sede::select('id', 'nombre', 'tipo_sede')
                    ->whereNull('deleted_at')
                    ->orderBy('nombre')
                    ->get()
                    ->map(fn ($s) => [
                        'id'    => $s->id,
                        'label' => $s->nombre,
                    ]),

                'comites' => Comite::select('id', 'nombre')
                    ->orderBy('nombre')
                    ->get()
                    ->map(fn ($c) => [
                        'id'    => $c->id,
                        'label' => $c->nombre,
                    ]),
            ],
        ], 200);
    }

    // ─────────────────────────────────────────────────────────────
    //  GET /api/v1/voceros
    // ─────────────────────────────────────────────────────────────
    /**
     * Lista paginada con eager loading de las 3 relaciones.
     * with(['habitante','sede','comite']) resuelve todo en 4 queries
     * (1 principal + 1 por relación) en vez de N queries por fila.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Vocero::with(['habitante', 'sede', 'comite'])
            ->when($request->search, fn ($q) =>
                $q->whereHas('habitante', fn ($h) =>
                    $h->where('nombres',    'ilike', "%{$request->search}%")
                    ->orWhere('apellidos','ilike', "%{$request->search}%")
                    ->orWhere('cedula',   'ilike', "%{$request->search}%")
                )
            )
            ->when($request->sede_id, fn ($q) =>
                $q->where('sede_id', $request->sede_id)
            )
            ->when($request->has('activo'), fn ($q) =>
                $q->where('esta_activo', $request->boolean('activo'))
            )
            ->orderByDesc('esta_activo') // Activos primero
            ->orderBy('created_at');

        return VoceroResource::collection(
            $query->paginate($request->integer('per_page', 10))
        );
    }

    // ─────────────────────────────────────────────────────────────
    //  POST /api/v1/voceros
    // ─────────────────────────────────────────────────────────────
    public function store(StoreVoceroRequest $request): JsonResponse
    {
        $vocero = Vocero::create($request->validated());
        $vocero->load(['habitante', 'sede', 'comite']);

        return response()->json([
            'message' => 'Vocero registrado correctamente.',
            'data'    => new VoceroResource($vocero),
        ], 201);
    }

    // ─────────────────────────────────────────────────────────────
    //  GET /api/v1/voceros/{vocero}
    // ─────────────────────────────────────────────────────────────
    public function show(Vocero $vocero): JsonResponse
    {
        $vocero->load(['habitante', 'sede', 'comite']);

        return response()->json([
            'data' => new VoceroResource($vocero),
        ], 200);
    }

    // ─────────────────────────────────────────────────────────────
    //  PUT /api/v1/voceros/{vocero}
    // ─────────────────────────────────────────────────────────────
    public function update(UpdateVoceroRequest $request, Vocero $vocero): JsonResponse
    {
        try {
            $vocero->update($request->validated());
            $vocero->load(['habitante', 'sede', 'comite']);

            return response()->json([
                'message' => 'Vocero actualizado correctamente.',
                'data'    => new VoceroResource($vocero),
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error al actualizar vocero', [
                'vocero_id' => $vocero->id,
                'error'     => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Error interno al actualizar el vocero.',
                'errors'  => [],
            ], 500);
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  DELETE /api/v1/voceros/{vocero}
    // ─────────────────────────────────────────────────────────────
    /**
     * DECISIÓN — Desactivar vs Eliminar:
     * Los voceros no se eliminan físicamente. Un vocero que termina
     * su mandato se desactiva (esta_activo = false) para conservar
     * el registro histórico. La eliminación física solo aplica en
     * casos de error de carga (admin).
     *
     * Por eso destroy() hace soft-logic (cambia esta_activo a false)
     * en vez de DELETE físico. Solo en el 100% necesario (error de
     * carga) el admin podría eliminarlo desde un endpoint separado.
     */
    public function destroy(Vocero $vocero): JsonResponse
    {
        $nombre = $vocero->habitante?->nombres . ' ' . $vocero->habitante?->apellidos;

        // Desactivar en vez de eliminar — preserva el historial
        $vocero->update(['esta_activo' => false, 'fecha_fin' => now()->toDateString()]);

        return response()->json([
            'message' => "{$nombre} fue dado de baja como vocero activo.",
        ], 200);
    }

    // ─────────────────────────────────────────────────────────────
    //  Dashboard del vocero (oct-2026) — resumen() y tareas()
    // ─────────────────────────────────────────────────────────────
    /**
     * VoceroDashboard.jsx llama a GET /v1/vocero/resumen y /v1/vocero/tareas,
     * pero ninguna de las dos existía (404). El contrato de respuesta sale
     * de lo que ese componente consume:
     *   resumen → { nombre_sede, familias_sector, habitantes_sector, pagos_pendientes }
     *   tareas  → [ { id, titulo, descripcion, estado, fecha_limite } ]
     *
     * Solo devuelve CONTEOS agregados de las sedes donde el usuario tiene
     * un mandato activo: nunca nombres ni datos de familias (restricción del
     * profesor: el vocero no accede al censo).
     */
    public function resumen(Request $request): JsonResponse
    {
        $sedes = $this->sedesDelVocero($request);

        $familiasDelSector = Familia::whereIn('sede_id', $sedes);

        return response()->json([
            'data' => [
                'nombre_sede'       => Sede::whereIn('id', $sedes)->orderBy('nombre')->pluck('nombre')->implode(', '),
                'familias_sector'   => (clone $familiasDelSector)->count(),
                // Subconsulta sobre familias vigentes: una familia dada de baja
                // no aporta habitantes al conteo.
                'habitantes_sector' => Habitante::whereIn('familia_id', (clone $familiasDelSector)->select('id'))->count(),
                // Mismo universo que ve el vocero en el módulo Pagos QR
                'pagos_pendientes'  => PagoQr::where('estado', 'pendiente')->count(),
            ],
        ], 200);
    }

    /**
     * Tareas de censo pendientes: una por cada encuesta ACTIVA que todavía
     * tiene familias por atender en las sedes del vocero. Las encuestas
     * ya completadas no se listan (la UI muestra "no tienes tareas").
     *
     * Estados (los que entiende ESTADO_CONFIG en VoceroDashboard.jsx):
     *  - Encuesta de gas: critico (hay gas vencido) · en_progreso (hay por
     *    vencer) · pendiente (solo falta historial para estimar).
     *  - Otras encuestas: critico (≥ 50 % de familias sin entrega) ·
     *    en_progreso (menos del 50 %).
     */
    public function tareas(Request $request, EstimadorConsumoService $estimador): JsonResponse
    {
        $sedes      = $this->sedesDelVocero($request);
        $familiaIds = Familia::whereIn('sede_id', $sedes)->pluck('id');
        $total      = $familiaIds->count();

        if ($total === 0) {
            return response()->json(['data' => []], 200);
        }

        $tareas = [];

        foreach (Encuesta::activas()->orderBy('fecha_cierre')->orderBy('id')->get() as $encuesta) {
            if ($encuesta->esDeGas()) {
                $conteo   = $estimador->estimarPorFamilias($familiaIds, $encuesta->tipo)->countBy('estado');
                $vencidas = (int) ($conteo['vencido'] ?? 0);
                $proximas = (int) ($conteo['proximo'] ?? 0);
                $sinDatos = (int) ($conteo['sin_datos'] ?? 0);

                if ($vencidas + $proximas + $sinDatos === 0) {
                    continue; // todas al día
                }

                $estado = match (true) {
                    $vencidas > 0 => 'critico',
                    $proximas > 0 => 'en_progreso',
                    default       => 'pendiente',
                };

                $descripcion = "{$vencidas} familia(s) con gas vencido, {$proximas} por vencer y {$sinDatos} sin historial suficiente (de {$total}).";
            } else {
                $conRespuesta = EncuestaRespuesta::where('encuesta_id', $encuesta->id)
                    ->whereIn('familia_id', $familiaIds)
                    ->distinct()
                    ->count('familia_id');

                $pendientes = $total - $conRespuesta;

                if ($pendientes <= 0) {
                    continue; // cobertura completa
                }

                $estado      = ($pendientes / $total) >= 0.5 ? 'critico' : 'en_progreso';
                $descripcion = "{$pendientes} de {$total} familias todavía sin entrega registrada.";
            }

            $tareas[] = [
                'id'           => $encuesta->id,
                'titulo'       => $encuesta->nombre,
                'descripcion'  => $descripcion,
                'estado'       => $estado,
                'fecha_limite' => $encuesta->fecha_cierre?->toDateString(),
            ];
        }

        return response()->json(['data' => $tareas], 200);
    }

    /**
     * Sedes donde el usuario autenticado tiene un mandato de vocero ACTIVO.
     * Un habitante puede tener varios registros (uno por mandato), por eso
     * se usa el scope activos() y se devuelven todas sus sedes, no solo la
     * primera. Sin mandato activo (o sin habitante vinculado) → 403.
     *
     * @return array<int, int>
     */
    private function sedesDelVocero(Request $request): array
    {
        $habitanteId = $request->user()->habitante_id;

        $sedes = $habitanteId
            ? Vocero::activos()->where('habitante_id', $habitanteId)->pluck('sede_id')->unique()->values()->all()
            : [];

        if ($sedes === []) {
            abort(403, 'No se encontró un registro de vocero activo asociado a este usuario.');
        }

        return array_map('intval', $sedes);
    }
}

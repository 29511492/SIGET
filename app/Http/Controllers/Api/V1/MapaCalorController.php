<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Calle;
use App\Models\Encuesta;
use App\Models\Familia;
use App\Models\Sede;
use App\Models\Vocero;
use App\Services\EstimadorConsumoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

/**
 * ═══════════════════════════════════════════════════════════════
 *  MapaCalorController — Agregado por calle para una encuesta
 * ───────────────────────────────────────────────────────────────
 *  GET /api/v1/mapa-calor?encuesta_id=X                  → index()
 *  GET /api/v1/mapa-calor/calle/{calle}?encuesta_id=X    → detalleCalle()
 *
 *  Alcance por rol (las rutas ya filtran a admin + vocero):
 *  - admin:  todas las calles; el detalle incluye cada familia.
 *  - vocero: solo las calles de las sedes donde tiene un mandato
 *            ACTIVO, y SOLO CONTEOS agregados — nunca nombres de
 *            familias (restricción del profesor: el vocero no
 *            accede a los datos del censo).
 *
 *  Modo de cálculo según el tipo de encuesta (Encuesta::modo()):
 *  - bombona_gas         → predicción de agotamiento (EstimadorConsumoService)
 *  - agua                → estado del servicio (último estado registrado por familia)
 *  - condicion_vivienda  → condición de vivienda tomada del censo (sin respuestas)
 *  - pago_servicio       → pagos de un servicio en un período (sin respuestas)
 *  - otros               → cobertura simple (familias con entrega / total)
 *
 *  Sin caché: el mapa refleja siempre el estado real. Los cálculos
 *  se resuelven con un número fijo de consultas (ver el servicio).
 *
 *  riesgo: 0 = bien · 1 = atención · 2 = crítico · null = sin datos
 * ═══════════════════════════════════════════════════════════════
 */
class MapaCalorController extends Controller
{
    public function __construct(private EstimadorConsumoService $estimador)
    {
    }

    // ─────────────────────────────────────────────────────────────
    //  GET /api/v1/mapa-calor
    // ─────────────────────────────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $encuesta = $this->encuestaValidada($request);
        $sedes    = $this->sedesPermitidas($request); // null = todas

        $calles = Calle::query()
            ->with('sede:id,nombre')
            ->when($sedes !== null, fn ($q) => $q->whereIn('sede_id', $sedes))
            ->orderBy('sede_id')
            ->orderBy('nombre')
            ->get(['id', 'nombre', 'sede_id', 'latitud', 'longitud']);

        $calleIds = $calles->pluck('id')->map(fn ($id) => (int) $id)->all();

        $resumenes = $this->resumenesPorCalle($encuesta, $calleIds);

        $data = $calles->map(fn (Calle $calle) => array_merge([
            'calle_id' => $calle->id,
            'calle'    => $calle->nombre,
            'sede'     => $calle->sede?->nombre,
            'latitud'  => $calle->latitud,
            'longitud' => $calle->longitud,
        ], $resumenes[$calle->id]))->values();

        return response()->json([
            'message' => 'Mapa de calor generado correctamente.',
            'data'    => $data,
            'sedes'   => $this->sedesInvolucradas($calles->pluck('sede_id')->unique()->all()),
            // Pagos del período que no se pudieron asignar a una familia (solo
            // administrador: para el vocero sería una cifra global de todas las sedes)
            'pagos_sin_familia' => ($encuesta->modo() === Encuesta::MODO_PAGO && $request->user()->esAdmin())
                ? $this->estimador->pagosPorFamiliaDelPeriodo($encuesta)['sin_asignar']
                : null,
            'modo'    => $encuesta->modo(),
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    //  GET /api/v1/mapa-calor/calle/{calle}
    // ─────────────────────────────────────────────────────────────
    /**
     * Detalle de una calle al hacer clic en el mapa.
     *
     * Si la calle no pertenece a las sedes del vocero se rechaza con 403
     * en vez de filtrar en silencio. El vocero recibe solo el resumen
     * (conteos); `familias` es null para él.
     */
    public function detalleCalle(Request $request, Calle $calle): JsonResponse
    {
        $encuesta = $this->encuestaValidada($request);
        $sedes    = $this->sedesPermitidas($request);

        if ($sedes !== null && ! in_array((int) $calle->sede_id, $sedes, true)) {
            abort(403, 'No tiene acceso a esta calle.');
        }

        $esAdmin  = $request->user()->esAdmin();
        $familias = Familia::query()
            ->where('calle_id', $calle->id)
            ->orderBy('codigo_vivienda')
            ->get(['id', 'nombre_responsable', 'codigo_vivienda', 'condicion_vivienda']);

        $ids = $familias->pluck('id')->map(fn ($id) => (int) $id);

        [$resumen, $detalle] = match ($encuesta->modo()) {
            Encuesta::MODO_AGOTAMIENTO => $this->detalleAgotamiento($encuesta, $familias, $ids, $esAdmin),
            Encuesta::MODO_ESTADO      => $this->detalleEstado($encuesta, $familias, $ids, $esAdmin),
            Encuesta::MODO_VIVIENDA    => $this->detalleVivienda($familias, $esAdmin),
            Encuesta::MODO_PAGO        => $this->detallePago($encuesta, $familias, $esAdmin),
            default                    => $this->detalleCobertura($encuesta, $familias, $ids, $esAdmin),
        };

        return response()->json([
            'message' => 'Detalle de calle obtenido correctamente.',
            'data'    => [
                'calle'          => $calle->nombre,
                'sede'           => $calle->sede?->nombre,
                'total_familias' => $familias->count(),
                'resumen'        => $resumen,
                'familias'       => $detalle,
            ],
            'modo'    => $encuesta->modo(),
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    //  Helpers privados
    // ─────────────────────────────────────────────────────────────

    /**
     * Resumen por calle según el modo de la encuesta. Cada modo trae su propio
     * conteo, pero todos incluyen total_familias y riesgo (0, 1, 2 o null).
     *
     * @param  array<int,int>  $calleIds
     */
    private function resumenesPorCalle(Encuesta $encuesta, array $calleIds): array
    {
        return match ($encuesta->modo()) {
            Encuesta::MODO_AGOTAMIENTO => $this->estimador->resumenPorCalles($calleIds, $encuesta->tipo),
            Encuesta::MODO_ESTADO      => $this->estimador->resumenEstadoPorCalles($calleIds, $encuesta->id),
            Encuesta::MODO_VIVIENDA    => $this->estimador->resumenViviendaPorCalles($calleIds),
            Encuesta::MODO_PAGO        => $this->estimador->resumenPagoPorCalles($calleIds, $encuesta),
            default                    => $this->estimador->resumenCoberturaPorCalles($calleIds, $encuesta->id),
        };
    }

    // Los cuatro detalle*() devuelven [resumen, detalle]. `detalle` (una fila por
    // familia, con nombres) solo se arma para el admin; el vocero recibe null.

    /** @return array{0:array<string,int>,1:Collection|null} */
    private function detalleAgotamiento(Encuesta $encuesta, Collection $familias, Collection $ids, bool $esAdmin): array
    {
        $estimaciones = $this->estimador->estimarPorFamilias($ids, $encuesta->tipo);
        $conteo       = $estimaciones->countBy('estado');

        $resumen = [
            'sin_datos' => (int) ($conteo['sin_datos'] ?? 0),
            'al_dia'    => (int) ($conteo['al_dia'] ?? 0),
            'proximo'   => (int) ($conteo['proximo'] ?? 0),
            'vencido'   => (int) ($conteo['vencido'] ?? 0),
        ];

        $detalle = $esAdmin
            ? $familias->map(fn (Familia $f) => array_merge(
                ['responsable' => $f->nombre_responsable, 'codigo_vivienda' => $f->codigo_vivienda],
                $estimaciones[(int) $f->id]
            ))->values()
            : null;

        return [$resumen, $detalle];
    }

    /** @return array{0:array<string,int>,1:Collection|null} */
    private function detalleCobertura(Encuesta $encuesta, Collection $familias, Collection $ids, bool $esAdmin): array
    {
        $ultimas      = $this->estimador->ultimaEntregaPorFamilia($ids, $encuesta->id);
        $conRespuesta = $ids->filter(fn ($id) => $ultimas->has($id))->count();

        $resumen = [
            'con_respuesta' => $conRespuesta,
            'pendientes'    => $ids->count() - $conRespuesta,
        ];

        $detalle = $esAdmin
            ? $familias->map(fn (Familia $f) => [
                'familia_id'      => $f->id,
                'responsable'     => $f->nombre_responsable,
                'codigo_vivienda' => $f->codigo_vivienda,
                'recibio'         => $ultimas->has((int) $f->id),
                'ultima_entrega'  => $ultimas->get((int) $f->id),
            ])->values()
            : null;

        return [$resumen, $detalle];
    }

    /** @return array{0:array<string,int>,1:Collection|null} */
    private function detalleEstado(Encuesta $encuesta, Collection $familias, Collection $ids, bool $esAdmin): array
    {
        $ultimos = $this->estimador->ultimoEstadoPorFamilia($ids, $encuesta->id);
        $resumen = array_fill_keys(Encuesta::ESTADOS_AGUA, 0) + ['sin_datos' => 0];

        foreach ($ids as $id) {
            $estado = $ultimos->get($id)['estado'] ?? 'sin_datos';
            $resumen[array_key_exists($estado, $resumen) ? $estado : 'sin_datos']++;
        }

        $detalle = $esAdmin
            ? $familias->map(fn (Familia $f) => [
                'familia_id'      => $f->id,
                'responsable'     => $f->nombre_responsable,
                'codigo_vivienda' => $f->codigo_vivienda,
                'estado'          => $ultimos->get((int) $f->id)['estado'] ?? 'sin_datos',
                'ultima_entrega'  => $ultimos->get((int) $f->id)['fecha'] ?? null,
            ])->values()
            : null;

        return [$resumen, $detalle];
    }

    /** @return array{0:array<string,int>,1:Collection|null} */
    private function detalleVivienda(Collection $familias, bool $esAdmin): array
    {
        $conteo = $familias->countBy('condicion_vivienda');

        $resumen = [
            'optima'  => (int) ($conteo['optima'] ?? 0),
            'regular' => (int) ($conteo['regular'] ?? 0),
            'critica' => (int) ($conteo['critica'] ?? 0),
        ];

        $detalle = $esAdmin
            ? $familias->map(fn (Familia $f) => [
                'familia_id'      => $f->id,
                'responsable'     => $f->nombre_responsable,
                'codigo_vivienda' => $f->codigo_vivienda,
                'condicion'       => $f->condicion_vivienda,
            ])->values()
            : null;

        return [$resumen, $detalle];
    }

    /** @return array{0:array<string,int>,1:Collection|null} */
    private function detallePago(Encuesta $encuesta, Collection $familias, bool $esAdmin): array
    {
        $porFamilia = $this->estimador->pagosPorFamiliaDelPeriodo($encuesta)['porFamilia'];
        $resumen    = ['pagado' => 0, 'en_revision' => 0, 'sin_pago' => 0];

        foreach ($familias as $familia) {
            $estado = $porFamilia->get((int) $familia->id)['estado'] ?? 'sin_pago';
            $resumen[$estado]++;
        }

        $detalle = $esAdmin
            ? $familias->map(fn (Familia $f) => [
                'familia_id'      => $f->id,
                'responsable'     => $f->nombre_responsable,
                'codigo_vivienda' => $f->codigo_vivienda,
                'estado'          => $porFamilia->get((int) $f->id)['estado'] ?? 'sin_pago',
                'ultimo_pago'     => $porFamilia->get((int) $f->id)['fecha'] ?? null,
            ])->values()
            : null;

        return [$resumen, $detalle];
    }

    /** Valida encuesta_id (la encuesta no debe estar dada de baja) y devuelve el modelo. */
    private function encuestaValidada(Request $request): Encuesta
    {
        $request->validate([
            'encuesta_id' => ['required', 'integer', Rule::exists('encuestas', 'id')->whereNull('deleted_at')],
        ]);

        return Encuesta::findOrFail((int) $request->input('encuesta_id'));
    }

    /**
     * Sedes a las que el usuario puede acceder.
     *  - admin  → null (todas)
     *  - vocero → ids de las sedes de sus mandatos ACTIVOS (un habitante puede
     *             tener varios registros, uno por mandato)
     *  - otro rol, o vocero sin mandato activo → 403
     *
     * @return array<int,int>|null
     */
    private function sedesPermitidas(Request $request): ?array
    {
        $user = $request->user();

        if ($user->esAdmin()) {
            return null;
        }

        if ($user->rol !== 'vocero') {
            abort(403, 'No tiene acceso a esta información.');
        }

        $sedes = $user->habitante_id
            ? Vocero::activos()->where('habitante_id', $user->habitante_id)->pluck('sede_id')->unique()->values()->all()
            : [];

        if ($sedes === []) {
            abort(403, 'No se encontró un registro de vocero activo asociado a este usuario.');
        }

        return array_map('intval', $sedes);
    }

    /**
     * id, nombre y polígono (limites) de las sedes presentes en el resultado,
     * para que el frontend dibuje el contorno del territorio si existe.
     *
     * @param  array<int,int>  $sedeIds
     */
    private function sedesInvolucradas(array $sedeIds): array
    {
        if ($sedeIds === []) {
            return [];
        }

        return Sede::query()
            ->whereIn('id', $sedeIds)
            ->orderBy('nombre')
            ->get(['id', 'nombre', 'limites'])
            ->toArray();
    }
}

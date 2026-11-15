<?php

namespace App\Services;

use App\Models\Encuesta;
use App\Models\EncuestaRespuesta;
use App\Models\Familia;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * ═══════════════════════════════════════════════════════════════
 *  EstimadorConsumoService
 * ───────────────────────────────────────────────────────────────
 *  Para cada familia calcula el promedio de días entre entregas
 *  registradas de un tipo (normalmente 'bombona_gas') y proyecta la
 *  fecha en que se le agotará la próxima, para anticipar el
 *  desabastecimiento.
 *
 *  Requiere al menos 2 FECHAS DISTINTAS de entrega; con menos
 *  devuelve 'sin_datos' (no hay base para proyectar y no se
 *  inventa una fecha). Varias entregas el mismo día cuentan como una.
 *
 *  REESCRITURA (oct-2026): la versión original hacía una consulta
 *  por familia y el mapa recorre todas las calles → miles de
 *  consultas por carga. Ahora cada operación pública resuelve el
 *  cálculo con un número FIJO de consultas (familias + entregas),
 *  sin importar cuántas calles o familias haya.
 *
 *  Las diferencias de días se calculan con timestamps (no con
 *  Carbon::diffInDays) para que el resultado no dependa de la
 *  versión de Carbon (en Carbon 3 devuelve float y con signo).
 *
 *  AMPLIACIÓN (nov-2026): además de la predicción de agotamiento (gas) y la
 *  cobertura (CLAP, combo, otros), el servicio resume por calle el ESTADO del
 *  servicio de agua (último estado registrado de cada familia) y la CONDICIÓN
 *  DE VIVIENDA tomada del censo. Todos devuelven el mismo riesgo
 *  (0 = bien, 1 = atención, 2 = crítico, null = sin datos) para que el mapa
 *  los pinte igual.
 * ═══════════════════════════════════════════════════════════════
 */
class EstimadorConsumoService
{
    public const DIAS_ALERTA_PROXIMO = 7;

    /**
     * Umbrales del mapa de condición de vivienda (proporción de familias de la calle):
     *  - crítico (2):  al menos 30 % de viviendas en condición crítica
     *  - atención (1): alguna vivienda crítica, o al menos la mitad en condición regular
     *  - bien (0):     el resto
     */
    public const UMBRAL_VIVIENDA_CRITICAS  = 0.30;
    public const UMBRAL_VIVIENDA_REGULARES = 0.50;

    private const SEGUNDOS_POR_DIA = 86400;

    // ─────────────────────────────────────────────────────────────
    //  Familias — predicción de agotamiento
    // ─────────────────────────────────────────────────────────────

    /**
     * Estima el consumo de varias familias con UNA sola consulta de entregas.
     *
     * @param  array<int,int>|Collection  $familiaIds
     * @return Collection  indexada por familia_id; cada valor es el arreglo de estimar()
     */
    public function estimarPorFamilias(array|Collection $familiaIds, string $tipo = Encuesta::TIPO_GAS): Collection
    {
        $ids = collect($familiaIds)->map(fn ($id) => (int) $id)->unique()->values();

        if ($ids->isEmpty()) {
            return collect();
        }

        $fechasPorFamilia = EncuestaRespuesta::query()
            ->whereIn('familia_id', $ids->all())
            ->whereHas('encuesta', fn ($q) => $q->where('tipo', $tipo))
            ->orderBy('fecha_entrega')
            ->get(['familia_id', 'fecha_entrega'])
            ->groupBy('familia_id');

        return $ids->mapWithKeys(fn (int $id) => [
            $id => $this->estimar($id, ($fechasPorFamilia->get($id) ?? collect())->pluck('fecha_entrega')),
        ]);
    }

    /**
     * Agrega la estimación de cada calle. Una consulta de familias + una de entregas.
     *
     * @param  array<int,int>  $calleIds
     * @return array<int,array{total_familias:int,conteo:array<string,int>,riesgo:int|null}>
     */
    public function resumenPorCalles(array $calleIds, string $tipo = Encuesta::TIPO_GAS): array
    {
        $familiasPorCalle = $this->familiasAgrupadasPorCalle($calleIds);
        $estimaciones     = $this->estimarPorFamilias($familiasPorCalle->flatten(), $tipo);

        $resultado = [];

        foreach ($calleIds as $calleId) {
            $ids    = $familiasPorCalle->get($calleId) ?? collect();
            $conteo = ['sin_datos' => 0, 'al_dia' => 0, 'proximo' => 0, 'vencido' => 0];

            foreach ($ids as $familiaId) {
                $conteo[$estimaciones[$familiaId]['estado']]++;
            }

            $resultado[$calleId] = [
                'total_familias' => $ids->count(),
                'conteo'         => $conteo,
                'riesgo'         => $this->riesgoDesdeConteo($conteo, $ids->count()),
            ];
        }

        return $resultado;
    }

    // ─────────────────────────────────────────────────────────────
    //  Familias — cobertura simple (CLAP y otros tipos)
    // ─────────────────────────────────────────────────────────────

    /**
     * Cobertura por calle: familias con al menos una entrega en la encuesta
     * frente al total de la calle.
     *
     * @param  array<int,int>  $calleIds
     * @return array<int,array{total_familias:int,familias_con_respuesta:int,familias_pendientes:int,riesgo:int|null}>
     */
    public function resumenCoberturaPorCalles(array $calleIds, int $encuestaId): array
    {
        $familiasPorCalle = $this->familiasAgrupadasPorCalle($calleIds);
        $todas            = $familiasPorCalle->flatten()->all();

        $conRespuesta = $todas === []
            ? collect()
            : EncuestaRespuesta::query()
                ->where('encuesta_id', $encuestaId)
                ->whereIn('familia_id', $todas)
                ->distinct()
                ->pluck('familia_id')
                ->flip(); // las claves pasan a ser los familia_id (búsqueda O(1))

        $resultado = [];

        foreach ($calleIds as $calleId) {
            $ids        = $familiasPorCalle->get($calleId) ?? collect();
            $total      = $ids->count();
            $cubiertas  = $ids->filter(fn ($id) => $conRespuesta->has($id))->count();
            $pendientes = $total - $cubiertas;

            // null = calle sin familias (no hay nada que medir)
            // 0 = todas cubiertas | 1 = menos de la mitad sin cubrir | 2 = mitad o más sin cubrir
            $riesgo = match (true) {
                $total === 0                  => null,
                $pendientes === 0             => 0,
                ($pendientes / $total) < 0.5  => 1,
                default                       => 2,
            };

            $resultado[$calleId] = [
                'total_familias'         => $total,
                'familias_con_respuesta' => $cubiertas,
                'familias_pendientes'    => $pendientes,
                'riesgo'                 => $riesgo,
            ];
        }

        return $resultado;
    }

    /**
     * Fecha de la última entrega de cada familia en una encuesta (detalle de calle).
     *
     * @param  array<int,int>|Collection  $familiaIds
     * @return Collection  familia_id => 'Y-m-d'
     */
    public function ultimaEntregaPorFamilia(array|Collection $familiaIds, int $encuestaId): Collection
    {
        $ids = collect($familiaIds)->all();

        if ($ids === []) {
            return collect();
        }

        return EncuestaRespuesta::query()
            ->where('encuesta_id', $encuestaId)
            ->whereIn('familia_id', $ids)
            ->select('familia_id', DB::raw('MAX(fecha_entrega) as ultima'))
            ->groupBy('familia_id')
            ->pluck('ultima', 'familia_id')
            ->map(fn ($fecha) => Carbon::parse($fecha)->toDateString());
    }

    // ─────────────────────────────────────────────────────────────
    //  Familias — estado del servicio (agua)
    // ─────────────────────────────────────────────────────────────

    /**
     * Último estado registrado de cada familia en una encuesta de estado, con
     * UNA sola consulta. Si una familia tiene varios registros vale el de fecha
     * más reciente (a igual fecha, el último creado).
     *
     * @param  array<int,int>|Collection  $familiaIds
     * @return Collection  familia_id => ['estado' => string, 'fecha' => 'Y-m-d'|null]
     */
    public function ultimoEstadoPorFamilia(array|Collection $familiaIds, int $encuestaId): Collection
    {
        $ids = collect($familiaIds)->map(fn ($id) => (int) $id)->unique()->values()->all();

        if ($ids === []) {
            return collect();
        }

        return EncuestaRespuesta::query()
            ->where('encuesta_id', $encuestaId)
            ->whereIn('familia_id', $ids)
            ->whereNotNull('estado')
            ->orderBy('fecha_entrega')
            ->orderBy('id')
            ->get(['familia_id', 'estado', 'fecha_entrega'])
            ->groupBy('familia_id')
            ->map(fn (Collection $filas) => [
                'estado' => $filas->last()->estado,
                'fecha'  => $filas->last()->fecha_entrega?->toDateString(),
            ]);
    }

    /**
     * Estado del servicio por calle (encuestas de agua). Una consulta de familias
     * + una de registros. El color de la calle es el de su peor familia.
     *
     * @param  array<int,int>  $calleIds
     * @return array<int,array{total_familias:int,conteo:array<string,int>,riesgo:int|null}>
     */
    public function resumenEstadoPorCalles(array $calleIds, int $encuestaId): array
    {
        $familiasPorCalle = $this->familiasAgrupadasPorCalle($calleIds);
        $ultimos          = $this->ultimoEstadoPorFamilia($familiasPorCalle->flatten(), $encuestaId);

        $resultado = [];

        foreach ($calleIds as $calleId) {
            $ids    = $familiasPorCalle->get($calleId) ?? collect();
            $conteo = array_fill_keys(Encuesta::ESTADOS_AGUA, 0) + ['sin_datos' => 0];

            foreach ($ids as $familiaId) {
                $estado = $ultimos->get($familiaId)['estado'] ?? 'sin_datos';
                $conteo[array_key_exists($estado, $conteo) ? $estado : 'sin_datos']++;
            }

            $resultado[$calleId] = [
                'total_familias' => $ids->count(),
                'conteo'         => $conteo,
                'riesgo'         => $this->riesgoEstadoServicio($conteo, $ids->count()),
            ];
        }

        return $resultado;
    }

    // ─────────────────────────────────────────────────────────────
    //  Familias — condición de vivienda (del censo)
    // ─────────────────────────────────────────────────────────────

    /**
     * Condición de vivienda por calle, calculada con las familias vigentes del
     * censo (no usa respuestas de encuesta). Una sola consulta.
     *
     * @param  array<int,int>  $calleIds
     * @return array<int,array{total_familias:int,conteo:array<string,int>,riesgo:int|null}>
     */
    public function resumenViviendaPorCalles(array $calleIds): array
    {
        if ($calleIds === []) {
            return [];
        }

        $familiasPorCalle = Familia::query()
            ->whereIn('calle_id', $calleIds)
            ->get(['id', 'calle_id', 'condicion_vivienda'])
            ->groupBy('calle_id');

        $resultado = [];

        foreach ($calleIds as $calleId) {
            $filas  = $familiasPorCalle->get($calleId) ?? collect();
            $conteo = ['optima' => 0, 'regular' => 0, 'critica' => 0];

            foreach ($filas as $familia) {
                if (array_key_exists($familia->condicion_vivienda, $conteo)) {
                    $conteo[$familia->condicion_vivienda]++;
                }
            }

            $resultado[$calleId] = [
                'total_familias' => $filas->count(),
                'conteo'         => $conteo,
                'riesgo'         => $this->riesgoVivienda($conteo, $filas->count()),
            ];
        }

        return $resultado;
    }

    /**
     * Riesgo agregado de una calle para el estado del servicio:
     *  null = sin familias o ninguna con registro (gris, NO verde)
     *  2 = alguna familia sin servicio | 1 = alguna con servicio intermitente | 0 = todas con servicio
     *
     * @param  array<string,int>  $conteo
     */
    private function riesgoEstadoServicio(array $conteo, int $total): ?int
    {
        if ($total === 0 || $conteo['sin_datos'] === $total) {
            return null;
        }

        return match (true) {
            $conteo['no_llega'] > 0      => 2,
            $conteo['intermitente'] > 0  => 1,
            default                      => 0,
        };
    }

    /**
     * Riesgo agregado de una calle para la condición de vivienda (ver los
     * umbrales UMBRAL_VIVIENDA_*). null = calle sin familias.
     *
     * @param  array<string,int>  $conteo
     */
    private function riesgoVivienda(array $conteo, int $total): ?int
    {
        if ($total === 0) {
            return null;
        }

        return match (true) {
            ($conteo['critica'] / $total) >= self::UMBRAL_VIVIENDA_CRITICAS => 2,
            $conteo['critica'] > 0
                || ($conteo['regular'] / $total) >= self::UMBRAL_VIVIENDA_REGULARES => 1,
            default => 0,
        };
    }

    // ─────────────────────────────────────────────────────────────
    //  Cálculo interno
    // ─────────────────────────────────────────────────────────────

    /**
     * @param  Collection  $fechas  fechas de entrega de UNA familia (Carbon o string)
     */
    private function estimar(int $familiaId, Collection $fechas): array
    {
        $dias = $fechas
            ->map(fn ($f) => Carbon::parse($f)->startOfDay())
            ->unique(fn (Carbon $d) => $d->toDateString())
            ->sortBy(fn (Carbon $d) => $d->getTimestamp())
            ->values();

        if ($dias->count() < 2) {
            return [
                'familia_id'                 => $familiaId,
                'estado'                     => 'sin_datos',
                'promedio_dias_duracion'     => null,
                'ultima_entrega'             => $dias->last()?->toDateString(),
                'fecha_estimada_agotamiento' => null,
                'dias_restantes'             => null,
            ];
        }

        $sumaDias = 0;
        for ($i = 1; $i < $dias->count(); $i++) {
            $sumaDias += (int) round(
                ($dias[$i]->getTimestamp() - $dias[$i - 1]->getTimestamp()) / self::SEGUNDOS_POR_DIA
            );
        }

        $promedio      = max(1, (int) round($sumaDias / ($dias->count() - 1)));
        $ultima        = $dias->last();
        $fechaEstimada = $ultima->copy()->addDays($promedio);
        $diasRestantes = (int) round(
            ($fechaEstimada->getTimestamp() - Carbon::today()->getTimestamp()) / self::SEGUNDOS_POR_DIA
        );

        return [
            'familia_id'                 => $familiaId,
            'estado'                     => $this->clasificarEstado($diasRestantes),
            'promedio_dias_duracion'     => $promedio,
            'ultima_entrega'             => $ultima->toDateString(),
            'fecha_estimada_agotamiento' => $fechaEstimada->toDateString(),
            'dias_restantes'             => $diasRestantes,
        ];
    }

    private function clasificarEstado(int $diasRestantes): string
    {
        return match (true) {
            $diasRestantes < 0                          => 'vencido',
            $diasRestantes <= self::DIAS_ALERTA_PROXIMO => 'proximo',
            default                                     => 'al_dia',
        };
    }

    /**
     * Riesgo agregado de una calle para pintarla en el mapa:
     *  null = sin familias o ninguna con datos suficientes (se muestra "sin datos",
     *         NO verde: verde significa "al día", y aquí no se sabe)
     *  2 = hay familias vencidas | 1 = hay próximas a vencer | 0 = todas al día
     *
     * @param  array<string,int>  $conteo
     */
    private function riesgoDesdeConteo(array $conteo, int $total): ?int
    {
        if ($total === 0 || $conteo['sin_datos'] === $total) {
            return null;
        }

        return match (true) {
            $conteo['vencido'] > 0 => 2,
            $conteo['proximo'] > 0 => 1,
            default                => 0,
        };
    }

    /**
     * Familias vigentes (sin soft delete) agrupadas por calle: calle_id => [familia_id, ...]
     *
     * @param  array<int,int>  $calleIds
     */
    private function familiasAgrupadasPorCalle(array $calleIds): Collection
    {
        if ($calleIds === []) {
            return collect();
        }

        return Familia::query()
            ->whereIn('calle_id', $calleIds)
            ->get(['id', 'calle_id'])
            ->groupBy('calle_id')
            ->map(fn (Collection $filas) => $filas->pluck('id')->map(fn ($id) => (int) $id)->values());
    }
}

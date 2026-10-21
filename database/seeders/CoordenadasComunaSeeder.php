<?php

namespace Database\Seeders;

use App\Models\Calle;
use App\Models\Sede;
use Illuminate\Database\Seeder;

/**
 * ═══════════════════════════════════════════════════════════════
 *  CoordenadasComunaSeeder — Coordenadas de calles y polígonos de sedes
 * ───────────────────────────────────────────────────────────────
 *  Por qué existe: las coordenadas (calles.latitud / calles.longitud) y el
 *  contorno de cada sede (sedes.limites) son DATOS de la base de datos, no
 *  archivos. Git solo transfiere archivos, así que esos datos no viajaban
 *  con el código y el mapa de calor aparecía vacío en otra instalación.
 *  Este seeder los incluye en el repositorio para que cualquier instalación
 *  los reciba con un solo comando.
 *
 *  Origen de los datos: base de datos de la compañera que diseñó el módulo
 *  de georreferenciación (exportados el 13-oct-2026).
 *
 *  FORMATO DE LOS POLÍGONOS: se guarda SIEMPRE el formato simple que lee el
 *  mapa de calor: un arreglo de pares [longitud, latitud]. El polígono de
 *  "La Macarena Vuelta Azul" estaba en la BD de origen como GeoJSON
 *  (FeatureCollection exportada de geojson.io), un formato que el mapa no
 *  dibuja; aquí se normalizó a su anillo exterior de 17 puntos.
 *
 *  IDEMPOTENTE y NO DESTRUCTIVO:
 *   · Solo rellena lo que está vacío (latitud/longitud/limites en NULL).
 *     Un punto que el admin haya marcado a mano desde "Asignar coordenadas"
 *     NO se pisa.
 *   · Las calles y sedes se buscan por NOMBRE (los id pueden ser distintos
 *     entre instalaciones). Lo que no se encuentre se informa y se omite,
 *     sin lanzar error.
 *   · Debe correrse DESPUÉS de ComunaSeeder (que crea las sedes y calles).
 *
 *  Uso:  php artisan db:seed --class=CoordenadasComunaSeeder
 * ═══════════════════════════════════════════════════════════════
 */
class CoordenadasComunaSeeder extends Seeder
{
    /**
     * Punto de cada calle: [sede => [calle => [latitud, longitud]]]
     */
    private const CALLES = [
        'Agua Santa I' => [
            'Calle El Aguacate' => [10.3395965, -67.0238325],
            'Sector San José' => [10.3424614, -67.0256619],
        ],
        'Casa Comunal Sector Norte' => [
            'Calle Los Mangos' => [10.3428892, -67.0269649],
        ],
        'El Cristo' => [
            'Calle El Cristo' => [10.3407973, -67.0251467],
            'Sector San Rafael' => [10.3377231, -67.0225119],
        ],
        'El Indio de la Macarena Sur' => [
            'Sector Vista Hermosa (Barrio Nuevo)' => [10.3366571, -67.0239455],
        ],
        'Gran Amanecer' => [
            'Calle Cruz del Valle' => [10.3409609, -67.0186612],
            'Calle Venezuela' => [10.3353324, -67.0228027],
            'Sector La Piedra' => [10.3404146, -67.0165040],
        ],
        'La Macarena Vuelta Azul' => [
            'Calle La Paz' => [10.3407888, -67.0173626],
            'Calle Los Mangos' => [10.3444196, -67.0161287],
        ],
        'Liberpin I' => [
            'Sector El Libertador' => [10.3390541, -67.0256779],
            'Sector Los Pinos' => [10.3399589, -67.0260856],
        ],
        'Nuevos Luchadores' => [
            'Calle Unión' => [10.3405475, -67.0237037],
            'Callejón Las Flores' => [10.3400831, -67.0226362],
        ],
        'Somos Progreso y Libertad II' => [
            'Calle Libertad' => [10.3407798, -67.0206461],
            'Sector El Progreso (parte alta)' => [10.3411281, -67.0199593],
            'Sector El Progreso (parte baja)' => [10.3403277, -67.0208285],
        ],
        'Zona en Silencio' => [
            'Sector El Topo' => [10.3360097, -67.0225669],
            'Sector Los Petriles' => [10.3375332, -67.0223309],
        ],
    ];

    /**
     * Contorno de cada sede: [sede => [[longitud, latitud], ...]]
     * (el orden [lng, lat] es el que guarda y dibuja el mapa de calor).
     */
    private const POLIGONOS = [
        'El Indio de la Macarena Sur' => [
            [-67.018561, 10.348934],
            [-67.019095, 10.345783],
            [-67.019537, 10.343609],
            [-67.02344, 10.344442],
            [-67.026054, 10.343175],
            [-67.027637, 10.343283],
            [-67.028521, 10.343972],
            [-67.031172, 10.342776],
            [-67.030325, 10.340132],
            [-67.02992, 10.339372],
            [-67.027637, 10.33919],
            [-67.027526, 10.336039],
            [-67.022482, 10.334482],
            [-67.018616, 10.339046],
            [-67.014456, 10.339046],
            [-67.014087, 10.349586],
            [-67.018561, 10.348934],
        ],
        'La Macarena Vuelta Azul' => [
            [-67.018561, 10.3489338],
            [-67.0140874, 10.3495858],
            [-67.0144556, 10.3390455],
            [-67.0186162, 10.3390455],
            [-67.0224823, 10.3344815],
            [-67.0275265, 10.3360391],
            [-67.027637, 10.3391904],
            [-67.0299198, 10.3393715],
            [-67.0303248, 10.3401321],
            [-67.0311716, 10.3427763],
            [-67.0285206, 10.3439716],
            [-67.027637, 10.3432834],
            [-67.0260537, 10.3431747],
            [-67.0234396, 10.3444424],
            [-67.0195367, 10.3436094],
            [-67.0190949, 10.3457826],
            [-67.018561, 10.3489338],
        ],
    ];

    public function run(): void
    {
        $callesActualizadas = 0;
        $callesYaTenian     = 0;
        $noEncontradas      = [];

        foreach (self::CALLES as $nombreSede => $calles) {
            $sede = Sede::where('nombre', $nombreSede)->first();

            foreach ($calles as $nombreCalle => [$latitud, $longitud]) {
                $calle = $sede
                    ? Calle::where('sede_id', $sede->id)->where('nombre', $nombreCalle)->first()
                    : null;

                if (! $calle) {
                    $noEncontradas[] = "{$nombreSede} / {$nombreCalle}";
                    continue;
                }

                if ($calle->latitud !== null && $calle->longitud !== null) {
                    $callesYaTenian++;
                    continue;
                }

                $calle->update(['latitud' => $latitud, 'longitud' => $longitud]);
                $callesActualizadas++;
            }
        }

        $sedesActualizadas = 0;
        $sedesYaTenian     = 0;

        foreach (self::POLIGONOS as $nombreSede => $puntos) {
            $sede = Sede::where('nombre', $nombreSede)->first();

            if (! $sede) {
                $noEncontradas[] = "{$nombreSede} (polígono)";
                continue;
            }

            if (! empty($sede->limites)) {
                $sedesYaTenian++;
                continue;
            }

            // El cast 'array' de Sede::limites se encarga de guardarlo como json
            $sede->limites = $puntos;
            $sede->save();
            $sedesActualizadas++;
        }

        $this->command->info(
            "Calles: {$callesActualizadas} actualizadas, {$callesYaTenian} ya tenían coordenada. "
            . "Sedes: {$sedesActualizadas} con polígono nuevo, {$sedesYaTenian} ya lo tenían."
        );

        if ($noEncontradas !== []) {
            $this->command->warn('No se encontraron (se omitieron): ' . implode('; ', $noEncontradas));
        }
    }
}

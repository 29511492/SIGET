<?php

namespace Database\Seeders;

use App\Models\Comite;
use Illuminate\Database\Seeder;

/**
 * ═══════════════════════════════════════════════════════════════
 *  ComiteSeeder — catálogo de comités y unidades comunales
 * ───────────────────────────────────────────────────────────────
 *  EJECUTAR:  php artisan db:seed --class=ComiteSeeder
 *
 *  Origen: observación #1 del profesor al rol admin (nov-2026).
 *  El formulario de Voceros solo mostraba "Comité de Salud" porque
 *  esa era la única fila de la tabla `comites`.
 *
 *  Reglas de esta versión:
 *  - Idempotente: busca por `nombre` (que es unique) y solo crea lo
 *    que falta. Correrlo varias veces no duplica nada.
 *  - Nunca modifica ni borra un comité existente (el "Comité de
 *    Salud" que ya está en la BD conserva su id).
 *  - Es un catálogo base que el sistema necesita para funcionar, no
 *    datos de prueba: por eso NO tiene guardia de producción.
 *  - Los nombres van en singular y con ortografía corregida respecto
 *    a la lista original del profesor ("Comités LOMNA" → "Comité
 *    LOMNA", "habitad" → "Hábitat", etc.).
 * ═══════════════════════════════════════════════════════════════
 */
class ComiteSeeder extends Seeder
{
    /** @var list<string> */
    private const COMITES = [
        'Unidad Administrativa y Financiera Comunal',
        'Unidad de Contraloría Social',
        'Comité de Salud',
        'Comité Tierras Urbanas',
        'Comité de Vivienda y Hábitat',
        'Comité Economía Comunal',
        'Comité Recreación y Deportes',
        'Comité Alimentación y Defensa del Consumidor',
        'Comité Mesa técnica de agua',
        'Comité Mesa técnica de Energía y gas',
        'Comité LOPNNA',
        'Comité de Educación, Cultura y Formación ciudadana',
        'Comité de Transporte',
        'Comité de Adultos Mayores',
        'Comité de Planificación Comunal',
    ];

    public function run(): void
    {
        $creados = 0;

        foreach (self::COMITES as $nombre) {
            $comite = Comite::firstOrCreate(['nombre' => $nombre]);

            if ($comite->wasRecentlyCreated) {
                $creados++;
            }
        }

        $this->command?->info(
            "Comités: {$creados} creados, " . (count(self::COMITES) - $creados) . ' ya existían.'
        );
    }
}

<?php

namespace Database\Seeders;

use App\Models\Calle;
use App\Models\Sede;
use Illuminate\Database\Seeder;

/**
 * ═══════════════════════════════════════════════════════════════
 *  ComunaSeeder — Consejos Comunales de "Ana Karina Rote 2019"
 * ───────────────────────────────────────────────────────────────
 *  Fuente: documento "Composición Comuna Ana Karina Rote 2019".
 *  Usa firstOrCreate() por 'nombre' para no duplicar sedes/calles
 *  ya registradas. Seguro de correr varias veces (idempotente).
 *
 *  Uso: php artisan db:seed --class=ComunaSeeder
 * ═══════════════════════════════════════════════════════════════
 */
class ComunaSeeder extends Seeder
{
    public function run(): void
    {
        $consejosComunales = [
            [
                'nombre'    => 'Liberpin I',
                'direccion' => 'Sector El Libertador y sector Los Pinos',
                'calles'    => ['Sector El Libertador', 'Sector Los Pinos'],
            ],
            [
                'nombre'    => 'El Cristo',
                'direccion' => 'Calle El Cristo y sector San Rafael',
                'calles'    => ['Calle El Cristo', 'Sector San Rafael'],
            ],
            [
                'nombre'    => 'El Indio de la Macarena Sur',
                'direccion' => 'Sector Vista Hermosa (Barrio Nuevo)',
                'calles'    => ['Sector Vista Hermosa (Barrio Nuevo)'],
            ],
            [
                'nombre'    => 'Agua Santa I',
                'direccion' => 'Calle El Aguacate y sector San José',
                'calles'    => ['Calle El Aguacate', 'Sector San José'],
            ],
            [
                'nombre'    => 'Nuevos Luchadores',
                'direccion' => 'Calle Unión y callejón Las Flores',
                'calles'    => ['Calle Unión', 'Callejón Las Flores'],
            ],
            [
                'nombre'    => 'Somos Progreso y Libertad II',
                'direccion' => 'Sector El Progreso parte alta, Progreso parte baja y calle Libertad',
                'calles'    => ['Sector El Progreso (parte alta)', 'Sector El Progreso (parte baja)', 'Calle Libertad'],
            ],
            [
                'nombre'    => 'Gran Amanecer',
                'direccion' => 'Calle Cruz del Valle, calle Venezuela y sector La Piedra',
                'calles'    => ['Calle Cruz del Valle', 'Calle Venezuela', 'Sector La Piedra'],
            ],
            [
                'nombre'    => 'La Macarena Vuelta Azul',
                'direccion' => 'Calle La Paz y calle Los Mangos, desde escuela Cruz del Valle Rodríguez hasta salida de Super Líder',
                'calles'    => ['Calle La Paz', 'Calle Los Mangos'],
            ],
            [
                'nombre'    => 'Zona en Silencio',
                'direccion' => 'Sectores El Topo y Los Petriles',
                'calles'    => ['Sector El Topo', 'Sector Los Petriles'],
            ],
        ];

        foreach ($consejosComunales as $cc) {
            $sede = Sede::firstOrCreate(
                ['nombre' => $cc['nombre']],
                [
                    'direccion'              => $cc['direccion'],
                    'tipo_sede'              => 'administrativa',
                    'estado_infraestructura' => 'regular',
                    'observaciones'          => 'Consejo Comunal integrante de la Comuna Ana Karina Rote 2019.',
                ]
            );

            foreach ($cc['calles'] as $nombreCalle) {
                Calle::firstOrCreate([
                    'sede_id' => $sede->id,
                    'nombre'  => $nombreCalle,
                ]);
            }
        }

        $this->command->info('Comuna Ana Karina Rote 2019: 9 Consejos Comunales y sus calles registrados.');
    }
}

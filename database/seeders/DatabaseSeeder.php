<?php

namespace Database\Seeders;

use App\Models\Beneficio;
use App\Models\Calle;
use App\Models\Comite;
use App\Models\Familia;
use App\Models\Habitante;
use App\Models\Proyecto;
use App\Models\Sede;
use App\Models\User;
use App\Models\Vocero;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 *  PROPÓSITO: Crear datos mínimos para que las 7 tarjetas del
 *  Dashboard muestren números reales en vez de 0.
 *
 *  EJECUTAR: php artisan db:seed
 *
 *  RESULTADO ESPERADO en el Dashboard:
 *  - Familias Registradas:  3
 *  - Habitantes del Censo:  6
 *  - Viviendas Críticas:    1  (1 familia con condicion_vivienda='critica')
 *  - Con Discapacidad:      1  (1 habitante con es_discapacitado=true)
 *  - Voceros Activos:       1
 *  - Proyectos en Curso:    2
 *  - Beneficios Entregados: 3
 * ═══════════════════════════════════════════════════════════════
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── 1. Usuario Admin ───────────────────────────────────────
        $admin = User::firstOrCreate(
            ['email' => 'admin@siget.ve'],
            [
                'name'     => 'Administrador SIGET',
                'password' => Hash::make('password123'),
                'rol'      => 'admin',
            ]
        );

        // ── 2. Usuario Vocero ──────────────────────────────────────
        User::firstOrCreate(
            ['email' => 'vocero@siget.ve'],
            [
                'name'     => 'María González',
                'password' => Hash::make('password123'),
                'rol'      => 'vocero',
            ]
        );

        // ── 3. Sede y Calle ────────────────────────────────────────
        $sede = Sede::firstOrCreate(
            ['nombre' => 'Casa Comunal Sector Norte'],
            [
                'direccion'               => 'Av. Principal, Sector Norte',
                'tipo_sede'               => 'administrativa',
                'estado_infraestructura'  => 'optima',
            ]
        );

        $calle = Calle::firstOrCreate(
            ['nombre' => 'Calle Los Mangos', 'sede_id' => $sede->id]
        );

        // ── 4. Comité ──────────────────────────────────────────────
        $comite = Comite::firstOrCreate(['nombre' => 'Comité de Salud']);

        // ── 5. Familias (3 registros, 1 en estado crítico) ─────────
        $familia1 = Familia::firstOrCreate(
            ['codigo_vivienda' => 'VIV-001'],
            [
                'sede_id'            => $sede->id,
                'calle_id'           => $calle->id,
                'nombre_responsable' => 'Carlos Pérez',
                'condicion_vivienda' => 'optima',  // ← NO critica
                'cantidad_bombonas'  => 2,
                'posee_agua_potable' => true,
            ]
        );

        $familia2 = Familia::firstOrCreate(
            ['codigo_vivienda' => 'VIV-002'],
            [
                'sede_id'            => $sede->id,
                'calle_id'           => $calle->id,
                'nombre_responsable' => 'Ana Rodríguez',
                'condicion_vivienda' => 'critica',  // ← viviendas_criticas: 1
                'cantidad_bombonas'  => 1,
                'posee_agua_potable' => false,
            ]
        );

        $familia3 = Familia::firstOrCreate(
            ['codigo_vivienda' => 'VIV-003'],
            [
                'sede_id'            => $sede->id,
                'calle_id'           => $calle->id,
                'nombre_responsable' => 'Luis Hernández',
                'condicion_vivienda' => 'regular',
                'cantidad_bombonas'  => 1,
                'posee_agua_potable' => true,
            ]
        );

        // ── 6. Habitantes (6 registros, 1 con discapacidad) ────────
        $habitante1 = Habitante::firstOrCreate(
            ['cedula' => 'V-12345678'],
            [
                'familia_id'      => $familia1->id,
                'nombres'         => 'Carlos',
                'apellidos'       => 'Pérez',
                'fecha_nacimiento'=> '1985-03-15',
                'sexo'            => 'masculino',
                'es_discapacitado'=> false,
                'nivel_educativo' => 'universitario',
            ]
        );

        Habitante::firstOrCreate(
            ['cedula' => 'V-23456789'],
            [
                'familia_id'      => $familia1->id,
                'nombres'         => 'Laura',
                'apellidos'       => 'Pérez',
                'fecha_nacimiento'=> '1990-07-22',
                'sexo'            => 'femenino',
                'es_discapacitado'=> true,  // ← con_discapacidad: 1
                'tipo_discapacidad'=> 'Motora',
                'nivel_educativo' => 'bachillerato',
            ]
        );

        Habitante::firstOrCreate(
            ['cedula' => 'V-34567890'],
            [
                'familia_id'      => $familia2->id,
                'nombres'         => 'Ana',
                'apellidos'       => 'Rodríguez',
                'fecha_nacimiento'=> '1978-11-05',
                'sexo'            => 'femenino',
                'es_discapacitado'=> false,
                'nivel_educativo' => 'primaria',
            ]
        );

        Habitante::firstOrCreate(
            ['cedula' => 'V-45678901'],
            [
                'familia_id'      => $familia2->id,
                'nombres'         => 'José',
                'apellidos'       => 'Rodríguez',
                'fecha_nacimiento'=> '2005-04-18',
                'sexo'            => 'masculino',
                'es_discapacitado'=> false,
                'nivel_educativo' => 'bachillerato',
            ]
        );

        $habitante5 = Habitante::firstOrCreate(
            ['cedula' => 'V-56789012'],
            [
                'familia_id'      => $familia3->id,
                'nombres'         => 'Luis',
                'apellidos'       => 'Hernández',
                'fecha_nacimiento'=> '1972-09-30',
                'sexo'            => 'masculino',
                'es_discapacitado'=> false,
                'nivel_educativo' => 'bachillerato',
            ]
        );

        Habitante::firstOrCreate(
            ['cedula' => 'V-67890123'],
            [
                'familia_id'      => $familia3->id,
                'nombres'         => 'Rosa',
                'apellidos'       => 'Hernández',
                'fecha_nacimiento'=> '1975-02-14',
                'sexo'            => 'femenino',
                'es_discapacitado'=> false,
                'nivel_educativo' => 'universitario',
            ]
        );

        // ── 7. Vocero activo ───────────────────────────────────────
        Vocero::firstOrCreate(
            ['habitante_id' => $habitante5->id, 'sede_id' => $sede->id],
            [
                'comite_id'      => $comite->id,
                'unidad_comunal' => 'Unidad de Contraloría Social',
                'fecha_eleccion' => '2024-01-15',
                'esta_activo'    => true,  // ← total_voceros: 1
            ]
        );

        // ── 8. Proyectos ───────────────────────────────────────────
        Proyecto::firstOrCreate(
            ['nombre_proyecto' => 'Rehabilitación de Aceras'],
            [
                'sede_id'              => $sede->id,
                'comite_id'            => $comite->id,
                'user_id'              => $admin->id,
                'objetivo'             => 'Reparar 200m de aceras del sector norte.',
                'monto_aprobado'       => 15000.00,
                'fuente_financiamiento'=> 'Alcaldia',
                'estatus'              => 'en_ejecucion',
                'fecha_inicio'         => '2024-03-01',
            ]
        );

        Proyecto::firstOrCreate(
            ['nombre_proyecto' => 'Comedor Comunal'],
            [
                'sede_id'              => $sede->id,
                'user_id'              => $admin->id,
                'objetivo'             => 'Instalar comedor para 50 familias en vulnerabilidad.',
                'monto_aprobado'       => 8000.00,
                'fuente_financiamiento'=> 'CFG',
                'estatus'              => 'aprobado',
                'fecha_inicio'         => '2024-04-15',
            ]
        );

        // ── 9. Beneficios ──────────────────────────────────────────
        foreach ([$familia1, $familia2, $familia3] as $familia) {
            Beneficio::firstOrCreate(
                ['familia_id' => $familia->id, 'nombre_beneficio' => 'Gas Comunal'],
                [
                    'user_id'       => $admin->id,
                    'fecha_entrega' => now()->subDays(rand(1, 30)),
                    'observaciones' => 'Entrega mensual de gas subsidiado.',
                ]
            );
        }

        $this->command->info('✅ Seed completado. Usuarios de prueba:');
        $this->command->info('   Admin:  admin@siget.ve  / password123');
        $this->command->info('   Vocero: vocero@siget.ve / password123');
    }
}

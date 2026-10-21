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
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * ═══════════════════════════════════════════════════════════════
 *  DatabaseSeeder — datos base de desarrollo
 * ───────────────────────────────────────────────────────────────
 *  EJECUTAR:  php artisan db:seed
 *
 *  CORRECCIÓN (oct-2026): la versión anterior usaba firstOrCreate,
 *  que IGNORA los registros con soft delete. Con una vivienda dada
 *  de baja (VIV-003) intentaba crearla de nuevo y chocaba con el
 *  índice único de codigo_vivienda.
 *
 *  Reglas de esta versión:
 *  - Toda búsqueda incluye registros dados de baja (withTrashed).
 *  - Si el registro existe (activo o dado de baja) se deja TAL
 *    CUAL: nunca se restaura ni se sobrescribe. Un seeder no debe
 *    "resucitar" lo que el usuario dio de baja a propósito.
 *  - Nada se crea para familias dadas de baja (habitantes,
 *    beneficios).
 *  - No corre en producción (crea cuentas con contraseña conocida).
 *  - Los seeders de la comuna se llaman al final.
 * ═══════════════════════════════════════════════════════════════
 */
class DatabaseSeeder extends Seeder
{
    private const NOMBRE_SEDE_BASE = 'Casa Comunal Sector Norte';

    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->error('DatabaseSeeder bloqueado: el entorno es producción.');

            return;
        }

        DB::transaction(function () {
            // ── 1. Usuarios ────────────────────────────────────────
            $admin = $this->obtener(User::class, ['email' => 'admin@siget.ve'], [
                'name'     => 'Administrador SIGET',
                'password' => Hash::make('password123'),
                'rol'      => 'admin',
            ]);

            $voceroUser = $this->obtener(User::class, ['email' => 'vocero@siget.ve'], [
                'name'     => 'María González',
                'password' => Hash::make('password123'),
                'rol'      => 'vocero',
            ]);

            // ── 2. Sede, calle y comité ────────────────────────────
            $sede = $this->obtener(Sede::class, ['nombre' => self::NOMBRE_SEDE_BASE], [
                'direccion'              => 'Av. Principal, Sector Norte',
                'tipo_sede'              => 'administrativa',
                'estado_infraestructura' => 'optima',
            ]);

            $calle = Calle::firstOrCreate(
                ['nombre' => 'Calle Los Mangos', 'sede_id' => $sede->id]
            );

            $comite = Comite::firstOrCreate(['nombre' => 'Comité de Salud']);

            // ── 3. Familias ────────────────────────────────────────
            $familias = [];
            $datosFamilias = [
                ['VIV-001', 'Carlos Pérez',    'optima',  2, true],
                ['VIV-002', 'Ana Rodríguez',   'critica', 1, false],
                ['VIV-003', 'Luis Hernández',  'regular', 1, true],
            ];

            foreach ($datosFamilias as [$codigo, $responsable, $condicion, $bombonas, $agua]) {
                $familias[$codigo] = $this->obtener(Familia::class, ['codigo_vivienda' => $codigo], [
                    'sede_id'            => $sede->id,
                    'calle_id'           => $calle->id,
                    'nombre_responsable' => $responsable,
                    'condicion_vivienda' => $condicion,
                    'cantidad_bombonas'  => $bombonas,
                    'posee_agua_potable' => $agua,
                ]);
            }

            // ── 4. Habitantes (solo de familias vigentes) ──────────
            $datosHabitantes = [
                ['V-12345678', 'VIV-001', 'Carlos', 'Pérez',     '1985-03-15', 'masculino', false, null,     'universitario'],
                ['V-23456789', 'VIV-001', 'Laura',  'Pérez',     '1990-07-22', 'femenino',  true,  'Motora', 'bachillerato'],
                ['V-34567890', 'VIV-002', 'Ana',    'Rodríguez', '1978-11-05', 'femenino',  false, null,     'primaria'],
                ['V-45678901', 'VIV-002', 'José',   'Rodríguez', '2005-04-18', 'masculino', false, null,     'bachillerato'],
                ['V-56789012', 'VIV-003', 'Luis',   'Hernández', '1972-09-30', 'masculino', false, null,     'bachillerato'],
                ['V-67890123', 'VIV-003', 'Rosa',   'Hernández', '1975-02-14', 'femenino',  false, null,     'universitario'],
            ];

            $habitantes = [];

            foreach ($datosHabitantes as [$cedula, $codigoFamilia, $nombres, $apellidos, $nacimiento, $sexo, $discapacitado, $tipoDiscapacidad, $nivel]) {
                $familia = $familias[$codigoFamilia];

                if ($familia->trashed()) {
                    continue;
                }

                $habitantes[$cedula] = $this->obtener(Habitante::class, ['cedula' => $cedula], [
                    'familia_id'        => $familia->id,
                    'nombres'           => $nombres,
                    'apellidos'         => $apellidos,
                    'fecha_nacimiento'  => $nacimiento,
                    'sexo'              => $sexo,
                    'es_discapacitado'  => $discapacitado,
                    'tipo_discapacidad' => $tipoDiscapacidad,
                    'nivel_educativo'   => $nivel,
                ]);
            }

            // ── 5. Vocero activo (no se crea para un habitante dado de baja) ──
            $luis = $habitantes['V-56789012'] ?? null;

            if ($luis && ! $luis->trashed()) {
                Vocero::firstOrCreate(
                    ['habitante_id' => $luis->id, 'sede_id' => $sede->id],
                    [
                        'comite_id'      => $comite->id,
                        'unidad_comunal' => 'Unidad de Contraloría Social',
                        'fecha_eleccion' => '2024-01-15',
                        'esta_activo'    => true,
                    ]
                );
            }

            // ── 6. Vincular el usuario vocero a su habitante ───────
            // Solo rellena si está vacío, y solo con un habitante vigente
            // que no esté ya vinculado a otra cuenta.
            if ($voceroUser->habitante_id === null) {
                $mandato = Vocero::query()
                    ->where('sede_id', $sede->id)
                    ->where('esta_activo', true)
                    ->orderBy('id')
                    ->first();

                if ($mandato
                    && Habitante::query()->whereKey($mandato->habitante_id)->exists()
                    && ! User::withTrashed()->where('habitante_id', $mandato->habitante_id)->exists()
                ) {
                    $voceroUser->forceFill(['habitante_id' => $mandato->habitante_id])->save();
                }
            }

            // ── 7. Proyectos ───────────────────────────────────────
            $this->obtener(Proyecto::class, ['nombre_proyecto' => 'Rehabilitación de Aceras'], [
                'sede_id'               => $sede->id,
                'comite_id'             => $comite->id,
                'user_id'               => $admin->id,
                'objetivo'              => 'Reparar 200m de aceras del sector norte.',
                'monto_aprobado'        => 15000.00,
                'fuente_financiamiento' => 'Alcaldia',
                'estatus'               => 'en_ejecucion',
                'fecha_inicio'          => '2024-03-01',
            ]);

            $this->obtener(Proyecto::class, ['nombre_proyecto' => 'Comedor Comunal'], [
                'sede_id'               => $sede->id,
                'user_id'               => $admin->id,
                'objetivo'              => 'Instalar comedor para 50 familias en vulnerabilidad.',
                'monto_aprobado'        => 8000.00,
                'fuente_financiamiento' => 'CFG',
                'estatus'               => 'aprobado',
                'fecha_inicio'          => '2024-04-15',
            ]);

            // ── 8. Beneficios (solo para familias vigentes) ────────
            foreach ($familias as $familia) {
                if ($familia->trashed()) {
                    continue;
                }

                $this->obtener(
                    Beneficio::class,
                    ['familia_id' => $familia->id, 'nombre_beneficio' => 'Gas Comunal'],
                    [
                        'user_id'       => $admin->id,
                        'fecha_entrega' => now()->subDays(rand(1, 30)),
                        'observaciones' => 'Entrega mensual de gas subsidiado.',
                    ]
                );
            }
        });

        // ── 9. Comuna Ana Karina Rote 2019 ─────────────────────────
        // ComunaSeeder solo se llama si aún no existen las demás sedes,
        // para no duplicarlas. CoordenadasComunaSeeder es idempotente
        // (rellena solo lo vacío) y siempre se llama.
        $hayOtrasSedes = Sede::withTrashed()
            ->where('nombre', '!=', self::NOMBRE_SEDE_BASE)
            ->exists();

        if (! $hayOtrasSedes) {
            $this->call(ComunaSeeder::class);
        }

        $this->call(CoordenadasComunaSeeder::class);

        $this->command?->info('✅ Seed completado. Usuarios de prueba:');
        $this->command?->info('   Admin:  admin@siget.ve  / password123');
        $this->command?->info('   Vocero: vocero@siget.ve / password123');
    }

    /**
     * Busca incluyendo registros dados de baja; si no existe, lo crea.
     * Un registro existente (activo o dado de baja) NO se restaura ni se
     * modifica.
     *
     * @param  class-string<Model>  $modelo
     * @param  array<string,mixed>  $buscar
     * @param  array<string,mixed>  $datos
     */
    private function obtener(string $modelo, array $buscar, array $datos = []): Model
    {
        $consulta = in_array(SoftDeletes::class, class_uses_recursive($modelo), true)
            ? $modelo::withTrashed()
            : $modelo::query();

        return $consulta->where($buscar)->first() ?? $modelo::create($buscar + $datos);
    }
}

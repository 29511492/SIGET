<?php

namespace Tests\Feature;

use App\Models\Calle;
use App\Models\Familia;
use App\Models\Habitante;
use App\Models\Sede;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Constancia de residencia — RG-004 / CU-003 (CP-05 y CP-06, ERR-05).
 *
 * Los datos de apoyo se crean igual que en DatabaseSeeder (mismos campos),
 * sin factories. phpunit.xml usa SQLite en memoria: estas pruebas no tocan
 * la base de desarrollo.
 */
class ConstanciaTest extends TestCase
{
    use RefreshDatabase;

    private function crearHabitante(): Habitante
    {
        $sede = Sede::create([
            'nombre'                 => 'Casa Comunal de Prueba',
            'direccion'              => 'Av. Principal, Sector Norte',
            'tipo_sede'              => 'administrativa',
            'estado_infraestructura' => 'optima',
        ]);

        $calle = Calle::create(['nombre' => 'Calle de Prueba', 'sede_id' => $sede->id]);

        $familia = Familia::create([
            'sede_id'            => $sede->id,
            'calle_id'           => $calle->id,
            'codigo_vivienda'    => 'TEST-001',
            'nombre_responsable' => 'Carlos Pérez',
            'condicion_vivienda' => 'optima',
            'cantidad_bombonas'  => 1,
            'posee_agua_potable' => true,
        ]);

        return Habitante::create([
            'familia_id'        => $familia->id,
            'cedula'            => 'V-12345678',
            'nombres'           => 'Carlos',
            'apellidos'         => 'Pérez',
            'fecha_nacimiento'  => '1985-03-15',
            'sexo'              => 'masculino',
            'es_discapacitado'  => false,
            'tipo_discapacidad' => null,
            'nivel_educativo'   => 'universitario',
        ]);
    }

    private function crearUsuario(string $rol): User
    {
        return User::create([
            'name'     => 'Usuario ' . $rol,
            'email'    => $rol . '@prueba.test',
            'password' => 'password123',
            'rol'      => $rol,
        ]);
    }

    private function pedirConstancia(Habitante $habitante)
    {
        return $this->withHeaders(['Accept' => 'application/pdf'])
            ->get('/api/v1/reportes/constancia-residencia/' . $habitante->id);
    }

    // ── CP-05: familia activa → se descarga el PDF ────────────────
    public function test_el_administrador_descarga_la_constancia_en_pdf(): void
    {
        $habitante = $this->crearHabitante();
        Sanctum::actingAs($this->crearUsuario('admin'));

        $respuesta = $this->pedirConstancia($habitante);

        $respuesta->assertOk();
        $this->assertStringContainsString('application/pdf', $respuesta->headers->get('Content-Type'));
    }

    public function test_el_vocero_tambien_puede_descargar_la_constancia(): void
    {
        $habitante = $this->crearHabitante();
        Sanctum::actingAs($this->crearUsuario('vocero'));

        $this->pedirConstancia($habitante)->assertOk();
    }

    // ── CP-06 / ERR-05: familia dada de baja → 422 con mensaje claro ─
    public function test_la_constancia_se_rechaza_si_la_familia_fue_dada_de_baja(): void
    {
        $habitante = $this->crearHabitante();
        Familia::findOrFail($habitante->familia_id)->delete(); // soft delete
        Sanctum::actingAs($this->crearUsuario('admin'));

        $respuesta = $this->pedirConstancia($habitante);

        $respuesta->assertStatus(422)
            ->assertJsonStructure(['message', 'errors' => ['habitante']]);
        $this->assertStringContainsString('dada de baja', $respuesta->json('message'));
        $this->assertStringNotContainsString('application/pdf', (string) $respuesta->headers->get('Content-Type'));
    }

    // ── Habitante dado de baja → 404 (route-model binding) ─────────
    public function test_un_habitante_dado_de_baja_no_genera_constancia(): void
    {
        $habitante = $this->crearHabitante();
        $habitante->delete(); // soft delete
        Sanctum::actingAs($this->crearUsuario('admin'));

        $this->pedirConstancia($habitante)->assertNotFound();
    }

    // ── Control de acceso ──────────────────────────────────────────
    public function test_un_usuario_comun_no_puede_emitir_constancias(): void
    {
        $habitante = $this->crearHabitante();
        Sanctum::actingAs($this->crearUsuario('usuario'));

        $this->pedirConstancia($habitante)->assertForbidden();
    }

    public function test_sin_sesion_se_responde_401(): void
    {
        $habitante = $this->crearHabitante();

        $this->pedirConstancia($habitante)->assertUnauthorized();
    }
}

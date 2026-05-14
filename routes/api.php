<?php

/**
 * ═══════════════════════════════════════════════════════════════
 *  routes/api.php — Versión actualizada con ruta de Dashboard
 * ───────────────────────────────────────────════════════════════
 */

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CalleController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\FamiliaController;
use App\Http\Controllers\Api\V1\HabitanteController;
use App\Http\Controllers\Api\V1\VoceroController;
use App\Http\Controllers\Api\V1\ProyectoController;
use App\Http\Controllers\Api\V1\BeneficioController;
use App\Http\Controllers\Api\V1\AuditoriaController;
use App\Http\Controllers\Api\V1\OrganizacionController;
use App\Http\Controllers\Api\V1\PagoQrController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // ══════════════════════════════════════════════════════════════
    //  CAPA 1 — PÚBLICA
    // ══════════════════════════════════════════════════════════════

    Route::post('login', [AuthController::class, 'login'])
        ->name('api.v1.login');

    // ══════════════════════════════════════════════════════════════
    //  CAPAS 2, 3 y 4 — REQUIEREN TOKEN SANCTUM
    // ══════════════════════════════════════════════════════════════
    Route::middleware('auth:sanctum')->group(function () {

        // ── Sesión ────────────────────────────────────────────────
        Route::post('logout', [AuthController::class, 'logout'])
            ->name('api.v1.logout');

        Route::get('me', [AuthController::class, 'me'])
            ->name('api.v1.me');


        // ══════════════════════════════════════════════════════════
        //  CAPA 2 — LECTURA (todos los roles autenticados)
        // ══════════════════════════════════════════════════════════
        Route::middleware('role:admin,operador,vocero')->group(function () {

            Route::get('dashboard/stats', [DashboardController::class, 'stats'])
                ->name('api.v1.dashboard.stats');

            // Familias — lectura + búsqueda para select del formulario
            Route::get('familias', [FamiliaController::class,   'index'])
                ->name('api.v1.familias.index');

            Route::get('familias/{familia}', [FamiliaController::class,   'show'])
                ->name('api.v1.familias.show');

            // Habitantes — lectura
            Route::get('habitantes', [HabitanteController::class, 'index'])
                ->name('api.v1.habitantes.index');

            Route::get('habitantes/{habitante}', [HabitanteController::class, 'show'])
                ->name('api.v1.habitantes.show');

            // Sedes y Calles — opciones para selects
            Route::get('sedes', [CalleController::class, 'listaSedes'])
                ->name('api.v1.sedes.index');

            Route::get('sedes/{sede}/calles', [CalleController::class, 'callesPorSede'])
                ->name('api.v1.sedes.calles');

            // Voceros — lectura
            Route::get('voceros/form-data', [VoceroController::class, 'getFormData'])
                ->name('api.v1.voceros.form-data');

            Route::get('voceros', [VoceroController::class, 'index'])
                ->name('api.v1.voceros.index');

            Route::get('voceros/{vocero}', [VoceroController::class, 'show'])
                ->name('api.v1.voceros.show');

            // Proyectos — lectura
            Route::get('proyectos/form-data', [ProyectoController::class, 'getFormData'])
                ->name('api.v1.proyectos.form-data');

            Route::get('proyectos', [ProyectoController::class, 'index'])
                ->name('api.v1.proyectos.index');

            Route::get('proyectos/{proyecto}', [ProyectoController::class, 'show'])
                ->name('api.v1.proyectos.show');

            //Beneficio - Lectura
            Route::get('beneficios', [BeneficioController::class, 'index'])
                ->name('api.v1.beneficios.index');

            Route::get('beneficios/{beneficio}', [BeneficioController::class, 'show'])
                ->name('api.v1.beneficios.show');

            // Organizaciones - Lectura
            Route::get('organizaciones/form-data', [OrganizacionController::class, 'formData'])
                ->name('api.v1.organizaciones.form-data');

            Route::get('organizaciones', [OrganizacionController::class, 'index'])
                ->name('api.v1.organizaciones.index');

            Route::get('organizaciones/{org}', [OrganizacionController::class, 'show'])
                ->name('api.v1.organizaciones.show');

            // Pagos QR - Lectura
            Route::get('pagos/form-data', [PagoQrController::class, 'formData'])
                ->name('api.v1.pagos.form-data');

            Route::get('pagos', [PagoQrController::class, 'index'])
                ->name('api.v1.pagos.index');

            Route::get('pagos/{pago}', [PagoQrController::class, 'show'])
                ->name('api.v1.pagos.show');

            Route::patch('pagos/{pago}/validar', [PagoQrController::class, 'validar'])
                ->name('api.v1.pagos.validar');
        });


        // ══════════════════════════════════════════════════════════
        //  CAPA 3 — ESCRITURA (admin + operador)
        // ══════════════════════════════════════════════════════════
        Route::middleware('role:admin,operador')->group(function () {

            // Familias — crear y editar
            Route::post('familias', [FamiliaController::class, 'store'])
                ->name('api.v1.familias.store');

            Route::put('familias/{familia}', [FamiliaController::class, 'update'])
            ->name('api.v1.familias.update');

            // Habitantes — crear y editar
            Route::post('habitantes', [HabitanteController::class, 'store'])
            ->name('api.v1.habitantes.store');

            Route::put('habitantes/{habitante}', [HabitanteController::class, 'update'])
                ->name('api.v1.habitantes.update');

            // Voceros — crear y editar
            Route::post('voceros', [VoceroController::class, 'store'])
                ->name('api.v1.voceros.store');

            Route::put('voceros/{vocero}', [VoceroController::class, 'update'])
                ->name('api.v1.voceros.update');

            // Proyectos — crear y editar
            Route::post('proyectos', [ProyectoController::class, 'store'])
                ->name('api.v1.proyectos.store');

            Route::put('proyectos/{proyecto}', [ProyectoController::class, 'update'])
                ->name('api.v1.proyectos.update');

            // Beneficios - crear y editar
            Route::post('beneficios', [BeneficioController::class, 'store'])
                ->name('api.v1.beneficios.store');

            Route::put('beneficios/{beneficio}', [BeneficioController::class, 'update'])
                ->name('api.v1.beneficios.update');

            // Organizaciones - crear y editar
            Route::post('organizaciones', [OrganizacionController::class, 'store'])
                ->name('api.v1.organizaciones.store');

            Route::put('organizaciones/{org}', [OrganizacionController::class, 'update'])
                ->name('api.v1.organizaciones.update');

            // Pagos QR - crear
            Route::post('pagos', [PagoQrController::class, 'store'])
                ->name('api.v1.pagos.store');
        });


        // ══════════════════════════════════════════════════════════
        //  CAPA 4 — SOLO ADMIN (eliminación y configuración)
        // ══════════════════════════════════════════════════════════
        Route::middleware('role:admin')->group(function () {

            // Soft delete — los registros quedan en DB con deleted_at
            Route::delete('familias/{familia}', [FamiliaController::class,   'destroy'])
                ->name('api.v1.familias.destroy');

            Route::delete('habitantes/{habitante}', [HabitanteController::class, 'destroy'])
                ->name('api.v1.habitantes.destroy');

            Route::delete('voceros/{vocero}', [VoceroController::class, 'destroy'])
                ->name('api.v1.voceros.destroy');

            Route::delete('proyectos/{proyecto}', [ProyectoController::class, 'destroy'])
                ->name('api.v1.proyectos.destroy');

            Route::delete('beneficios/{beneficio}', [BeneficioController::class, 'destroy'])
                ->name('api.v1.beneficios.destroy');

            Route::get('auditorias', [AuditoriaController::class, 'index'])
                ->name('api.v1.auditorias.index');

            Route::delete('organizaciones/{org}', [OrganizacionController::class, 'destroy'])
                ->name('api.v1.organizaciones.destroy');

            Route::delete('pagos/{pago}', [PagoQrController::class, 'destroy'])
                ->name('api.v1.pagos.destroy');
        });

    }); // fin auth:sanctum

}); // fin prefix v1

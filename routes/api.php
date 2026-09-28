<?php

/**
 * ═══════════════════════════════════════════════════════════════
 *  routes/api.php
 *
 *  CORRECCIÓN APLICADA (histórico, se conserva):
 *
 *  FIX — Route::delete('comunicados/{comunicado}') estaba
 *         registrada DOS VECES:
 *         · Capa 3 (role:admin,operador) — INCORRECTO
 *         · Capa 4 (role:admin)          — CORRECTO
 *
 *         Según el Documento Maestro y la Matriz de Rutas,
 *         el destroy de comunicados es operación exclusiva
 *         del rol admin (Capa 4). Se elimina el duplicado
 *         de Capa 3. La ruta en Capa 4 se conserva intacta.
 *
 *  CAMBIO (sept-2026) — Módulo de Habitantes eliminado:
 *  Las rutas /api/v1/habitantes (index, show, store, update,
 *  destroy) se retiran por completo. Los habitantes ahora se
 *  crean, editan y dan de baja DENTRO del mismo payload de
 *  /api/v1/familias (array `habitantes[]`), gestionados por
 *  FamiliaController — ver ese archivo para el detalle. El
 *  import de HabitanteController se elimina porque ya no lo usa
 *  ninguna ruta.
 *
 *  CAMBIO (sept-2026, corrección del profesor: roles) —
 *  1. Módulo de Configuración: rutas de usuarios/roles y matriz de
 *     permisos en Capa 4 (solo admin). Ver UsuarioController.
 *  2. FIX RBAC: las rutas de lectura de Familias (index/show)
 *     estaban en Capa 2 (incluía vocero) y el show devuelve los
 *     habitantes anidados. Contradecía la instrucción del profesor
 *     (el vocero no accede a Familias ni Habitantes). Se movieron
 *     a Capa 3 (admin + operador).
 * ═══════════════════════════════════════════════════════════════
 */

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CalleController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\FamiliaController;
use App\Http\Controllers\Api\V1\VoceroController;
use App\Http\Controllers\Api\V1\ProyectoController;
use App\Http\Controllers\Api\V1\BeneficioController;
use App\Http\Controllers\Api\V1\AuditoriaController;
use App\Http\Controllers\Api\V1\OrganizacionController;
use App\Http\Controllers\Api\V1\CuentaPagoController;
use App\Http\Controllers\Api\V1\PagoQrController;
use App\Http\Controllers\Api\V1\ReporteController;
use App\Http\Controllers\Api\V1\ComunicadoController;
use App\Http\Controllers\Api\V1\NoticiaController;
use App\Http\Controllers\Api\V1\SugerenciaController;
use App\Http\Controllers\Api\V1\PasswordResetController;
use App\Http\Controllers\Api\V1\UsuarioController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // ══════════════════════════════════════════════════════════════
    //  CAPA 1 — PÚBLICA
    // ══════════════════════════════════════════════════════════════

    Route::post('login', [AuthController::class, 'login'])
        ->name('api.v1.login');

    Route::post('register', [AuthController::class, 'register'])
        ->name('api.v1.register');

    Route::post('forgot-password', [PasswordResetController::class, 'enviarOtp'])
        ->name('api.v1.forgot-password');

    Route::post('verify-otp', [PasswordResetController::class, 'verificarOtp'])
        ->name('api.v1.verify-otp');

    Route::post('reset-password', [PasswordResetController::class, 'resetearPassword'])
        ->name('api.v1.reset-password');

    // ══════════════════════════════════════════════════════════════
    //  CAPAS 2, 3 y 4 — REQUIEREN TOKEN SANCTUM
    // ══════════════════════════════════════════════════════════════
    Route::middleware('auth:sanctum')->group(function () {

        // ── Sesión ────────────────────────────────────────────────
        Route::post('logout', [AuthController::class, 'logout'])
            ->name('api.v1.logout');

        Route::get('me', [AuthController::class, 'me'])
            ->name('api.v1.me');

        // Noticias — lectura (todos los roles autenticados)
        Route::get('noticias/recientes', [NoticiaController::class, 'recientes'])
            ->name('api.v1.noticias.recientes');

        Route::get('noticias/todas', [NoticiaController::class, 'todas'])
            ->name('api.v1.noticias.todas');

        Route::get('noticias', [NoticiaController::class, 'index'])
            ->name('api.v1.noticias.index');

        Route::get('noticias/{noticia}', [NoticiaController::class, 'show'])
            ->name('api.v1.noticias.show');

        // Sugerencias — todos los roles autenticados pueden enviar y ver las suyas
        // REGLA: estática /mis ANTES que la dinámica {sugerencia}
        Route::post('sugerencias', [SugerenciaController::class, 'store'])
            ->name('api.v1.sugerencias.store');

        Route::get('sugerencias/mis', [SugerenciaController::class, 'mis'])
            ->name('api.v1.sugerencias.mis');

        // Pagos QR — Portal Ciudadano (todos los roles autenticados)
        // FIX (junio 2026): el rol "usuario" registra su propio pago
        // sin depender de habitante_id. REGLA: estáticas /mio y /mis
        // ANTES que las dinámicas {pago} de Capa 2.
        Route::post('pagos/mio', [PagoQrController::class, 'storeUsuario'])
            ->name('api.v1.pagos.store-usuario');

        Route::get('pagos/mis', [PagoQrController::class, 'misPagos'])
            ->name('api.v1.pagos.mis');

        // Cuentas de Pago — todos los roles autenticados pueden VER las
        // activas, para elegir a cuál corresponde su pago. La escritura
        // (crear/editar/eliminar) vive en Capa 3 y Capa 4 más abajo.
        // REGLA: estática 'cuentas-pago' (sin parámetro) ya es la raíz,
        // no hay conflicto de orden con la dinámica {cuenta} de Capa 2.
        Route::get('cuentas-pago', [CuentaPagoController::class, 'index'])
            ->name('api.v1.cuentas-pago.index');


        // ══════════════════════════════════════════════════════════
        //  CAPA 2 — LECTURA (todos los roles autenticados)
        // ══════════════════════════════════════════════════════════
        Route::middleware('role:admin,operador,vocero')->group(function () {

            Route::get('dashboard/stats', [DashboardController::class, 'stats'])
                ->name('api.v1.dashboard.stats');

            // NOTA (sept-2026): Familias NO va en esta capa — el vocero no
            // tiene acceso a Familias ni Habitantes. Su lectura vive en Capa 3.

            // Sedes y Calles — opciones para selects encadenados
            Route::get('sedes', [CalleController::class, 'listaSedes'])
                ->name('api.v1.sedes.index');

            Route::get('sedes/{sede}/calles', [CalleController::class, 'callesPorSede'])
                ->name('api.v1.sedes.calles');

            // Voceros — estática form-data ANTES que la dinámica {vocero}
            Route::get('voceros/form-data', [VoceroController::class, 'getFormData'])
                ->name('api.v1.voceros.form-data');

            Route::get('voceros', [VoceroController::class, 'index'])
                ->name('api.v1.voceros.index');

            Route::get('voceros/{vocero}', [VoceroController::class, 'show'])
                ->name('api.v1.voceros.show');

            // Proyectos — estática form-data ANTES que la dinámica {proyecto}
            Route::get('proyectos/form-data', [ProyectoController::class, 'getFormData'])
                ->name('api.v1.proyectos.form-data');

            Route::get('proyectos', [ProyectoController::class, 'index'])
                ->name('api.v1.proyectos.index');

            Route::get('proyectos/{proyecto}', [ProyectoController::class, 'show'])
                ->name('api.v1.proyectos.show');

            // Beneficios — lectura
            Route::get('beneficios', [BeneficioController::class, 'index'])
                ->name('api.v1.beneficios.index');

            Route::get('beneficios/{beneficio}', [BeneficioController::class, 'show'])
                ->name('api.v1.beneficios.show');

            // Organizaciones — estática form-data ANTES que la dinámica {org}
            Route::get('organizaciones/form-data', [OrganizacionController::class, 'formData'])
                ->name('api.v1.organizaciones.form-data');

            Route::get('organizaciones', [OrganizacionController::class, 'index'])
                ->name('api.v1.organizaciones.index');

            Route::get('organizaciones/{org}', [OrganizacionController::class, 'show'])
                ->name('api.v1.organizaciones.show');

            // Detalle de una cuenta de pago — el listado vive en Capa 1
            Route::get('cuentas-pago/{cuenta}', [CuentaPagoController::class, 'show'])
                ->name('api.v1.cuentas-pago.show');

            // Pagos QR — estática form-data ANTES que la dinámica {pago}
            Route::get('pagos/form-data', [PagoQrController::class, 'formData'])
                ->name('api.v1.pagos.form-data');

            Route::get('pagos', [PagoQrController::class, 'index'])
                ->name('api.v1.pagos.index');

            Route::get('pagos/{pago}', [PagoQrController::class, 'show'])
                ->name('api.v1.pagos.show');

            Route::patch('pagos/{pago}/validar', [PagoQrController::class, 'validar'])
                ->name('api.v1.pagos.validar');

            // Reportes PDF — al vuelo, sin persistencia en BD
            Route::get('reportes/constancia-residencia/{habitante}', [ReporteController::class, 'constanciaResidencia'])
                ->name('api.v1.reportes.constancia-residencia');

            Route::get('reportes/estadisticas-dashboard', [ReporteController::class, 'estadisticasDashboard'])
                ->name('api.v1.reportes.estadisticas-dashboard');

            // Sugerencias — lectura para admin, operador y vocero
            Route::get('sugerencias', [SugerenciaController::class, 'index'])
                ->name('api.v1.sugerencias.index');
        });


        // ══════════════════════════════════════════════════════════
        //  CAPA 3 — ESCRITURA (admin + operador)
        // ══════════════════════════════════════════════════════════
        Route::middleware('role:admin,operador')->group(function () {

            // Familias — lectura (incluye habitantes anidados en show()),
            // crear y editar (el payload de store/update incluye el array
            // `habitantes[]` — ver FamiliaController). Solo admin + operador.
            Route::get('familias', [FamiliaController::class, 'index'])
                ->name('api.v1.familias.index');

            Route::get('familias/{familia}', [FamiliaController::class, 'show'])
                ->name('api.v1.familias.show');

            Route::post('familias', [FamiliaController::class, 'store'])
                ->name('api.v1.familias.store');

            Route::put('familias/{familia}', [FamiliaController::class, 'update'])
                ->name('api.v1.familias.update');

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

            // Beneficios — crear y editar
            Route::post('beneficios', [BeneficioController::class, 'store'])
                ->name('api.v1.beneficios.store');

            Route::put('beneficios/{beneficio}', [BeneficioController::class, 'update'])
                ->name('api.v1.beneficios.update');

            // Organizaciones — crear y editar
            Route::post('organizaciones', [OrganizacionController::class, 'store'])
                ->name('api.v1.organizaciones.store');

            Route::put('organizaciones/{org}', [OrganizacionController::class, 'update'])
                ->name('api.v1.organizaciones.update');

            // Crear y editar cuentas de pago — admin/operador
            Route::post('cuentas-pago', [CuentaPagoController::class, 'store'])
                ->name('api.v1.cuentas-pago.store');

            Route::put('cuentas-pago/{cuenta}', [CuentaPagoController::class, 'update'])
                ->name('api.v1.cuentas-pago.update');

            // Pagos QR — crear
            Route::post('pagos', [PagoQrController::class, 'store'])
                ->name('api.v1.pagos.store');

            // Comunicados — crear, leer y editar
            // NOTA: el destroy de comunicados NO va aquí.
            // Solo el rol admin puede eliminar comunicados (ver Capa 4).
            Route::get('comunicados', [ComunicadoController::class, 'index'])
                ->name('api.v1.comunicados.index');

            Route::post('comunicados', [ComunicadoController::class, 'store'])
                ->name('api.v1.comunicados.store');

            // Estática /pdf ANTES que la dinámica {comunicado}
            // (aunque aquí están en grupos separados, por claridad se documenta)
            Route::get('comunicados/{comunicado}', [ComunicadoController::class, 'show'])
                ->name('api.v1.comunicados.show');

            Route::put('comunicados/{comunicado}', [ComunicadoController::class, 'update'])
                ->name('api.v1.comunicados.update');

            Route::get('comunicados/{comunicado}/pdf', [ComunicadoController::class, 'descargarPdf'])
                ->name('api.v1.comunicados.descargar-pdf');

            // ✅ FIX: Route::delete de comunicados ELIMINADO de esta capa.
            // Estaba duplicada con la de Capa 4. El destroy de comunicados
            // es exclusivo del rol admin y vive únicamente en Capa 4.

            // Noticias — crear, editar y publicar (admin + operador)
            // REGLA: estática /todas y /publicar ANTES que la dinámica {noticia}
            Route::post('noticias', [NoticiaController::class, 'store'])
                ->name('api.v1.noticias.store');

            Route::put('noticias/{noticia}', [NoticiaController::class, 'update'])
                ->name('api.v1.noticias.update');

            Route::patch('noticias/{noticia}/publicar', [NoticiaController::class, 'publicar'])
                ->name('api.v1.noticias.publicar');

            // Sugerencias — revisar y responder (admin + operador)
            Route::patch('sugerencias/{sugerencia}/revisar', [SugerenciaController::class, 'revisar'])
                ->name('api.v1.sugerencias.revisar');
        });


        // ══════════════════════════════════════════════════════════
        //  CAPA 4 — SOLO ADMIN (eliminaciones y auditoría)
        // ══════════════════════════════════════════════════════════
        Route::middleware('role:admin')->group(function () {

            // SoftDelete — los registros quedan en BD con deleted_at
            Route::delete('familias/{familia}', [FamiliaController::class, 'destroy'])
                ->name('api.v1.familias.destroy');

            Route::delete('voceros/{vocero}', [VoceroController::class, 'destroy'])
                ->name('api.v1.voceros.destroy');

            Route::delete('proyectos/{proyecto}', [ProyectoController::class, 'destroy'])
                ->name('api.v1.proyectos.destroy');

            Route::delete('beneficios/{beneficio}', [BeneficioController::class, 'destroy'])
                ->name('api.v1.beneficios.destroy');

            Route::delete('organizaciones/{org}', [OrganizacionController::class, 'destroy'])
                ->name('api.v1.organizaciones.destroy');

            // Eliminar cuenta de pago — solo admin
            Route::delete('cuentas-pago/{cuenta}', [CuentaPagoController::class, 'destroy'])
                ->name('api.v1.cuentas-pago.destroy');

            Route::delete('pagos/{pago}', [PagoQrController::class, 'destroy'])
                ->name('api.v1.pagos.destroy');

            // ✅ Única definición correcta del destroy de comunicados
            Route::delete('comunicados/{comunicado}', [ComunicadoController::class, 'destroy'])
                ->name('api.v1.comunicados.destroy');

            // Noticias — eliminar (solo admin)
            Route::delete('noticias/{noticia}', [NoticiaController::class, 'destroy'])
                ->name('api.v1.noticias.destroy');

            // Sugerencias — eliminar (solo admin)
            Route::delete('sugerencias/{sugerencia}', [SugerenciaController::class, 'destroy'])
                ->name('api.v1.sugerencias.destroy');

            // Auditoría — solo lectura, exclusivo admin
            Route::get('auditorias', [AuditoriaController::class, 'index'])
                ->name('api.v1.auditorias.index');

            // Configuración — usuarios y roles (solo admin)
            // Matriz de permisos derivada de las rutas reales.
            Route::get('configuracion/permisos', [UsuarioController::class, 'matrizPermisos'])
                ->name('api.v1.configuracion.permisos');

            Route::get('usuarios', [UsuarioController::class, 'index'])
                ->name('api.v1.usuarios.index');

            Route::patch('usuarios/{usuario}/rol', [UsuarioController::class, 'cambiarRol'])
                ->name('api.v1.usuarios.rol');

            // withTrashed: permite reactivar cuentas desactivadas (SoftDelete)
            Route::patch('usuarios/{usuario}/estado', [UsuarioController::class, 'cambiarEstado'])
                ->withTrashed()
                ->name('api.v1.usuarios.estado');

            Route::patch('usuarios/{usuario}/desbloquear', [UsuarioController::class, 'desbloquear'])
                ->name('api.v1.usuarios.desbloquear');
        });

    }); // fin auth:sanctum

}); // fin prefix v1

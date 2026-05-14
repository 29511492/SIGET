<?php

namespace App\Providers;

use App\Models\Beneficio;
use App\Models\Familia;
use App\Models\Habitante;
use App\Models\Proyecto;
use App\Models\Vocero;
use App\Models\Organizacion;
use App\Observers\AdminAuditoriaObserver;
use Illuminate\Support\ServiceProvider;

/**
 * ═══════════════════════════════════════════════════════════════
 *  AppServiceProvider — SIGET
 * ───────────────────────────────────────────────────────────────
 *  Registro de Observers para el Módulo de Auditorías.
 *
 *  IMPORTANTE: El AdminAuditoriaObserver es genérico — el mismo
 *  Observer registrado en múltiples modelos. La guardia de rol
 *  vive dentro del Observer, no en el Provider.
 *
 *  Para activar la auditoría en un modelo, descomenta su línea.
 *  Para desactivarla temporalmente, coméntala — sin tocar el
 *  Observer ni el modelo.
 * ═══════════════════════════════════════════════════════════════
 */
class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // ── Módulo de Auditorías ───────────────────────────────────
        // Solo se registran acciones de usuarios con rol 'admin'.
        // La verificación ocurre dentro del Observer, no aquí.
        // Añadir o quitar modelos de esta lista no afecta el Observer.
        Familia::observe(AdminAuditoriaObserver::class);
        Habitante::observe(AdminAuditoriaObserver::class);
        Vocero::observe(AdminAuditoriaObserver::class);
        Proyecto::observe(AdminAuditoriaObserver::class);
        Beneficio::observe(AdminAuditoriaObserver::class);
        Organizacion::observe(AdminAuditoriaObserver::class);
    }
}

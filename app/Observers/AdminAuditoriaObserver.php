<?php

namespace App\Observers;

use App\Models\Auditoria;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

/**
 * ═══════════════════════════════════════════════════════════════
 *  AdminAuditoriaObserver — SIGET
 * ───────────────────────────────────────────────────────────────
 *  REGLA DE NEGOCIO ESTRICTA:
 *  Solo se registran acciones realizadas por usuarios con rol
 *  'admin'. Voceros, operadores y acciones del sistema (sin
 *  usuario autenticado) se descartan silenciosamente.
 *
 *  Patrón: Append-Only Log — los registros de auditoría son
 *  inmutables. Este Observer solo escribe, nunca actualiza.
 *
 *  Ubicación física: app/Observers/AdminAuditoriaObserver.php
 *  Registro: AppServiceProvider::boot() — ver instrucciones al
 *  final de este archivo.
 * ═══════════════════════════════════════════════════════════════
 */
class AdminAuditoriaObserver
{
    // ─── Evento: registro CREADO ──────────────────────────────────
    public function created(Model $model): void
    {
        $this->registrar(
            model:   $model,
            accion:  'creado',
            anterior: null,
            nuevo:    $model->getAttributes(),
        );
    }

    // ─── Evento: registro ACTUALIZADO ─────────────────────────────
    public function updated(Model $model): void
    {
        $this->registrar(
            model:    $model,
            accion:   'actualizado',
            anterior: $model->getOriginal(),   // valores ANTES del save()
            nuevo:    $model->getChanges(),    // solo los campos que cambiaron
        );
    }

    // ─── Evento: registro ELIMINADO (soft o físico) ───────────────
    public function deleted(Model $model): void
    {
        // Detectar si es soft-delete o eliminación física
        $esSoftDelete = method_exists($model, 'trashed') && $model->trashed();

        $this->registrar(
            model:    $model,
            accion:   $esSoftDelete ? 'soft_eliminado' : 'eliminado',
            anterior: $model->getOriginal(),
            nuevo:    null,
        );
    }

    // ─── Lógica central de escritura ──────────────────────────────
    /**
     * Verifica el rol del usuario autenticado ANTES de cualquier
     * operación de escritura. Si no es admin, retorna sin hacer nada.
     *
     * @param  Model       $model    Instancia Eloquent que disparó el evento
     * @param  string      $accion   'creado' | 'actualizado' | 'soft_eliminado' | 'eliminado'
     * @param  array|null  $anterior Valores previos (null en created)
     * @param  array|null  $nuevo    Valores nuevos (null en deleted)
     */
    private function registrar(
        Model  $model,
        string $accion,
        ?array $anterior,
        ?array $nuevo,
    ): void {
        // ── Guardia de rol: DEBE ir primero, antes de cualquier query ──
        $user = Auth::user();

        // Descartar si no hay sesión o el rol no es admin
        if (!$user || !$user->esAdmin()) {
            return;  // silencioso — no lanza excepción, no loguea nada
        }

        // ── Excluir la propia tabla de auditorías para evitar loops ───
        if ($model->getTable() === 'auditorias') {
            return;
        }

        // ── Limpiar campos sensibles antes de persistir ───────────────
        // Nunca almacenar contraseñas ni tokens en el log de auditoría.
        $anterior = $this->limpiarCamposSensibles($anterior);
        $nuevo    = $this->limpiarCamposSensibles($nuevo);

        // ── Escribir el registro de auditoría ─────────────────────────
        Auditoria::create([
            'user_id'         => $user->id,
            'accion'          => $accion,
            'tabla_afectada'  => $model->getTable(),
            'registro_id'     => $model->getKey(),
            'direccion_ip'    => Request::ip(),
            'user_agent'      => Request::userAgent(),
            'valor_anterior'  => $anterior,   // JSON nativo — columna json en migración
            'valor_nuevo'     => $nuevo,
        ]);
    }

    // ─── Elimina campos que jamás deben aparecer en logs ──────────
    private function limpiarCamposSensibles(?array $datos): ?array
    {
        if ($datos === null) {
            return null;
        }

        // Amplía esta lista si tu proyecto añade campos sensibles.
        // otp_code (sept-2026): User ahora se audita y su getOriginal()
        // incluye el OTP vigente — jamás debe quedar en el log.
        $sensibles = ['password', 'remember_token', 'token', 'api_token', 'otp_code'];

        return array_diff_key($datos, array_flip($sensibles));
    }
}

/*
 * ═══════════════════════════════════════════════════════════════
 *  INSTRUCCIONES DE REGISTRO — AppServiceProvider.php
 * ───────────────────────────────────────────────────────────────
 *  Agrega los siguientes use al inicio de AppServiceProvider.php:
 *
 *      use App\Models\Familia;
 *      use App\Observers\AdminAuditoriaObserver;
 *
 *  Dentro del método boot(), añade una línea por cada modelo
 *  que quieras auditar:
 *
 *      public function boot(): void
 *      {
 *          Familia::observe(AdminAuditoriaObserver::class);
 *
 *          // Cuando estés listo para auditar más modelos:
 *          // Habitante::observe(AdminAuditoriaObserver::class);
 *          // Vocero::observe(AdminAuditoriaObserver::class);
 *          // Proyecto::observe(AdminAuditoriaObserver::class);
 *          // Beneficio::observe(AdminAuditoriaObserver::class);
 *      }
 *
 *  El Observer es genérico — el mismo objeto registrado en N
 *  modelos. No necesitas crear un Observer por modelo.
 *
 *  Después de editar AppServiceProvider.php ejecutar:
 *      php artisan optimize:clear
 * ═══════════════════════════════════════════════════════════════
 */

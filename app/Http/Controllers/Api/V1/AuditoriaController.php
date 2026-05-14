<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditoriaResource;
use App\Models\Auditoria;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * ═══════════════════════════════════════════════════════════════
 *  AuditoriaController — SIGET
 * ───────────────────────────────────────────────────════════════
 *  Ruta física: app/Http/Controllers/Api/V1/AuditoriaController.php
 *  Namespace:   App\Http\Controllers\Api\V1
 *
 *  Solo lectura — el log de auditoría es inmutable.
 *  No existen métodos store, update ni destroy.
 *
 *  Protección: el middleware role:admin debe aplicarse en api.php,
 *  no aquí — consistente con el patrón de Capa 4 de SIGET.
 *
 *  Registro en api.php (dentro del grupo role:admin):
 *
 *      use App\Http\Controllers\Api\V1\AuditoriaController;
 *
 *      Route::middleware('role:admin')->group(function () {
 *          Route::get('auditorias', [AuditoriaController::class, 'index'])
 *              ->name('api.v1.auditorias.index');
 *      });
 * ═══════════════════════════════════════════════════════════════
 */
class AuditoriaController extends Controller
{
    /**
     * GET /api/v1/auditorias
     *
     * Listado paginado con filtros opcionales:
     *   ?tabla    = familias | habitantes | voceros | proyectos | beneficios
     *   ?accion   = creado | actualizado | soft_eliminado | eliminado
     *   ?user_id  = {id}    — acciones de un operador específico
     *   ?desde    = Y-m-d   — fecha inicial
     *   ?hasta    = Y-m-d   — fecha final
     *   ?per_page = 15      — registros por página (máx. 50)
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Auditoria::with('usuario')
            ->orderByDesc('created_at');

        // ── Filtro por tabla afectada ──────────────────────────────
        if ($request->filled('tabla')) {
            $query->where('tabla_afectada', $request->input('tabla'));
        }

        // ── Filtro por tipo de acción ──────────────────────────────
        if ($request->filled('accion')) {
            $query->where('accion', $request->input('accion'));
        }

        // ── Filtro por operador ────────────────────────────────────
        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->input('user_id'));
        }

        // ── Filtro por rango de fechas ─────────────────────────────
        if ($request->filled('desde')) {
            $query->whereDate('created_at', '>=', $request->input('desde'));
        }

        if ($request->filled('hasta')) {
            $query->whereDate('created_at', '<=', $request->input('hasta'));
        }

        // ── Paginación (máximo 50 por página para no saturar la vista) ─
        $perPage    = min((int) ($request->query('per_page', 15)), 50);
        $auditorias = $query->paginate($perPage);

        return AuditoriaResource::collection($auditorias);
    }
}

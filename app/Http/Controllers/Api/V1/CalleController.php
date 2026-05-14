<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Calle;
use App\Models\Sede;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ═══════════════════════════════════════════════════════════════
 *  CalleController — Opciones para selects del formulario
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA — ¿Por qué un controlador separado?
 *
 *  FamiliaController es responsable del CRUD de familias.
 *  Los datos auxiliares (listas de calles y sedes para selects)
 *  son una responsabilidad distinta — no son operaciones sobre
 *  familias. Un controlador separado aplica SRP.
 *
 *  RUTAS:
 *  GET /api/v1/sedes                → listaSedes()
 *  GET /api/v1/sedes/{sede}/calles  → callesPorSede()
 *
 *  El formulario de React hace dos llamadas:
 *  1. GET /v1/sedes → llena el <select> de sedes
 *  2. GET /v1/sedes/{id}/calles → llena el <select> de calles
 *     al cambiar la sede seleccionada (select encadenado)
 * ═══════════════════════════════════════════════════════════════
 */
class CalleController extends Controller
{
    /**
     * GET /api/v1/sedes
     * Lista todas las sedes activas para el select de sede del formulario.
     */
    public function listaSedes(): JsonResponse
    {
        $sedes = Sede::select('id', 'nombre', 'tipo_sede')
            ->orderBy('nombre')
            ->get();

        return response()->json([
            'data' => $sedes,
        ], 200);
    }

    /**
     * GET /api/v1/sedes/{sede}/calles
     * Lista las calles de una sede específica.
     *
     * SELECT ENCADENADO:
     * React llama a este endpoint cada vez que el usuario
     * cambia la sede en el formulario. El select de calles
     * se repuebla dinámicamente con las calles de esa sede.
     *
     * @param  Sede  $sede — Route Model Binding: Laravel busca automáticamente
     *                       la sede por ID. Si no existe → 404 automático.
     */
    public function callesPorSede(Sede $sede): JsonResponse
    {
        $calles = Calle::select('id', 'nombre')
            ->where('sede_id', $sede->id)
            ->orderBy('nombre')
            ->get();

        return response()->json([
            'data' => $calles,
        ], 200);
    }
}

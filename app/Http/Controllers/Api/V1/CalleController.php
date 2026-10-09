<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Calle\CoordenadasCalleRequest;
use App\Models\Calle;
use App\Models\Sede;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ═══════════════════════════════════════════════════════════════
 *  CalleController — Opciones para selects y coordenadas de calles
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA — ¿Por qué un controlador separado?
 *
 *  FamiliaController es responsable del CRUD de familias.
 *  Los datos auxiliares (listas de calles y sedes para selects)
 *  son una responsabilidad distinta — no son operaciones sobre
 *  familias. Un controlador separado aplica SRP.
 *
 *  RUTAS:
 *  GET   /api/v1/sedes                      → listaSedes()
 *  GET   /api/v1/sedes/{sede}/calles        → callesPorSede()
 *  PATCH /api/v1/calles/{calle}/coordenadas → actualizarCoordenadas()  [solo admin]
 *
 *  El formulario de React hace dos llamadas:
 *  1. GET /v1/sedes → llena el <select> de sedes
 *  2. GET /v1/sedes/{id}/calles → llena el <select> de calles
 *     al cambiar la sede seleccionada (select encadenado)
 *
 *  CAMBIO (oct-2026, georreferenciación):
 *  - callesPorSede() ahora incluye latitud y longitud (el editor de
 *    coordenadas las necesita para marcar lo ya guardado).
 *  - listaSedes() incluye el polígono `limites` SOLO si se pide con
 *    ?con_limites=1, para no inflar los selects de otros formularios
 *    (Familias, Voceros) con JSON grande que no usan.
 *  - actualizarCoordenadas(): asigna el punto de una calle desde el mapa.
 * ═══════════════════════════════════════════════════════════════
 */
class CalleController extends Controller
{
    /**
     * GET /api/v1/sedes
     * Lista todas las sedes activas para el select de sede del formulario.
     * Con ?con_limites=1 incluye también el polígono del territorio.
     */
    public function listaSedes(Request $request): JsonResponse
    {
        $columnas = ['id', 'nombre', 'tipo_sede'];

        if ($request->boolean('con_limites')) {
            $columnas[] = 'limites';
        }

        $sedes = Sede::select($columnas)
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
        $calles = Calle::select('id', 'nombre', 'latitud', 'longitud')
            ->where('sede_id', $sede->id)
            ->orderBy('nombre')
            ->get();

        return response()->json([
            'data' => $calles,
        ], 200);
    }

    /**
     * PATCH /api/v1/calles/{calle}/coordenadas   (solo admin)
     * Guarda el punto de una calle en el mapa. El rango válido de
     * latitud/longitud lo controla CoordenadasCalleRequest.
     */
    public function actualizarCoordenadas(CoordenadasCalleRequest $request, Calle $calle): JsonResponse
    {
        $calle->update($request->validated());

        return response()->json([
            'message' => 'Coordenada guardada correctamente.',
            'data'    => $calle->only(['id', 'nombre', 'sede_id', 'latitud', 'longitud']),
        ], 200);
    }
}

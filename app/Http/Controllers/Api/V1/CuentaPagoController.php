<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CuentaPago\StoreCuentaPagoRequest;
use App\Http\Requests\CuentaPago\UpdateCuentaPagoRequest;
use App\Http\Resources\CuentaPagoResource;
use App\Models\CuentaPago;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * CuentaPagoController
 *
 * Gestión de cuentas de pago (servicio + datos bancarios) que el
 * ciudadano usa para realizar pagos QR. Mismo patrón de capas que
 * OrganizacionController:
 *
 * Capa 1 (auth:sanctum, todos los roles):
 *   GET /cuentas-pago            → index()  solo activas, para elegir al pagar
 *
 * Capa 2 (admin + operador + vocero):
 *   GET /cuentas-pago/{cuenta}   → show()   detalle
 *
 * Capa 3 (admin + operador):
 *   POST  /cuentas-pago               → store()
 *   PUT   /cuentas-pago/{cuenta}      → update()
 *
 * Capa 4 (solo admin):
 *   DELETE /cuentas-pago/{cuenta}     → destroy()  SoftDelete
 */
class CuentaPagoController extends Controller
{
    // ─── GET /v1/cuentas-pago ────────────────────────────────────
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = CuentaPago::orderBy('nombre_servicio');

        // Filtro de estatus: si no se pasa, muestra solo activas por defecto
        // (el Portal Ciudadano nunca debe ver cuentas desactivadas)
        if ($request->has('activa')) {
            $query->where('activa', filter_var($request->input('activa'), FILTER_VALIDATE_BOOLEAN));
        } else {
            $query->where('activa', true);
        }

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(function ($q) use ($s) {
                $q->where('nombre_servicio', 'ilike', "%{$s}%")
                  ->orWhere('banco',         'ilike', "%{$s}%");
            });
        }

        return CuentaPagoResource::collection($query->paginate(15));
    }

    // ─── GET /v1/cuentas-pago/{cuenta} ───────────────────────────
    public function show(CuentaPago $cuenta): JsonResponse
    {
        return response()->json([
            'message' => 'OK',
            'data'    => new CuentaPagoResource($cuenta),
        ]);
    }

    // ─── POST /v1/cuentas-pago ────────────────────────────────────
    public function store(StoreCuentaPagoRequest $request): JsonResponse
    {
        $cuenta = CuentaPago::create($request->validated());

        return response()->json([
            'message' => 'Cuenta de pago registrada correctamente.',
            'data'    => new CuentaPagoResource($cuenta),
        ], 201);
    }

    // ─── PUT /v1/cuentas-pago/{cuenta} ────────────────────────────
    public function update(UpdateCuentaPagoRequest $request, CuentaPago $cuenta): JsonResponse
    {
        $cuenta->update($request->validated());

        return response()->json([
            'message' => 'Cuenta de pago actualizada correctamente.',
            'data'    => new CuentaPagoResource($cuenta),
        ]);
    }

    // ─── DELETE /v1/cuentas-pago/{cuenta} ─────────────────────────
    // Soft-delete: rellena deleted_at, el registro se conserva.
    public function destroy(CuentaPago $cuenta): JsonResponse
    {
        $cuenta->delete();

        return response()->json([
            'message' => 'Cuenta de pago eliminada correctamente.',
        ]);
    }
}

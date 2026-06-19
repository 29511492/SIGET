<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PagoQr\StorePagoQrRequest;
use App\Http\Requests\PagoQr\StorePagoUsuarioRequest;
use App\Http\Requests\PagoQr\ValidarPagoQrRequest;
use App\Http\Resources\PagoQrResource;
use App\Models\PagoQr;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;

class PagoQrController extends Controller
{
    // ─── GET /v1/pagos ───────────────────────────────────────────
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = PagoQr::with(['habitante', 'familia', 'organizacion', 'verificador', 'user'])
            ->orderByDesc('fecha_pago');

        // Filtro por estado (el panel de validación usa ?estado=pendiente)
        if ($request->filled('estado')) {
            $query->where('estado', $request->input('estado'));
        }

        // Filtro por habitante
        if ($request->filled('habitante_id')) {
            $query->where('habitante_id', (int) $request->input('habitante_id'));
        }

        // Filtro por familia
        if ($request->filled('familia_id')) {
            $query->where('familia_id', (int) $request->input('familia_id'));
        }

        // Filtro por organización / servicio
        if ($request->filled('organizacion_id')) {
            $query->where('organizacion_id', (int) $request->input('organizacion_id'));
        }

        // Búsqueda por referencia bancaria
        if ($request->filled('search')) {
            $query->where('referencia_bancaria', 'ilike', '%' . $request->input('search') . '%');
        }

        return PagoQrResource::collection($query->paginate(20));
    }

    // ─── GET /v1/pagos/{pago} ────────────────────────────────────
    public function show(PagoQr $pago): JsonResponse
    {
        $pago->load(['habitante', 'familia', 'organizacion', 'verificador', 'user']);

        return response()->json([
            'message' => 'OK',
            'data'    => new PagoQrResource($pago),
        ]);
    }

    // ─── POST /v1/pagos ──────────────────────────────────────────
    // Flujo admin/operador: registra un pago vinculado a un habitante.
    public function store(StorePagoQrRequest $request): JsonResponse
    {
        $validated = $request->validated();

        // ── Subida del comprobante ────────────────────────────────
        // Se guarda en storage/app/public/comprobantes/YYYY/MM/
        // Accesible via /storage/comprobantes/... con storage:link
        if ($request->hasFile('comprobante')) {
            $path = $request->file('comprobante')->store(
                'comprobantes/' . now()->format('Y/m'),
                'public'
            );
            $validated['comprobante_path'] = $path;
        }

        // El estado siempre inicia en 'pendiente' — nunca desde el cliente
        $validated['estado']     = 'pendiente';
        $validated['fecha_pago'] = $validated['fecha_pago'] ?? now();

        $pago = PagoQr::create($validated);
        $pago->load(['habitante', 'familia', 'organizacion']);

        return response()->json([
            'message' => 'Pago registrado correctamente. Queda pendiente de verificación.',
            'data'    => new PagoQrResource($pago),
        ], 201);
    }

    // ─── POST /v1/pagos/mio ────────────────────────────────────────
    // FIX (junio 2026): Flujo Portal Ciudadano (rol "usuario").
    // El pago se vincula directamente al usuario autenticado vía
    // user_id, sin requerir habitante_id. El comprobante es obligatorio
    // (lo exige StorePagoUsuarioRequest).
    public function storeUsuario(StorePagoUsuarioRequest $request): JsonResponse
    {
        $validated = $request->validated();

        // El comprobante siempre viene en este flujo (es 'required')
        $path = $request->file('comprobante')->store(
            'comprobantes/' . now()->format('Y/m'),
            'public'
        );

        $pago = PagoQr::create([
            'user_id'             => $request->user()->id,
            'referencia_bancaria' => $validated['referencia_bancaria'],
            'monto'               => $validated['monto'],
            'concepto_pago'       => $validated['concepto_pago'],
            'fecha_pago'          => $validated['fecha_pago'],
            'comprobante_path'    => $path,
            'estado'              => 'pendiente',
        ]);

        return response()->json([
            'message' => 'Pago registrado correctamente. El Consejo Comunal verificará tu comprobante pronto.',
            'data'    => new PagoQrResource($pago),
        ], 201);
    }

    // ─── GET /v1/pagos/mis ───────────────────────────────────────
    // FIX (junio 2026): el usuario consulta el estado de sus propios
    // pagos, igual patrón que SugerenciaController::mis().
    public function misPagos(Request $request): JsonResponse
    {
        $pagos = PagoQr::deUsuario($request->user()->id)
            ->with('verificador')
            ->latest('fecha_pago')
            ->paginate(10);

        return response()->json([
            'message' => 'Pagos obtenidos correctamente.',
            'data'    => PagoQrResource::collection($pagos->items()),
            'meta'    => [
                'current_page' => $pagos->currentPage(),
                'last_page'    => $pagos->lastPage(),
                'total'        => $pagos->total(),
            ],
        ]);
    }

    // ─── PATCH /v1/pagos/{pago}/validar ─────────────────────────
    /**
     * Transición de estado: pendiente → verificado | rechazado
     * Solo opera si el pago está en estado 'pendiente'.
     * Registra quién validó y cuándo.
     */
    public function validar(ValidarPagoQrRequest $request, PagoQr $pago): JsonResponse
    {
        if (!$pago->esPendiente()) {
            return response()->json([
                'message' => "Este pago ya fue {$pago->estado} y no puede modificarse.",
                'errors'  => [],
            ], 422);
        }

        $pago->update([
            'estado'               => $request->input('estado'),
            'motivo_rechazo'       => $request->input('motivo_rechazo'),
            'verificado_por'       => $request->user()->id,
            'fecha_verificacion'   => now(),
        ]);

        $pago->load(['habitante', 'familia', 'organizacion', 'verificador', 'user']);

        $msg = $request->input('estado') === 'verificado'
            ? 'Pago verificado correctamente.'
            : 'Pago rechazado. Se notificará al habitante.';

        return response()->json([
            'message' => $msg,
            'data'    => new PagoQrResource($pago),
        ]);
    }

    // ─── DELETE /v1/pagos/{pago} ─────────────────────────────────
    public function destroy(PagoQr $pago): JsonResponse
    {
        // Eliminar el archivo físico si existe
        if ($pago->comprobante_path && Storage::disk('public')->exists($pago->comprobante_path)) {
            Storage::disk('public')->delete($pago->comprobante_path);
        }

        $pago->delete(); // soft-delete

        return response()->json([
            'message' => 'Pago eliminado correctamente.',
        ]);
    }
}

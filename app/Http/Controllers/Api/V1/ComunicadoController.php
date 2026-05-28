<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Comunicado\StoreComunicadoRequest;
use App\Http\Requests\Comunicado\UpdateComunicadoRequest;
use App\Http\Resources\ComunicadoResource;
use App\Models\Comunicado;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ComunicadoController extends Controller
{
    /**
     * GET /api/v1/comunicados
     * Listado paginado con búsqueda. Rol: admin, operador.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Comunicado::with('user')
            ->when($request->filled('buscar'), function ($q) use ($request) {
                $termino = $request->buscar;
                $q->where('destinatario', 'ilike', "%{$termino}%")
                  ->orWhere('asunto',      'ilike', "%{$termino}%")
                  ->orWhere('numero_oficio','ilike', "%{$termino}%");
            })
            ->when($request->filled('estado'), fn($q) => $q->where('estado', $request->estado))
            ->orderBy('created_at', 'desc');

        $comunicados = $query->paginate(15);

        return response()->json([
            'message' => 'OK',
            'data'    => ComunicadoResource::collection($comunicados->items()),
            'meta'    => [
                'total'        => $comunicados->total(),
                'per_page'     => $comunicados->perPage(),
                'current_page' => $comunicados->currentPage(),
                'last_page'    => $comunicados->lastPage(),
            ],
        ]);
    }

    /**
     * POST /api/v1/comunicados
     * Crea el comunicado, asigna número de oficio y retorna su PDF.
     * Rol: admin, operador.
     */
    public function store(StoreComunicadoRequest $request): JsonResponse
    {
        $comunicado = Comunicado::create([
            ...$request->validated(),
            'user_id'       => $request->user()->id,
            'numero_oficio' => Comunicado::generarNumeroOficio(),
        ]);

        $comunicado->load('user');

        return response()->json([
            'message' => 'Comunicado creado exitosamente.',
            'data'    => new ComunicadoResource($comunicado),
        ], 201);
    }

    /**
     * GET /api/v1/comunicados/{comunicado}
     */
    public function show(Comunicado $comunicado): JsonResponse
    {
        $comunicado->load('user');

        return response()->json([
            'message' => 'OK',
            'data'    => new ComunicadoResource($comunicado),
        ]);
    }

    /**
     * PUT /api/v1/comunicados/{comunicado}
     * Solo se puede actualizar si está en borrador.
     */
    public function update(UpdateComunicadoRequest $request, Comunicado $comunicado): JsonResponse
    {
        if ($comunicado->estado === 'enviado') {
            return response()->json([
                'message' => 'No se puede modificar un comunicado ya enviado.',
            ], 422);
        }

        $comunicado->update($request->validated());

        return response()->json([
            'message' => 'Comunicado actualizado.',
            'data'    => new ComunicadoResource($comunicado),
        ]);
    }

    /**
     * DELETE /api/v1/comunicados/{comunicado}
     * SoftDelete. Rol: solo admin.
     */
    public function destroy(Comunicado $comunicado): JsonResponse
    {
        $comunicado->delete();

        return response()->json([
            'message' => 'Comunicado archivado correctamente.',
        ]);
    }

    /**
     * GET /api/v1/comunicados/{comunicado}/pdf
     * Genera y descarga el PDF del comunicado guardado.
     */
    public function descargarPdf(Comunicado $comunicado): Response
    {
        $comunicado->load('user');

        $datos = [
            'comunicado'   => $comunicado,
            'fecha_emision'=> now()->locale('es')->isoFormat('D [de] MMMM [de] YYYY'),
            'titulo_doc'   => 'COMUNICADO OFICIAL',
        ];

        $pdf = Pdf::loadView('pdf.comunicado', $datos)
                  ->setPaper('letter', 'portrait');

        $nombreArchivo = 'comunicado_' . $comunicado->numero_oficio . '.pdf';

        return $pdf->download($nombreArchivo);
    }
}

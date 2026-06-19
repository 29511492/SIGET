<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Noticia\StoreNoticiaRequest;
use App\Http\Requests\Noticia\UpdateNoticiaRequest;
use App\Http\Resources\NoticiaResource;
use App\Models\Noticia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * NoticiaController
 *
 * Gestión de noticias comunales.
 *
 * Capa 2 (lectura — todos los roles):
 *   GET  /noticias         → index()   solo publicadas, paginadas
 *   GET  /noticias/recientes → recientes() últimas 3, con caché 5min
 *   GET  /noticias/{id}    → show()    detalle de una noticia publicada
 *
 * Capa 3 (escritura — admin + operador):
 *   GET  /noticias/todas   → todas()   listado completo incluyendo borradores
 *   POST /noticias         → store()   crear noticia
 *   PUT  /noticias/{id}    → update()  editar noticia
 *   PATCH /noticias/{id}/publicar → publicar() cambiar estado publicado
 *
 * Capa 4 (solo admin):
 *   DELETE /noticias/{id}  → destroy() SoftDelete
 */
class NoticiaController extends Controller
{
    // ─────────────────────────────────────────────────────────────
    //  CAPA 2 — Lectura pública (todos los roles autenticados)
    // ─────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/noticias
     * Listado paginado de noticias publicadas — para todos los roles.
     */
    public function index(Request $request): JsonResponse
    {
        $noticias = Noticia::publicadas()
            ->recientes()
            ->with('autor')
            ->paginate(10);

        return response()->json([
            'message' => 'Noticias obtenidas correctamente.',
            'data'    => NoticiaResource::collection($noticias->items()),
            'meta'    => [
                'current_page' => $noticias->currentPage(),
                'last_page'    => $noticias->lastPage(),
                'total'        => $noticias->total(),
                'per_page'     => $noticias->perPage(),
            ],
        ]);
    }

    /**
     * GET /api/v1/noticias/recientes
     * Últimas 3 noticias publicadas con caché de 5 minutos.
     * Usado por el widget en MiComunidad y PerfilPage.
     */
    public function recientes(): JsonResponse
    {
        $noticias = Cache::remember('noticias_recientes', now()->addMinutes(5), function () {
            return Noticia::publicadas()
                ->recientes()
                ->with('autor')
                ->limit(3)
                ->get();
        });

        return response()->json([
            'message' => 'Noticias recientes obtenidas correctamente.',
            'data'    => NoticiaResource::collection($noticias),
        ]);
    }

    /**
     * GET /api/v1/noticias/{noticia}
     * Detalle de una noticia — solo si está publicada.
     */
    public function show(Noticia $noticia): JsonResponse
    {
        if (! $noticia->publicado) {
            return response()->json([
                'message' => 'Esta noticia no está disponible.',
            ], 404);
        }

        $noticia->load('autor');

        return response()->json([
            'message' => 'Noticia obtenida correctamente.',
            'data'    => new NoticiaResource($noticia),
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    //  CAPA 3 — Escritura (admin + operador)
    // ─────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/noticias/todas
     * Listado completo incluyendo borradores — solo admin/operador.
     * Soporta búsqueda por título y filtro por estado publicado.
     */
    public function todas(Request $request): JsonResponse
    {
        $query = Noticia::with('autor')->recientes();

        if ($request->filled('buscar')) {
            $query->where('titulo', 'ilike', '%' . $request->buscar . '%');
        }

        if ($request->filled('publicado')) {
            $query->where('publicado', filter_var($request->publicado, FILTER_VALIDATE_BOOLEAN));
        }

        $noticias = $query->paginate(10);

        return response()->json([
            'message' => 'Noticias obtenidas correctamente.',
            'data'    => NoticiaResource::collection($noticias->items()),
            'meta'    => [
                'current_page' => $noticias->currentPage(),
                'last_page'    => $noticias->lastPage(),
                'total'        => $noticias->total(),
                'per_page'     => $noticias->perPage(),
            ],
        ]);
    }

    /**
     * POST /api/v1/noticias
     * Crear nueva noticia. Si publicado=true, se registra published_at.
     */
    public function store(StoreNoticiaRequest $request): JsonResponse
    {
        $publicado = $request->boolean('publicado', false);

        $noticia = Noticia::create([
            'user_id'      => $request->user()->id,
            'titulo'       => $request->titulo,
            'contenido'    => $request->contenido,
            'publicado'    => $publicado,
            'published_at' => $publicado ? now() : null,
        ]);

        $noticia->load('autor');

        return response()->json([
            'message' => 'Noticia creada correctamente.',
            'data'    => new NoticiaResource($noticia),
        ], 201);
    }

    /**
     * PUT /api/v1/noticias/{noticia}
     * Actualizar noticia existente.
     * Si se publica por primera vez, registra published_at.
     */
    public function update(UpdateNoticiaRequest $request, Noticia $noticia): JsonResponse
    {
        $datos = $request->only(['titulo', 'contenido', 'publicado']);

        // Si se está publicando por primera vez, registrar la fecha
        if (isset($datos['publicado']) && $datos['publicado'] && ! $noticia->publicado) {
            $datos['published_at'] = now();
        }

        // Si se está despublicando, limpiar la fecha
        if (isset($datos['publicado']) && ! $datos['publicado']) {
            $datos['published_at'] = null;
        }

        $noticia->update($datos);
        $noticia->load('autor');

        return response()->json([
            'message' => 'Noticia actualizada correctamente.',
            'data'    => new NoticiaResource($noticia),
        ]);
    }

    /**
     * PATCH /api/v1/noticias/{noticia}/publicar
     * Alterna el estado publicado/borrador de una noticia.
     * Endpoint dedicado para el toggle rápido en la lista.
     */
    public function publicar(Noticia $noticia): JsonResponse
    {
        $nuevoEstado = ! $noticia->publicado;

        $noticia->update([
            'publicado'    => $nuevoEstado,
            'published_at' => $nuevoEstado ? ($noticia->published_at ?? now()) : null,
        ]);

        return response()->json([
            'message' => $nuevoEstado ? 'Noticia publicada.' : 'Noticia guardada como borrador.',
            'data'    => new NoticiaResource($noticia),
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    //  CAPA 4 — Solo admin
    // ─────────────────────────────────────────────────────────────

    /**
     * DELETE /api/v1/noticias/{noticia}
     * SoftDelete — el registro queda en BD con deleted_at.
     */
    public function destroy(Noticia $noticia): JsonResponse
    {
        $noticia->delete();

        return response()->json([
            'message' => 'Noticia eliminada correctamente.',
        ]);
    }
}

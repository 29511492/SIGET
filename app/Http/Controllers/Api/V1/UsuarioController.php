<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Usuario\CambiarEstadoRequest;
use App\Http\Requests\Usuario\CambiarRolRequest;
use App\Http\Resources\UsuarioAdminResource;
use App\Models\User;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\Rule;

/**
 * ═══════════════════════════════════════════════════════════════
 *  UsuarioController — Configuración: usuarios y roles (SOLO ADMIN)
 * ───────────────────────────────────────────────────────────────
 *  Corrección del profesor (sept-2026): los roles no pueden
 *  cambiarse "por base de datos" — debe existir un módulo de
 *  configuración dentro del sistema.
 *
 *  Decisión de diseño (opción A): los 4 roles siguen siendo fijos
 *  (enum users.rol). Este controlador gestiona la ASIGNACIÓN de
 *  roles y el estado de las cuentas; no toca el esquema.
 *
 *  Reglas de robustez:
 *    · Un admin no puede cambiar su propio rol ni desactivarse.
 *    · Nunca puede quedar el sistema sin otro administrador activo.
 *    · Cambiar el rol o desactivar revoca los tokens del usuario,
 *      así el SPA (que guarda `permisos` en localStorage) se ve
 *      obligado a reautenticarse con los permisos nuevos.
 *    · Cada cambio queda en Auditoría (User está observado por
 *      AdminAuditoriaObserver).
 *
 *  Desactivar = SoftDelete (los registros históricos conservan a
 *  su autor gracias a withTrashed() en las relaciones).
 *
 *  Rutas: Capa 4 (role:admin) en routes/api.php.
 * ═══════════════════════════════════════════════════════════════
 */
class UsuarioController extends Controller
{
    /** Roles válidos del sistema (fuente única para validación y matriz). */
    public const ROLES = ['admin', 'operador', 'vocero', 'usuario'];

    private const ESTADOS       = ['activo', 'inactivo', 'bloqueado'];
    private const MAX_PER_PAGE  = 50;

    private const ROLES_INFO = [
        'admin' => [
            'etiqueta'    => 'Administrador',
            'descripcion' => 'Gestión completa del sistema: eliminación de registros, auditoría y configuración de usuarios y roles.',
        ],
        'operador' => [
            'etiqueta'    => 'Operador',
            'descripcion' => 'Registra y edita el censo y los módulos comunales; no elimina registros ni accede a auditoría o configuración.',
        ],
        'vocero' => [
            'etiqueta'    => 'Vocero',
            'descripcion' => 'Consulta los módulos comunales; sin acceso a familias ni habitantes (instrucción del profesor).',
        ],
        'usuario' => [
            'etiqueta'    => 'Ciudadano',
            'descripcion' => 'Portal Ciudadano: pagos QR propios, noticias, sugerencias y perfil. Sin acceso a los módulos administrativos.',
        ],
    ];

    /**
     * Módulos que se muestran en la matriz de permisos.
     * Clave = primer segmento de la URI bajo /api/v1.
     */
    private const MODULOS = [
        'familias'       => 'Familias y habitantes',
        'voceros'        => 'Voceros',
        'proyectos'      => 'Proyectos',
        'beneficios'     => 'Beneficios',
        'organizaciones' => 'Organizaciones',
        'pagos'          => 'Pagos QR',
        'cuentas-pago'   => 'Cuentas de pago',
        'comunicados'    => 'Comunicados',
        'noticias'       => 'Noticias',
        'sugerencias'    => 'Sugerencias',
        'reportes'       => 'Reportes PDF',
        'dashboard'      => 'Estadísticas del dashboard',
        'auditorias'     => 'Auditoría',
        'usuarios'       => 'Usuarios y roles',
    ];

    /** Segmentos de URI que se agrupan bajo otro módulo. */
    private const ALIAS_MODULO = [
        'configuracion' => 'usuarios',
    ];

    // ─────────────────────────────────────────────────────────────
    //  GET /api/v1/usuarios
    // ─────────────────────────────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $filtros = $request->validate([
            'search'   => ['nullable', 'string', 'max:100'],
            'rol'      => ['nullable', Rule::in(self::ROLES)],
            'estado'   => ['nullable', Rule::in(self::ESTADOS)],
            'page'     => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1'],
        ]);

        $porPagina = min(max((int) ($filtros['per_page'] ?? 15), 1), self::MAX_PER_PAGE);

        $query = User::query()
            ->withTrashed()
            ->with('habitante:id,nombres,apellidos,cedula');

        if (! empty($filtros['search'])) {
            // ilike (PostgreSQL) + escape de comodines ingresados por el usuario
            $termino = '%' . addcslashes($filtros['search'], '\\%_') . '%';
            $query->where(function ($q) use ($termino) {
                $q->where('name', 'ilike', $termino)
                  ->orWhere('email', 'ilike', $termino)
                  ->orWhere('cedula', 'ilike', $termino);
            });
        }

        if (! empty($filtros['rol'])) {
            $query->where('rol', $filtros['rol']);
        }

        match ($filtros['estado'] ?? null) {
            'activo'    => $query->whereNull('deleted_at')->where('is_locked', false),
            'inactivo'  => $query->whereNotNull('deleted_at'),
            'bloqueado' => $query->whereNull('deleted_at')->where('is_locked', true),
            default     => null,
        };

        $paginador = $query->orderBy('name')->orderBy('id')->paginate($porPagina);

        return response()->json([
            'message' => 'Usuarios obtenidos correctamente.',
            'data'    => UsuarioAdminResource::collection($paginador->getCollection())->resolve($request),
            'meta'    => [
                'current_page' => $paginador->currentPage(),
                'last_page'    => $paginador->lastPage(),
                'per_page'     => $paginador->perPage(),
                'total'        => $paginador->total(),
                'resumen'      => $this->resumen(),
            ],
        ], 200);
    }

    // ─────────────────────────────────────────────────────────────
    //  PATCH /api/v1/usuarios/{usuario}/rol
    // ─────────────────────────────────────────────────────────────
    public function cambiarRol(CambiarRolRequest $request, User $usuario): JsonResponse
    {
        $nuevoRol = $request->validated('rol');

        if ($request->user()->is($usuario)) {
            return $this->error('No puedes cambiar tu propio rol.', 'rol');
        }

        if ($usuario->rol === $nuevoRol) {
            return $this->error('El usuario ya tiene ese rol.', 'rol');
        }

        try {
            DB::transaction(function () use ($usuario, $nuevoRol) {
                // Si se le quita el rol admin, debe quedar otro admin activo.
                if ($usuario->rol === 'admin') {
                    $this->asegurarOtroAdmin($usuario);
                }

                $usuario->update(['rol' => $nuevoRol]);
                $usuario->tokens()->delete();
            });
        } catch (DomainException $e) {
            return $this->error($e->getMessage(), 'rol');
        }

        return $this->respuestaUsuario(
            $usuario,
            'Rol actualizado. La sesión del usuario se cerró y los permisos nuevos aplican al volver a entrar.'
        );
    }

    // ─────────────────────────────────────────────────────────────
    //  PATCH /api/v1/usuarios/{usuario}/estado   (withTrashed)
    // ─────────────────────────────────────────────────────────────
    public function cambiarEstado(CambiarEstadoRequest $request, User $usuario): JsonResponse
    {
        $activar = $request->boolean('activo');

        if ($request->user()->is($usuario)) {
            return $this->error('No puedes desactivar tu propia cuenta.', 'activo');
        }

        if ($activar) {
            if (! $usuario->trashed()) {
                return $this->error('La cuenta ya está activa.', 'activo');
            }

            $usuario->restore();

            return $this->respuestaUsuario($usuario, 'Cuenta reactivada correctamente.');
        }

        if ($usuario->trashed()) {
            return $this->error('La cuenta ya está desactivada.', 'activo');
        }

        try {
            DB::transaction(function () use ($usuario) {
                if ($usuario->rol === 'admin') {
                    $this->asegurarOtroAdmin($usuario);
                }

                $usuario->tokens()->delete();
                $usuario->delete(); // SoftDelete
            });
        } catch (DomainException $e) {
            return $this->error($e->getMessage(), 'activo');
        }

        return $this->respuestaUsuario($usuario, 'Cuenta desactivada. El usuario ya no puede iniciar sesión.');
    }

    // ─────────────────────────────────────────────────────────────
    //  PATCH /api/v1/usuarios/{usuario}/desbloquear
    // ─────────────────────────────────────────────────────────────
    public function desbloquear(Request $request, User $usuario): JsonResponse
    {
        if (! $usuario->is_locked) {
            return $this->error('La cuenta no está bloqueada.', 'is_locked');
        }

        $usuario->desbloquear();

        return $this->respuestaUsuario($usuario, 'Cuenta desbloqueada. Ya puede iniciar sesión.');
    }

    // ─────────────────────────────────────────────────────────────
    //  GET /api/v1/configuracion/permisos
    // ─────────────────────────────────────────────────────────────
    /**
     * Matriz de permisos por rol y módulo, DERIVADA de las rutas
     * reales registradas (middleware `role:` de routes/api.php).
     * No es texto escrito a mano: si una ruta cambia de capa, la
     * matriz cambia con ella y nunca queda desincronizada.
     *
     *   GET            → lectura
     *   POST/PUT/PATCH → escritura
     *   DELETE         → eliminacion
     */
    public function matrizPermisos(): JsonResponse
    {
        $vacio  = ['lectura' => false, 'escritura' => false, 'eliminacion' => false];
        $matriz = [];

        foreach (array_keys(self::MODULOS) as $clave) {
            $matriz[$clave] = array_fill_keys(self::ROLES, $vacio);
        }

        foreach (Route::getRoutes()->getRoutes() as $ruta) {
            $partes = explode('/', $ruta->uri());

            if (($partes[0] ?? null) !== 'api' || ($partes[1] ?? null) !== 'v1') {
                continue;
            }

            $segmento = self::ALIAS_MODULO[$partes[2] ?? ''] ?? ($partes[2] ?? null);

            if ($segmento === null || ! isset($matriz[$segmento])) {
                continue;
            }

            $rolesRuta = $this->rolesDeRuta($ruta);

            if ($rolesRuta === null) {
                continue; // ruta pública
            }

            foreach ($ruta->methods() as $metodo) {
                $accion = match ($metodo) {
                    'GET'                  => 'lectura',
                    'POST', 'PUT', 'PATCH' => 'escritura',
                    'DELETE'               => 'eliminacion',
                    default                => null, // HEAD, OPTIONS
                };

                if ($accion === null) {
                    continue;
                }

                foreach ($rolesRuta as $rol) {
                    $matriz[$segmento][$rol][$accion] = true;
                }
            }
        }

        $modulos = [];
        foreach (self::MODULOS as $clave => $etiqueta) {
            $modulos[] = [
                'clave'    => $clave,
                'etiqueta' => $etiqueta,
                'permisos' => $matriz[$clave],
            ];
        }

        $roles = [];
        foreach (self::ROLES as $clave) {
            $roles[] = array_merge(['clave' => $clave], self::ROLES_INFO[$clave]);
        }

        return response()->json([
            'message' => 'Matriz de permisos generada a partir de las rutas de la API.',
            'data'    => [
                'roles'   => $roles,
                'modulos' => $modulos,
            ],
        ], 200);
    }

    // ═════════════════════════════════════════════════════════════
    //  Helpers privados
    // ═════════════════════════════════════════════════════════════

    /**
     * Roles que pueden llamar a una ruta según su middleware.
     * null → la ruta es pública (sin auth:sanctum).
     */
    private function rolesDeRuta(\Illuminate\Routing\Route $ruta): ?array
    {
        $middleware = collect($ruta->gatherMiddleware())->filter(fn ($m) => is_string($m));

        foreach ($middleware as $m) {
            if (str_starts_with($m, 'role:')) {
                return array_values(array_intersect(self::ROLES, explode(',', substr($m, 5))));
            }
        }

        return $middleware->contains('auth:sanctum') ? self::ROLES : null;
    }

    /**
     * Garantiza que exista al menos OTRO administrador activo y no
     * bloqueado. Debe llamarse dentro de DB::transaction(): el
     * lockForUpdate evita que dos admins se degraden a la vez y
     * dejen el sistema sin administrador.
     */
    private function asegurarOtroAdmin(User $objetivo): void
    {
        $otros = User::where('rol', 'admin')
            ->where('is_locked', false)
            ->where('id', '!=', $objetivo->id)
            ->lockForUpdate()
            ->pluck('id');

        if ($otros->isEmpty()) {
            throw new DomainException(
                'Debe existir al menos otro administrador activo. Asigna primero el rol de administrador a otra cuenta.'
            );
        }
    }

    /** Conteos para los chips del módulo (cuentas activas por rol, bloqueadas, inactivas). */
    private function resumen(): array
    {
        $porRol = User::select('rol', DB::raw('COUNT(*) as total'))
            ->groupBy('rol')
            ->pluck('total', 'rol');

        $conteoPorRol = [];
        foreach (self::ROLES as $rol) {
            $conteoPorRol[$rol] = (int) ($porRol[$rol] ?? 0);
        }

        return [
            'activos'    => array_sum($conteoPorRol),
            'por_rol'    => $conteoPorRol,
            'bloqueados' => User::where('is_locked', true)->count(),
            'inactivos'  => User::onlyTrashed()->count(),
        ];
    }

    private function respuestaUsuario(User $usuario, string $mensaje): JsonResponse
    {
        $actualizado = User::withTrashed()
            ->with('habitante:id,nombres,apellidos,cedula')
            ->findOrFail($usuario->id);

        return response()->json([
            'message' => $mensaje,
            'data'    => (new UsuarioAdminResource($actualizado))->resolve(),
        ], 200);
    }

    private function error(string $mensaje, string $campo, int $status = 422): JsonResponse
    {
        return response()->json([
            'message' => $mensaje,
            'errors'  => [$campo => [$mensaje]],
        ], $status);
    }
}

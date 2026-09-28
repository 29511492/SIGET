<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * UsuarioAdminResource — vista de un usuario para el módulo de
 * Configuración (solo admin).
 *
 * Es un Resource APARTE de UserResource a propósito: UserResource se
 * entrega a cualquier usuario al iniciar sesión y no debe exponer
 * campos de seguridad (bloqueo, intentos fallidos, cédula, baja).
 * WHITELIST explícita: password, otp_code y tokens nunca salen.
 */
class UsuarioAdminResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'name'            => $this->name,
            'email'           => $this->email,
            'cedula'          => $this->cedula,
            'rol'             => $this->rol,
            'activo'          => $this->deleted_at === null,
            'is_locked'       => (bool) $this->is_locked,
            'locked_at'       => $this->locked_at?->toDateTimeString(),
            'failed_attempts' => (int) $this->failed_attempts,
            'created_at'      => $this->created_at?->toDateString(),
            'desactivado_el'  => $this->deleted_at?->toDateString(),

            'habitante' => $this->whenLoaded('habitante', fn () => $this->habitante
                ? [
                    'id'        => $this->habitante->id,
                    'nombres'   => $this->habitante->nombres,
                    'apellidos' => $this->habitante->apellidos,
                    'cedula'    => $this->habitante->cedula,
                ]
                : null),
        ];
    }
}

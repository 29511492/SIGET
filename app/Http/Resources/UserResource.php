<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ═══════════════════════════════════════════════════════════════
 *  UserResource — Transforma el modelo User para el frontend
 * ───────────────────────────────────────────────────────────────
 *  WHITELIST explícita: solo los campos listados aquí llegarán
 *  al frontend. password, remember_token y tokens de Sanctum
 *  NUNCA se exponen, sin importar lo que tenga el modelo.
 *
 *  Se incluye el objeto `permisos` derivado del rol para que
 *  React pueda hacer renderizado condicional sin comparar
 *  strings de rol directamente en cada componente.
 * ═══════════════════════════════════════════════════════════════
 */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'    => $this->id,
            'name'  => $this->name,
            'email' => $this->email,
            'rol'   => $this->rol,

            // Permisos derivados — el frontend usa estos booleans
            // en lugar de comparar strings de rol directamente.
            'permisos' => [
                'puede_leer'           => true,
                'puede_escribir'       => in_array($this->rol, ['admin', 'operador'], true),
                'puede_eliminar'       => $this->rol === 'admin',
                'es_admin'             => $this->rol === 'admin',
                // Corrección 3 (sept-2026): admin y vocero validan pagos;
                // el operador se eliminará más adelante y no la gana.
                'puede_validar_pagos'  => in_array($this->rol, ['admin', 'vocero'], true),
                // Oct-2026 (georreferenciación): el mapa de calor lo ven admin y
                // vocero; crear encuestas, registrar entregas y asignar
                // coordenadas es solo del admin. El operador no recibe nada nuevo.
                'puede_ver_mapa'            => in_array($this->rol, ['admin', 'vocero'], true),
                'puede_gestionar_encuestas' => $this->rol === 'admin',
            ],

            // Habitante vinculado (si fue cargado con load('habitante'))
            'habitante' => $this->whenLoaded('habitante', fn () => [
                'id'       => $this->habitante->id,
                'nombres'  => $this->habitante->nombres,
                'apellidos'=> $this->habitante->apellidos,
                'cedula'   => $this->habitante->cedula,
            ]),

            'created_at' => $this->created_at?->toDateString(),
        ];
    }
}

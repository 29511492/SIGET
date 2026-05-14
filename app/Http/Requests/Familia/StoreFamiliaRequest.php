<?php

namespace App\Http\Requests\Familia;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * ═══════════════════════════════════════════════════════════════
 *  Validación del registro de familia
 * ───────────────────────────────────────────────────────────────
 *  PRINCIPIO SRP: La validación vive exclusivamente aquí.
 *  FamiliaController::store() asume datos ya válidos.
 *
 *  CAMPOS DEL FORMULARIO React → reglas de validación:
 *
 *  codigo_vivienda    → obligatorio, único en familias
 *  nombre_responsable → obligatorio
 *  calle_id           → obligatorio, debe existir en calles
 *  sede_id            → obligatorio, debe existir en sedes
 *  condicion_vivienda → obligatorio, solo valores del ENUM
 *  cantidad_bombonas  → obligatorio, entero >= 1
 *  capacidad_bombona  → obligatorio, solo valores del ENUM
 *  posee_agua_potable → obligatorio, boolean
 *  punto_referencia   → opcional
 * ═══════════════════════════════════════════════════════════════
 */
class StoreFamiliaRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Solo operadores y admins pueden registrar familias
        // (el AdminMiddleware ya protege la ruta — esto es una segunda barrera)
        return in_array($this->user()?->rol, ['admin', 'operador'], true);
    }

    public function rules(): array
    {
        return [
            'codigo_vivienda' => [
                'required',
                'string',
                'max:20',
                'unique:familias,codigo_vivienda', // Unicidad en PostgreSQL
            ],
            'nombre_responsable' => [
                'required',
                'string',
                'max:100',
            ],
            'sede_id' => [
                'required',
                'integer',
                'exists:sedes,id',  // Debe existir en la tabla sedes
            ],
            'calle_id' => [
                'required',
                'integer',
                'exists:calles,id', // Debe existir en la tabla calles
            ],
            'condicion_vivienda' => [
                'required',
                'string',
                'in:optima,regular,critica', // Solo los valores del ENUM
            ],
            'cantidad_bombonas' => [
                'required',
                'integer',
                'min:0',
                'max:99',
            ],
            'capacidad_bombona' => [
                'required',
                'string',
                'in:10kg,18kg,43kg', // Solo los valores del ENUM de la migración
            ],
            'posee_agua_potable' => [
                'required',
                'boolean',
            ],
            'punto_referencia' => [
                'nullable',
                'string',
                'max:255',
            ],
        ];
    }

    public function attributes(): array
    {
        return [
            'codigo_vivienda'    => 'código de vivienda',
            'nombre_responsable' => 'responsable de la familia',
            'sede_id'            => 'sede',
            'calle_id'           => 'calle',
            'condicion_vivienda' => 'condición de la vivienda',
            'cantidad_bombonas'  => 'cantidad de bombonas',
            'capacidad_bombona'  => 'capacidad de bombona',
            'posee_agua_potable' => 'agua potable',
            'punto_referencia'   => 'punto de referencia',
        ];
    }

    public function messages(): array
    {
        return [
            'codigo_vivienda.unique'       => 'Este código de vivienda ya está registrado.',
            'sede_id.exists'               => 'La sede seleccionada no existe.',
            'calle_id.exists'              => 'La calle seleccionada no existe.',
            'condicion_vivienda.in'        => 'La condición debe ser: óptima, regular o crítica.',
            'capacidad_bombona.in'         => 'La capacidad debe ser: 10kg, 18kg o 43kg.',
        ];
    }

    /**
     * CRÍTICO: Fuerza JSON en vez de redirect para la SPA React.
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(
            response()->json([
                'message' => 'Los datos proporcionados no son válidos.',
                'errors'  => $validator->errors(),
            ], 422)
        );
    }

    /**
     * CRÍTICO: Fuerza JSON en vez de redirect para fallos de autorización.
     */
    protected function failedAuthorization(): void
    {
        throw new HttpResponseException(
            response()->json([
                'message' => 'No tienes permiso para registrar familias.',
                'errors'  => [],
            ], 403)
        );
    }
}

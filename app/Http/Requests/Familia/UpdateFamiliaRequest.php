<?php

namespace App\Http\Requests\Familia;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

/**
 * ═══════════════════════════════════════════════════════════════
 *  UpdateFamiliaRequest — Corrección del Rule::unique
 * ───────────────────────────────────────────────────────────────
 *  CORRECCIÓN CRÍTICA — La causa más probable del error 500:
 *
 *  VERSIÓN ANTERIOR (frágil):
 *    $familiaId = $this->route('familia')?->id;
 *    Rule::unique('familias','codigo_vivienda')->ignore($familiaId)
 *
 *  PROBLEMA:
 *    $this->route('familia') devuelve el modelo resuelto por Route
 *    Model Binding. Si por cualquier razón (typo en la ruta, modelo
 *    no encontrado) devuelve null, entonces ->ignore(null) no ignora
 *    nada. El registro existente hace fallar la validación 'unique',
 *    pero failedValidation() relanza como HttpResponseException.
 *    Dependiendo de dónde falla, puede convertirse en un 500 en vez
 *    de un 422.
 *
 *  VERSIÓN CORREGIDA (robusta):
 *    Rule::unique('familias','codigo_vivienda')->ignore($this->route('familia'))
 *
 *    Cuando ->ignore() recibe un Model (no un ID entero), Laravel
 *    extrae automáticamente la PK del modelo. Esto es más seguro
 *    porque si el modelo no se resolvió, Route Model Binding ya
 *    habría devuelto 404 ANTES de que el Request se ejecute.
 *    Si llega aquí, el modelo existe y tiene ID válido.
 *
 *  DEFENSA ADICIONAL — whereNull('deleted_at'):
 *    Con SoftDeletes, puede existir un registro borrado con el mismo
 *    codigo_vivienda. Sin ->whereNull(), la validación 'unique'
 *    fallaría aunque el registro esté borrado lógicamente.
 *    Con ->whereNull(), solo compara contra registros activos.
 * ═══════════════════════════════════════════════════════════════
 */
class UpdateFamiliaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->rol, ['admin', 'operador'], true);
    }

    public function rules(): array
    {
        // $this->familia viene del Route Model Binding en la ruta
        // PUT/PATCH /api/v1/familias/{familia}
        $familia = $this->route('familia');

        return [
            'codigo_vivienda' => [
                'sometimes', 'required', 'string', 'max:20',
                Rule::unique('familias', 'codigo_vivienda')
                    ->ignore($familia)
                    ->whereNull('deleted_at'),
            ],

            'nombre_responsable' => ['sometimes', 'required', 'string', 'max:100'],
            'sede_id' => ['sometimes', 'required', 'integer', 'exists:sedes,id'],
            'calle_id' => ['sometimes', 'required', 'integer', 'exists:calles,id'],

            'condicion_vivienda' => [
                'sometimes',
                'required',
                'string',
                'in:optima,regular,critica',
            ],

            'cantidad_bombonas' => [
                'sometimes',
                'required',
                'integer',
                'min:0',
                'max:99',
            ],

            'capacidad_bombona' => [
                'sometimes',
                'required',
                'string',
                'in:10kg,18kg,43kg',
            ],

            'posee_agua_potable' => [
                'sometimes',
                'required',
                'boolean',
            ],

            'punto_referencia' => [
                'sometimes',
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
            'codigo_vivienda.unique' => 'Este código de vivienda ya pertenece a otra familia.',
            'sede_id.exists'         => 'La sede seleccionada no existe.',
            'calle_id.exists'        => 'La calle seleccionada no existe.',
            'condicion_vivienda.in'  => 'La condición debe ser: óptima, regular o crítica.',
            'capacidad_bombona.in'   => 'La capacidad debe ser: 10kg, 18kg o 43kg.',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(
            response()->json([
                'message' => 'Los datos proporcionados no son válidos.',
                'errors'  => $validator->errors(),
            ], 422)
        );
    }

    protected function failedAuthorization(): void
    {
        throw new HttpResponseException(
            response()->json([
                'message' => 'No tienes permiso para editar familias.',
                'errors'  => [],
            ], 403)
        );
    }
}

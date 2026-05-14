<?php

namespace App\Http\Requests\Vocero;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

/**
 * ═══════════════════════════════════════════════════════════════
 *  StoreVoceroRequest
 * ───────────────────────────────────────────────────────────────
 *  VALIDACIÓN CRÍTICA — habitante único en voceros activos:
 *
 *  Un habitante no puede ser vocero activo en dos cargos a la vez.
 *  La regla unique estándar de Laravel no permite condiciones
 *  adicionales (WHERE esta_activo = true), por eso usamos Rule::unique
 *  con ->where() para agregar esa condición.
 *
 *  Rule::unique('voceros','habitante_id')->where('esta_activo', true)
 *  → "habitante_id debe ser único en la tabla voceros,
 *     pero solo entre los registros donde esta_activo = true"
 *
 *  Esto permite que un habitante que fue vocero (inactivo) vuelva
 *  a ser registrado como vocero activo sin conflicto.
 * ═══════════════════════════════════════════════════════════════
 */
class StoreVoceroRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->rol, ['admin', 'operador'], true);
    }

    public function rules(): array
    {
        return [
            'habitante_id' => [
                'required',
                'integer',
                'exists:habitantes,id',
                // Un habitante solo puede tener UN cargo activo a la vez
                Rule::unique('voceros', 'habitante_id')
                    ->where(fn ($q) => $q->where('esta_activo', true)),
            ],
            'sede_id' => [
                'required',
                'integer',
                'exists:sedes,id',
            ],
            'comite_id' => [
                'nullable',
                'integer',
                'exists:comites,id',
            ],
            'unidad_comunal' => [
                'required',
                'string',
                'max:150',
            ],
            'fecha_eleccion' => [
                'required',
                'date_format:Y-m-d',
                'before_or_equal:today',
            ],
            'fecha_fin' => [
                'nullable',
                'date_format:Y-m-d',
                'after:fecha_eleccion',
            ],
            'esta_activo' => [
                'boolean',
            ],
        ];
    }

    public function attributes(): array
    {
        return [
            'habitante_id'   => 'habitante',
            'sede_id'        => 'sede',
            'comite_id'      => 'comité',
            'unidad_comunal' => 'unidad comunal',
            'fecha_eleccion' => 'fecha de elección',
            'fecha_fin'      => 'fecha de fin de mandato',
            'esta_activo'    => 'estado activo',
        ];
    }

    public function messages(): array
    {
        return [
            'habitante_id.unique'        => 'Este habitante ya tiene un cargo de vocero activo. Debe finalizar el mandato anterior antes de asignar uno nuevo.',
            'habitante_id.exists'        => 'El habitante seleccionado no existe en el padrón.',
            'sede_id.exists'             => 'La sede seleccionada no existe.',
            'comite_id.exists'           => 'El comité seleccionado no existe.',
            'fecha_eleccion.before_or_equal' => 'La fecha de elección no puede ser futura.',
            'fecha_fin.after'            => 'La fecha de fin debe ser posterior a la fecha de elección.',
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
                'message' => 'No tienes permiso para registrar voceros.',
                'errors'  => [],
            ], 403)
        );
    }
}

<?php

namespace App\Http\Requests\Vocero;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

/**
 * ═══════════════════════════════════════════════════════════════
 *  UpdateVoceroRequest
 * ───────────────────────────────────────────────────────────────
 *  DIFERENCIA vs StoreVoceroRequest:
 *  La regla unique del habitante_id debe ignorar al vocero actual
 *  para que el update del mismo cargo no falle por "duplicado".
 *
 *  Caso de uso: editar la unidad_comunal o la fecha_fin de un vocero
 *  sin cambiar el habitante → la regla unique pasaría sin ->ignore
 *  porque el habitante_id sigue existiendo en otra fila (la suya).
 *
 *  Con ->ignore($vocero), la regla dice:
 *  "habitante_id único entre voceros activos, EXCEPTO este vocero"
 * ═══════════════════════════════════════════════════════════════
 */
class UpdateVoceroRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->rol, ['admin', 'operador'], true);
    }

    public function rules(): array
    {
        $vocero = $this->route('vocero');

        return [
            'habitante_id' => [
                'sometimes',
                'required',
                'integer',
                'exists:habitantes,id',
                Rule::unique('voceros', 'habitante_id')
                    ->ignore($vocero)
                    ->where(fn ($q) => $q->where('esta_activo', true)),
            ],
            'sede_id' => [
                'sometimes', 'required', 'integer', 'exists:sedes,id',
            ],
            'comite_id' => [
                'sometimes', 'nullable', 'integer', 'exists:comites,id',
            ],
            'unidad_comunal' => [
                'sometimes', 'required', 'string', 'max:150',
            ],
            'fecha_eleccion' => [
                'sometimes', 'required', 'date_format:Y-m-d', 'before_or_equal:today',
            ],
            'fecha_fin' => [
                'sometimes', 'nullable', 'date_format:Y-m-d', 'after:fecha_eleccion',
            ],
            'esta_activo' => [
                'sometimes', 'boolean',
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
            'habitante_id.unique'    => 'Este habitante ya tiene otro cargo de vocero activo.',
            'fecha_fin.after'        => 'La fecha de fin debe ser posterior a la fecha de elección.',
            'fecha_eleccion.before_or_equal' => 'La fecha de elección no puede ser futura.',
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
                'message' => 'No tienes permiso para editar voceros.',
                'errors'  => [],
            ], 403)
        );
    }
}

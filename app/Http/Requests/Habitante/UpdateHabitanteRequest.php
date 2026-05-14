<?php

namespace App\Http\Requests\Habitante;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

/**
 * ═══════════════════════════════════════════════════════════════
 *  Validación de edición de habitante
 * ───────────────────────────────────────────────────────────────
 *  Misma lógica que UpdateFamiliaRequest:
 *  - 'sometimes' permite PATCH parcial
 *  - unique ignore para que la cédula propia no genere conflicto
 *  - required_if para tipo_discapacidad sigue aplicando
 * ═══════════════════════════════════════════════════════════════
 */
class UpdateHabitanteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->rol, ['admin', 'operador'], true);
    }

    public function rules(): array
    {
        $habitanteId = $this->route('habitante')?->id;

        return [
            'familia_id' => ['sometimes', 'required', 'integer', 'exists:familias,id'],
            'cedula'     => [
                'sometimes', 'nullable', 'string', 'max:15',
                Rule::unique('habitantes', 'cedula')->ignore($habitanteId)->whereNull('deleted_at'),
            ],
            'nombres'          => ['sometimes', 'required', 'string', 'max:100'],
            'apellidos'        => ['sometimes', 'required', 'string', 'max:100'],
            'fecha_nacimiento' => ['sometimes', 'required', 'date_format:Y-m-d', 'before:today', 'after:1900-01-01'],
            'sexo'             => ['sometimes', 'required', 'string', 'in:masculino,femenino,otro'],
            'es_discapacitado' => ['sometimes', 'required', 'boolean'],
            'tipo_discapacidad'=> [
                'sometimes', 'nullable', 'string', 'max:100',
                'required_if:es_discapacitado,true',
            ],
            'enfermedad_cronica' => ['sometimes', 'nullable', 'string', 'max:150'],
            'nivel_educativo'    => [
                'sometimes', 'required', 'string',
                'in:ninguno,primaria,bachillerato,tecnico,universitario,postgrado',
            ],
        ];
    }

    public function attributes(): array
    {
        return [
            'familia_id'        => 'familia',
            'cedula'            => 'cédula',
            'nombres'           => 'nombres',
            'apellidos'         => 'apellidos',
            'fecha_nacimiento'  => 'fecha de nacimiento',
            'sexo'              => 'sexo',
            'tipo_discapacidad' => 'tipo de discapacidad',
            'nivel_educativo'   => 'nivel educativo',
        ];
    }

    public function messages(): array
    {
        return [
            'cedula.unique'                 => 'Esta cédula ya pertenece a otro habitante registrado.',
            'tipo_discapacidad.required_if' => 'Debes describir el tipo de discapacidad.',
            'fecha_nacimiento.before'       => 'La fecha de nacimiento no puede ser futura.',
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
                'message' => 'No tienes permiso para editar habitantes.',
                'errors'  => [],
            ], 403)
        );
    }
}

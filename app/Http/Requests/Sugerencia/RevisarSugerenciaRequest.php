<?php

namespace App\Http\Requests\Sugerencia;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * RevisarSugerenciaRequest
 *
 * Valida la acción de marcar una sugerencia como revisada.
 * La respuesta es opcional — se puede marcar revisada sin responder,
 * pero si se incluye respuesta debe tener contenido significativo.
 */
class RevisarSugerenciaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'respuesta' => ['nullable', 'string', 'min:5', 'max:500'],
            'prioridad' => ['sometimes', 'in:baja,media,alta'],
        ];
    }

    public function messages(): array
    {
        return [
            'respuesta.min' => 'La respuesta debe tener al menos 5 caracteres.',
            'respuesta.max' => 'La respuesta no puede superar los 500 caracteres.',
            'prioridad.in'  => 'La prioridad seleccionada no es válida.',
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
            response()->json(['message' => 'No autorizado.'], 403)
        );
    }
}

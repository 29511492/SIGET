<?php

namespace App\Http\Requests\Sugerencia;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * StoreSugerenciaRequest
 *
 * Valida el envío de una nueva sugerencia.
 * Cualquier rol autenticado puede enviar sugerencias.
 */
class StoreSugerenciaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'mensaje'   => ['required', 'string', 'min:10', 'max:1000'],
            'categoria' => ['required', 'in:mejora,queja,consulta,emergencia'],
            'prioridad' => ['sometimes', 'in:baja,media,alta'],
        ];
    }

    public function messages(): array
    {
        return [
            'mensaje.required'  => 'El mensaje es obligatorio.',
            'mensaje.min'       => 'El mensaje debe tener al menos 10 caracteres.',
            'mensaje.max'       => 'El mensaje no puede superar los 1000 caracteres.',
            'categoria.required'=> 'Debes seleccionar una categoría.',
            'categoria.in'      => 'La categoría seleccionada no es válida.',
            'prioridad.in'      => 'La prioridad seleccionada no es válida.',
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

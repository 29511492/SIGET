<?php

namespace App\Http\Requests\Noticia;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * StoreNoticiaRequest
 *
 * Valida la creación de una nueva noticia.
 * failedValidation() y failedAuthorization() sobrescritos
 * obligatoriamente para retornar JSON en la API REST stateless.
 */
class StoreNoticiaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // La autorización la maneja el middleware role:
    }

    public function rules(): array
    {
        return [
            'titulo'    => ['required', 'string', 'max:200'],
            'contenido' => ['required', 'string'],
            'publicado' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'titulo.required'    => 'El título de la noticia es obligatorio.',
            'titulo.max'         => 'El título no puede superar los 200 caracteres.',
            'contenido.required' => 'El contenido de la noticia es obligatorio.',
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

<?php

namespace App\Http\Requests\Noticia;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * UpdateNoticiaRequest
 *
 * Valida la actualización de una noticia existente.
 * Idéntico al Store pero con 'sometimes' para permitir
 * actualizaciones parciales (solo cambiar publicado, por ejemplo).
 */
class UpdateNoticiaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'titulo'    => ['sometimes', 'required', 'string', 'max:200'],
            'contenido' => ['sometimes', 'required', 'string'],
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

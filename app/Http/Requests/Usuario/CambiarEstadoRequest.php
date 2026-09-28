<?php

namespace App\Http\Requests\Usuario;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Activar / desactivar una cuenta — PATCH /api/v1/usuarios/{usuario}/estado
 * Body: { "activo": true|false }. Solo admin.
 */
class CambiarEstadoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->esAdmin();
    }

    public function rules(): array
    {
        return [
            'activo' => ['required', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'activo.required' => 'Debes indicar si la cuenta queda activa o desactivada.',
            'activo.boolean'  => 'El estado indicado no es válido.',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'message' => 'Los datos proporcionados no son válidos.',
            'errors'  => $validator->errors(),
        ], 422));
    }

    protected function failedAuthorization(): void
    {
        throw new HttpResponseException(response()->json([
            'message' => 'No tienes permiso para realizar esta acción.',
            'errors'  => [],
        ], 403));
    }
}

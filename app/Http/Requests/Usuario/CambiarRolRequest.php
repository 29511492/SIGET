<?php

namespace App\Http\Requests\Usuario;

use App\Http\Controllers\Api\V1\UsuarioController;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

/**
 * Cambio de rol de un usuario — PATCH /api/v1/usuarios/{usuario}/rol
 * Solo admin. Las reglas de negocio (no cambiarse a sí mismo, último
 * admin) viven en UsuarioController porque dependen del estado de la BD.
 */
class CambiarRolRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->esAdmin();
    }

    public function rules(): array
    {
        return [
            'rol' => ['required', 'string', Rule::in(UsuarioController::ROLES)],
        ];
    }

    public function messages(): array
    {
        return [
            'rol.required' => 'Debes indicar el nuevo rol.',
            'rol.in'       => 'El rol indicado no es válido.',
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

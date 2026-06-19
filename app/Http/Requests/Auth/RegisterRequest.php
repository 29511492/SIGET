<?php
/// ─── Validación de registro ──────────────────────────────────────
/**
 *  Este FormRequest valida los datos de registro de un nuevo usuario.
 *  Se asegura de que el nombre, cédula, correo y contraseña cumplan
 *  con los requisitos y que la cédula y correo sean únicos.
 *  Si la validación falla, retorna un JSON con los errores.
 */
namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Ruta pública
    }

    public function rules(): array
    {
        return [
            'name'     => ['required', 'string', 'max:100'],
            'cedula'   => ['required', 'string', 'max:20', 'unique:users,cedula'],
            'email'    => ['required', 'email', 'max:150', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            // password_confirmation se valida automáticamente con 'confirmed'
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'      => 'El nombre es obligatorio.',
            'cedula.required'    => 'La cédula es obligatoria.',
            'cedula.unique'      => 'Esta cédula ya está registrada.',
            'email.required'     => 'El correo electrónico es obligatorio.',
            'email.unique'       => 'Este correo ya está registrado.',
            'password.required'  => 'La contraseña es obligatoria.',
            'password.min'       => 'La contraseña debe tener al menos 8 caracteres.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'message' => 'Error de validación.',
            'errors'  => $validator->errors(),
        ], 422));
    }
}

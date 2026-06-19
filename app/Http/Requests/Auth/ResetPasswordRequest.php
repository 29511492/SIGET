<?php
//Para vereificar OTP y resetear contraseña
/**
 *  Este FormRequest valida los datos para restablecer la contraseña.
 *  Se asegura de que el correo electrónico sea válido, que el OTP
 *  tenga el formato correcto y que la nueva contraseña cumpla con los requisitos.
 *  Si la validación falla, retorna un JSON con los errores.
 */
namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class ResetPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email'    => ['required', 'email', 'exists:users,email'],
            'otp'      => ['required', 'string', 'size:6'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required'     => 'El correo electrónico es obligatorio.',
            'email.exists'       => 'No encontramos una cuenta con ese correo.',
            'otp.required'       => 'El código de verificación es obligatorio.',
            'otp.size'           => 'El código debe tener exactamente 6 dígitos.',
            'password.required'  => 'La nueva contraseña es obligatoria.',
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

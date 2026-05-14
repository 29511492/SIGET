<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * ═══════════════════════════════════════════════════════════════
 *  LoginRequest — Validación del formulario de login
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA — SRP (Single Responsibility Principle):
 *  La validación es responsabilidad exclusiva del Form Request.
 *  El controlador asume que los datos que recibe ya son válidos.
 *
 *  TRUCO CRÍTICO PARA APIs:
 *  Por defecto, si la validación falla en una ruta web, Laravel
 *  hace redirect de vuelta. En una API/SPA React eso devuelve
 *  un 302 que React no puede procesar.
 *  La solución es sobreescribir failedValidation() para forzar
 *  siempre una respuesta JSON 422.
 * ═══════════════════════════════════════════════════════════════
 */
class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Cualquiera puede intentar hacer login
    }

    public function rules(): array
    {
        return [
            'email'    => ['required', 'string', 'email', 'max:150'],
            'password' => ['required', 'string', 'min:8',  'max:100'],
        ];
    }

    /**
     * Nombres de atributos en español para los mensajes de error.
     */
    public function attributes(): array
    {
        return [
            'email'    => 'correo electrónico',
            'password' => 'contraseña',
        ];
    }

    /**
     * Mensajes de error personalizados.
     */
    public function messages(): array
    {
        return [
            'email.required'    => 'El correo electrónico es obligatorio.',
            'email.email'       => 'Ingresa un correo electrónico válido.',
            'password.required' => 'La contraseña es obligatoria.',
            'password.min'      => 'La contraseña debe tener al menos :min caracteres.',
        ];
    }

    /**
     * CRÍTICO: Fuerza respuesta JSON en vez de redirect HTML.
     * Sin este método, React recibe un 302 en lugar de un 422.
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(
            response()->json([
                'message' => 'Los datos proporcionados no son válidos.',
                'errors'  => $validator->errors(),
            ], 422)
        );
    }
}

<?php

namespace App\Http\Requests\CuentaPago;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * StoreCuentaPagoRequest
 * Ruta física: app/Http/Requests/CuentaPago/StoreCuentaPagoRequest.php
 *
 * Solo admin/operador pueden crear cuentas de pago (Capa 3 en api.php,
 * el middleware de rol ya filtra el acceso antes de llegar aquí).
 */
class StoreCuentaPagoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre_servicio' => ['required', 'string', 'max:100'],
            'banco'           => ['required', 'string', 'max:100'],
            'telefono'        => ['required', 'string', 'max:20'],
            'cedula_rif'      => ['required', 'string', 'max:20'],
            'titular'         => ['required', 'string', 'max:150'],
            'descripcion'     => ['nullable', 'string', 'max:500'],
            'activa'          => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre_servicio.required' => 'El nombre del servicio es obligatorio.',
            'banco.required'           => 'El banco es obligatorio.',
            'telefono.required'        => 'El número de teléfono es obligatorio.',
            'cedula_rif.required'      => 'La cédula o RIF es obligatoria.',
            'titular.required'         => 'El nombre del titular es obligatorio.',
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

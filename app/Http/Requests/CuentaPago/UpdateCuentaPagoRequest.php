<?php

namespace App\Http\Requests\CuentaPago;

use App\Models\CuentaPago;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

/**
 * UpdateCuentaPagoRequest
 * Ruta física: app/Http/Requests/CuentaPago/UpdateCuentaPagoRequest.php
 *
 * Mismas reglas que Store — todos los campos son editables.
 *
 * CAMBIO (sept-2026, corrección 2 del profesor: proceso de pago) —
 * mismo condicional por `metodo` que en Store (ver ese archivo).
 */
class UpdateCuentaPagoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre_servicio' => ['required', 'string', 'max:100'],
            'metodo'          => ['required', 'string', Rule::in(CuentaPago::METODOS)],
            'banco'           => ['required', 'string', 'max:100'],
            'telefono'        => ['required_if:metodo,pago_movil', 'nullable', 'string', 'max:20'],
            'numero_cuenta'   => ['required_if:metodo,transferencia', 'nullable', 'string', 'max:20'],
            'cedula_rif'      => ['required', 'string', 'max:20'],
            'titular'         => ['required', 'string', 'max:150'],
            'descripcion'     => ['nullable', 'string', 'max:500'],
            'activa'          => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre_servicio.required'  => 'El nombre del servicio es obligatorio.',
            'metodo.required'           => 'Debes indicar el método de pago.',
            'metodo.in'                 => 'El método de pago no es válido.',
            'banco.required'            => 'El banco es obligatorio.',
            'telefono.required_if'      => 'El teléfono es obligatorio para pago móvil.',
            'numero_cuenta.required_if' => 'El número de cuenta es obligatorio para transferencia.',
            'cedula_rif.required'       => 'La cédula o RIF es obligatoria.',
            'titular.required'          => 'El nombre del titular es obligatorio.',
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

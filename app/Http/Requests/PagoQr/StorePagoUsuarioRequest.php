<?php

namespace App\Http\Requests\PagoQr;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * StorePagoUsuarioRequest — SIGET
 * Ruta física: app/Http/Requests/PagoQr/StorePagoUsuarioRequest.php
 *
 * Usado exclusivamente por PagoQrController::storeUsuario() —
 * el endpoint del Portal Ciudadano (POST /v1/pagos/mio).
 *
 * Diferencias respecto a StorePagoQrRequest (flujo admin/operador):
 *   - NO requiere habitante_id ni familia_id — el pago se vincula
 *     directamente al usuario autenticado vía user_id en el controlador.
 *   - El comprobante es OBLIGATORIO aquí (en el flujo admin es opcional,
 *     porque el operador puede registrar el pago primero y subir el
 *     comprobante después). El ciudadano siempre debe adjuntarlo,
 *     porque es su única prueba de pago.
 */
class StorePagoUsuarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null; // cualquier rol autenticado
    }

    public function rules(): array
    {
        return [
            'referencia_bancaria' => ['required', 'string', 'max:100', 'unique:pagos_qr,referencia_bancaria'],
            'monto'               => ['required', 'numeric', 'min:0.01', 'max:999999.99'],
            'concepto_pago'       => ['required', 'string', 'max:200'],
            'fecha_pago'          => ['required', 'date', 'before_or_equal:now'],
            // Comprobante obligatorio para el ciudadano
            'comprobante'         => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
    }

    public function messages(): array
    {
        return [
            'referencia_bancaria.required' => 'Debes indicar el número de referencia del pago.',
            'referencia_bancaria.unique'   => 'Esta referencia bancaria ya fue registrada.',
            'monto.required'               => 'Debes indicar el monto pagado.',
            'monto.min'                    => 'El monto debe ser mayor a cero.',
            'concepto_pago.required'       => 'Debes indicar el concepto del pago.',
            'comprobante.required'         => 'Debes adjuntar una imagen del comprobante de pago.',
            'comprobante.mimes'            => 'El comprobante debe ser una imagen JPG, PNG o WEBP.',
            'comprobante.max'              => 'El comprobante no puede superar los 5 MB.',
            'fecha_pago.before_or_equal'   => 'La fecha del pago no puede ser futura.',
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

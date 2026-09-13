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
 * FIX (Fase 3 — junio 2026): 'cuenta_pago_id' ahora es OBLIGATORIO.
 * El usuario debe elegir a qué cuenta de pago (servicio) corresponde
 * su pago antes de poder enviar el comprobante. Esto reemplaza la
 * dependencia exclusiva del texto libre en 'concepto_pago' para
 * identificar el servicio, y vincula formalmente cada pago a una
 * cuenta real gestionada por el admin/operador.
 *
 * 'exists:cuentas_pago,id,activa,1' valida que la cuenta exista Y
 * esté activa — evita que alguien envíe un pago a una cuenta que el
 * admin desactivó después de que el usuario cargó la página.
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
            'cuenta_pago_id'      => ['required', 'integer', 'exists:cuentas_pago,id,activa,1'],
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
            'cuenta_pago_id.required' => 'Debes seleccionar a qué cuenta de pago corresponde tu pago.',
            'cuenta_pago_id.exists'   => 'La cuenta de pago seleccionada no es válida o ya no está disponible.',
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

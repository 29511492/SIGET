<?php

namespace App\Http\Requests\PagoQr;

use Illuminate\Foundation\Http\FormRequest;

/**
 * StorePagoQrRequest — SIGET
 * Ruta física: app/Http/Requests/PagoQr/StorePagoQrRequest.php
 *
 * Cualquier usuario autenticado puede registrar un pago.
 * La imagen del comprobante es opcional al crear — puede subirse
 * después. El operador la revisará en el panel de validación.
 */
class StorePagoQrRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;  // cualquier rol autenticado
    }

    public function rules(): array
    {
        return [
            'habitante_id'        => ['required', 'integer', 'exists:habitantes,id'],
            'familia_id'          => ['nullable', 'integer', 'exists:familias,id'],
            'organizacion_id'     => ['nullable', 'integer', 'exists:organizaciones,id'],
            'referencia_bancaria' => ['required', 'string', 'max:100', 'unique:pagos_qr,referencia_bancaria'],
            'monto'               => ['required', 'numeric', 'min:0.01', 'max:999999.99'],
            'concepto_pago'       => ['required', 'string', 'max:200'],
            'fecha_pago'          => ['required', 'date', 'before_or_equal:now'],
            // Comprobante: imagen JPG/PNG/WEBP máx. 5 MB
            'comprobante'         => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
    }

    public function messages(): array
    {
        return [
            'referencia_bancaria.unique' => 'Esta referencia bancaria ya fue registrada.',
            'monto.min'                  => 'El monto debe ser mayor a cero.',
            'comprobante.mimes'          => 'El comprobante debe ser una imagen JPG, PNG o WEBP.',
            'comprobante.max'            => 'El comprobante no puede superar los 5 MB.',
            'fecha_pago.before_or_equal' => 'La fecha del pago no puede ser futura.',
        ];
    }
}

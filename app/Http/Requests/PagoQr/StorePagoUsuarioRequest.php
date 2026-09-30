<?php

namespace App\Http\Requests\PagoQr;

use App\Models\CuentaPago;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

/**
 * StorePagoUsuarioRequest — SIGET
 * Ruta física: app/Http/Requests/PagoQr/StorePagoUsuarioRequest.php
 *
 * Usado exclusivamente por PagoQrController::storeUsuario() —
 * el endpoint del Portal Ciudadano (POST /v1/pagos/mio).
 *
 * 'exists:cuentas_pago,id,activa,1' valida que la cuenta exista Y
 * esté activa — evita que alguien envíe un pago a una cuenta que el
 * admin desactivó después de que el usuario cargó la página.
 *
 * CAMBIO (sept-2026, corrección 2 del profesor: proceso de pago) —
 * El asistente por pasos del Portal Ciudadano ahora envía también
 * `metodo_pago` (el método que el ciudadano eligió en el paso 1) y
 * `banco_origen` (obligatorio solo para transferencia, para que el
 * operador pueda conciliar). `metodo_pago` DEBE coincidir con el
 * método real de la cuenta elegida — withValidator() lo comprueba
 * después de las reglas básicas, para no confiar en lo que mandó el
 * cliente si no coincide con lo que el admin configuró.
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
            'metodo_pago'         => ['required', 'string', Rule::in(CuentaPago::METODOS)],
            'banco_origen'        => ['required_if:metodo_pago,transferencia', 'nullable', 'string', 'max:100'],
            'referencia_bancaria' => ['required', 'string', 'max:100', 'unique:pagos_qr,referencia_bancaria'],
            'monto'               => ['required', 'numeric', 'min:0.01', 'max:999999.99'],
            'concepto_pago'       => ['required', 'string', 'max:200'],
            'fecha_pago'          => ['required', 'date', 'before_or_equal:now', 'after_or_equal:' . now()->subDays(30)->toDateString()],
            // Comprobante obligatorio para el ciudadano
            'comprobante'         => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
    }

    /**
     * El método declarado por el cliente debe coincidir con el método
     * REAL de la cuenta elegida. Sin esto, alguien podría marcar
     * "transferencia" sobre una cuenta de pago móvil (o viceversa) y
     * el operador vería datos inconsistentes al conciliar.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $cuentaId = $this->input('cuenta_pago_id');
            $metodo   = $this->input('metodo_pago');

            if (! $cuentaId || ! $metodo) {
                return; // ya lo marcó 'required'
            }

            $cuenta = CuentaPago::find($cuentaId);

            if ($cuenta && $cuenta->metodo !== $metodo) {
                $validator->errors()->add(
                    'metodo_pago',
                    'El método de pago no corresponde a la cuenta seleccionada.'
                );
            }
        });
    }

    public function messages(): array
    {
        return [
            'cuenta_pago_id.required'      => 'Debes seleccionar a qué cuenta de pago corresponde tu pago.',
            'cuenta_pago_id.exists'        => 'La cuenta de pago seleccionada no es válida o ya no está disponible.',
            'metodo_pago.required'         => 'Debes indicar el método de pago.',
            'metodo_pago.in'               => 'El método de pago no es válido.',
            'banco_origen.required_if'     => 'Debes indicar desde qué banco realizaste la transferencia.',
            'referencia_bancaria.required' => 'Debes indicar el número de referencia del pago.',
            'referencia_bancaria.unique'   => 'Esta referencia bancaria ya fue registrada.',
            'monto.required'               => 'Debes indicar el monto pagado.',
            'monto.min'                    => 'El monto debe ser mayor a cero.',
            'concepto_pago.required'       => 'Debes indicar el concepto del pago.',
            'comprobante.required'         => 'Debes adjuntar una imagen del comprobante de pago.',
            'comprobante.mimes'            => 'El comprobante debe ser una imagen JPG, PNG o WEBP.',
            'comprobante.max'              => 'El comprobante no puede superar los 5 MB.',
            'fecha_pago.before_or_equal'   => 'La fecha del pago no puede ser futura.',
            'fecha_pago.after_or_equal'    => 'La fecha del pago no puede tener más de 30 días de antigüedad.',
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

<?php

namespace App\Http\Requests\PagoQr;

use App\Models\CuentaPago;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

/**
 * StorePagoQrRequest — SIGET
 * Ruta física: app/Http/Requests/PagoQr/StorePagoQrRequest.php
 *
 * Usado por PagoQrController::store() — POST /v1/pagos, el flujo de
 * admin/operador: registrar un pago A NOMBRE DE UN HABITANTE (el
 * ciudadano sin usuario en el Portal, o que pagó en persona).
 *
 * CAMBIO (oct-2026, PagoForm por pasos): este request quedó alineado
 * con StorePagoUsuarioRequest (Portal Ciudadano):
 *   - cuenta_pago_id y metodo_pago son obligatorios, y el método debe
 *     coincidir con el REAL de la cuenta elegida. Antes no se enviaban
 *     y la columna caía al default 'pago_movil': toda transferencia
 *     registrada por el admin quedaba guardada como "Pago móvil".
 *   - banco_origen es obligatorio solo para transferencia.
 *   - el comprobante es obligatorio y la fecha no puede tener más de
 *     30 días de antigüedad (mismas reglas que el Portal).
 *   - familia_id y organizacion_id ya NO se aceptan del cliente:
 *     familia_id se deduce del habitante en el servidor.
 *   - habitante_id debe existir y NO estar dado de baja.
 *
 * authorize(): defensa en profundidad además del middleware de la ruta
 * (Capa 3). Al eliminar el rol operador (14.7-E), dejar solo 'admin'.
 */
class StorePagoQrRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->rol, ['admin', 'operador'], true);
    }

    public function rules(): array
    {
        return [
            // 'deleted_at,NULL': un habitante dado de baja no puede recibir pagos nuevos
            'habitante_id'        => ['required', 'integer', 'exists:habitantes,id,deleted_at,NULL'],
            // cuenta existente, activa y no dada de baja
            'cuenta_pago_id'      => ['required', 'integer', 'exists:cuentas_pago,id,activa,1,deleted_at,NULL'],
            'metodo_pago'         => ['required', 'string', Rule::in(CuentaPago::METODOS)],
            'banco_origen'        => ['required_if:metodo_pago,transferencia', 'nullable', 'string', 'max:100'],
            'referencia_bancaria' => ['required', 'string', 'max:100', 'unique:pagos_qr,referencia_bancaria'],
            'monto'               => ['required', 'numeric', 'min:0.01', 'max:999999.99'],
            'concepto_pago'       => ['required', 'string', 'max:200'],
            'fecha_pago'          => ['required', 'date', 'before_or_equal:now', 'after_or_equal:' . now()->subDays(30)->toDateString()],
            // Comprobante obligatorio: imagen JPG/PNG/WEBP máx. 5 MB
            'comprobante'         => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
    }

    /**
     * El método declarado debe coincidir con el método REAL de la
     * cuenta elegida: no se confía en lo que mande el cliente.
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
            'habitante_id.required'        => 'Debes seleccionar el habitante que realizó el pago.',
            'habitante_id.exists'          => 'El habitante seleccionado no existe o fue dado de baja.',
            'cuenta_pago_id.required'      => 'Debes seleccionar la cuenta de pago a la que corresponde el pago.',
            'cuenta_pago_id.exists'        => 'La cuenta de pago seleccionada no es válida o ya no está disponible.',
            'metodo_pago.required'         => 'Debes indicar el método de pago.',
            'metodo_pago.in'               => 'El método de pago no es válido.',
            'banco_origen.required_if'     => 'Debes indicar desde qué banco se realizó la transferencia.',
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

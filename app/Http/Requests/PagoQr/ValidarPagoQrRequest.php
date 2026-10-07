<?php

namespace App\Http\Requests\PagoQr;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Solo admin y vocero pueden validar pagos.
 *
 * CAMBIO (sept-2026, corrección 3 del profesor: seguridad de roles) —
 * antes usaba esOperador() (admin+operador), lo que contradecía la
 * tabla de roles del documento y dejaba fuera al vocero. El operador
 * se eliminará más adelante, así que no se le agrega esta capacidad
 * ahora. Ver User::puedeValidarPagos().
 *
 * Si el estado es 'rechazado', el motivo_rechazo es obligatorio.
 */
class ValidarPagoQrRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->puedeValidarPagos() ?? false; // admin + vocero
    }

    public function rules(): array
    {
        return [
            'estado'          => ['required', Rule::in(['verificado', 'rechazado'])],
            'motivo_rechazo'  => [
                Rule::requiredIf($this->input('estado') === 'rechazado'),
                'nullable', 'string', 'max:255',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'estado.in'               => 'El estado debe ser verificado o rechazado.',
            'motivo_rechazo.required' => 'Debes indicar el motivo del rechazo.',
        ];
    }

    protected function failedAuthorization(): never
    {
        throw new \Illuminate\Auth\Access\AuthorizationException(
            'Solo operadores y administradores pueden validar pagos.'
        );
    }
}

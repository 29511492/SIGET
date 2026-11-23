<?php

namespace App\Http\Requests\Encuesta;

use App\Models\Encuesta;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

class StoreEncuestaRequest extends FormRequest
{
    /** Crear campañas es exclusivo del admin (defensa en profundidad: la ruta ya filtra por rol). */
    public function authorize(): bool
    {
        return $this->user()?->esAdmin() === true;
    }

    public function rules(): array
    {
        return [
            'nombre'       => ['required', 'string', 'max:150'],
            'tipo'         => ['required', 'string', Rule::in(Encuesta::TIPOS)],
            'descripcion'  => ['nullable', 'string', 'max:1000'],
            // Las encuestas de pago exigen servicio y período; las demás no admiten cuenta.
            'cuenta_pago_id' => [
                Rule::requiredIf(fn () => $this->input('tipo') === Encuesta::TIPO_PAGO),
                'prohibited_unless:tipo,' . Encuesta::TIPO_PAGO,
                'nullable',
                'integer',
                Rule::exists('cuentas_pago', 'id')->whereNull('deleted_at'),
            ],
            'fecha_inicio' => [
                Rule::requiredIf(fn () => $this->input('tipo') === Encuesta::TIPO_PAGO),
                'nullable',
                'date',
            ],
            'fecha_cierre' => [
                Rule::requiredIf(fn () => $this->input('tipo') === Encuesta::TIPO_PAGO),
                'nullable',
                'date',
                'after_or_equal:fecha_inicio',
            ],
            'activa'       => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'tipo.in'                      => 'El tipo de encuesta no es válido.',
            'cuenta_pago_id.required'      => 'Selecciona el servicio cuyos pagos se van a controlar.',
            'cuenta_pago_id.exists'        => 'El servicio seleccionado no existe o fue dado de baja.',
            'cuenta_pago_id.prohibited_unless' => 'Solo las encuestas de pagos de un servicio llevan cuenta de pago.',
            'fecha_inicio.required'        => 'Indica desde qué fecha se cuentan los pagos.',
            'fecha_cierre.required'        => 'Indica hasta qué fecha se cuentan los pagos.',
            'fecha_cierre.after_or_equal'  => 'La fecha de cierre no puede ser anterior a la de inicio.',
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(response()->json([
            'message' => 'Los datos proporcionados no son válidos.',
            'errors'  => $validator->errors(),
        ], 422));
    }

    protected function failedAuthorization()
    {
        throw new HttpResponseException(response()->json([
            'message' => 'No tiene autorización para esta acción.',
        ], 403));
    }
}

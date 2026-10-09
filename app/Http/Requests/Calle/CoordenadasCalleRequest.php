<?php

namespace App\Http\Requests\Calle;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Asignar el punto de una calle en el mapa. Solo admin.
 *
 * Los rangos están acotados a una caja que cubre el estado Miranda
 * (la comuna está en Guacaipuro, ~10.34 N, -67.04 O). Es una red de
 * seguridad: un clic fuera de lugar o un valor manipulado no puede
 * mandar una calle a otro continente. Si el consejo se ampliara a
 * otra zona, se ajustan estas constantes.
 */
class CoordenadasCalleRequest extends FormRequest
{
    public const LAT_MIN = 9.8;
    public const LAT_MAX = 10.8;
    public const LNG_MIN = -67.8;
    public const LNG_MAX = -65.4;

    public function authorize(): bool
    {
        return $this->user()?->esAdmin() === true;
    }

    public function rules(): array
    {
        return [
            'latitud'  => ['required', 'numeric', 'between:' . self::LAT_MIN . ',' . self::LAT_MAX],
            'longitud' => ['required', 'numeric', 'between:' . self::LNG_MIN . ',' . self::LNG_MAX],
        ];
    }

    public function messages(): array
    {
        return [
            'latitud.between'  => 'La latitud queda fuera de la zona del estado Miranda.',
            'longitud.between' => 'La longitud queda fuera de la zona del estado Miranda.',
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

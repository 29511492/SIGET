<?php

namespace App\Http\Requests\Beneficio;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class UpdateBeneficioRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'nombre_beneficio' => ['sometimes', 'required', 'string', 'max:200'],
            'fecha_entrega'    => ['sometimes', 'required', 'date'],
            'observaciones'    => ['nullable', 'string', 'max:500'],
        ];
    }

    protected function failedValidation(Validator $validator): never
    {
        throw new HttpResponseException(
            response()->json(['message' => 'Error de validación.', 'errors' => $validator->errors()], 422)
        );
    }
}

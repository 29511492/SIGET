<?php

namespace App\Http\Requests\Beneficio;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreBeneficioRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'familia_id'        => ['required', 'integer', 'exists:familias,id'],
            'nombre_beneficio'  => ['required', 'string', 'max:200'],
            'fecha_entrega'     => ['required', 'date'],
            'observaciones'     => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'familia_id.required'       => 'Debes seleccionar una familia.',
            'familia_id.exists'         => 'La familia seleccionada no existe.',
            'nombre_beneficio.required' => 'El nombre del beneficio es obligatorio.',
            'fecha_entrega.required'    => 'La fecha de entrega es obligatoria.',
        ];
    }

    protected function failedValidation(Validator $validator): never
    {
        throw new HttpResponseException(
            response()->json(['message' => 'Error de validación.', 'errors' => $validator->errors()], 422)
        );
    }
}

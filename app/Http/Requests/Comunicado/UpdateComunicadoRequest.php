<?php

namespace App\Http\Requests\Comunicado;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class UpdateComunicadoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'destinatario'       => ['sometimes', 'required', 'string', 'max:200'],
            'cargo_destinatario' => ['nullable', 'string', 'max:150'],
            'asunto'             => ['sometimes', 'required', 'string', 'max:300'],
            'cuerpo'             => ['sometimes', 'required', 'string', 'min:10'],
            'estado'             => ['sometimes', 'in:borrador,enviado,archivado'],
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'message' => 'Error de validación.',
            'errors'  => $validator->errors(),
        ], 422));
    }

    protected function failedAuthorization(): void
    {
        throw new HttpResponseException(response()->json([
            'message' => 'No tienes permiso para realizar esta acción.',
        ], 403));
    }
}

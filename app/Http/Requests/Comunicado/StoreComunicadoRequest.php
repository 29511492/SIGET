<?php

namespace App\Http\Requests\Comunicado;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreComunicadoRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Solo admin y operador pueden crear comunicados (capa 3 RBAC)
        return true; // El middleware de ruta ya filtra por rol
    }

    public function rules(): array
    {
        return [
            'destinatario'       => ['required', 'string', 'max:200'],
            'cargo_destinatario' => ['nullable', 'string', 'max:150'],
            'asunto'             => ['required', 'string', 'max:300'],
            'cuerpo'             => ['required', 'string', 'min:10'],
            'estado'             => ['sometimes', 'in:borrador,enviado,archivado'],
        ];
    }

    public function messages(): array
    {
        return [
            'destinatario.required'  => 'El destinatario es obligatorio.',
            'destinatario.max'       => 'El destinatario no puede superar 200 caracteres.',
            'asunto.required'        => 'El asunto es obligatorio.',
            'asunto.max'             => 'El asunto no puede superar 300 caracteres.',
            'cuerpo.required'        => 'El cuerpo del comunicado es obligatorio.',
            'cuerpo.min'             => 'El cuerpo debe tener al menos 10 caracteres.',
            'estado.in'              => 'El estado debe ser: borrador, enviado o archivado.',
        ];
    }

    // ─── Forzar respuesta JSON (crítico para SPA React) ────────────────────────

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

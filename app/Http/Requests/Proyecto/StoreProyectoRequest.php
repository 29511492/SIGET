<?php

namespace App\Http\Requests\Proyecto;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreProyectoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre_proyecto'       => ['required', 'string', 'max:200'],
            'objetivo'              => ['required', 'string'],
            'monto_aprobado'        => ['nullable', 'numeric', 'min:0', 'max:9999999999999.99'],
            'fuente_financiamiento' => ['required', 'in:CFG,Alcaldia,Gobernacion,Autogestion'],
            'estatus'               => ['required', 'in:presentado,aprobado,en_ejecucion,finalizado,paralizado'],
            'fecha_inicio'          => ['nullable', 'date'],
            'fecha_fin'             => ['nullable', 'date', 'after_or_equal:fecha_inicio'],
            'sede_id'               => ['nullable', 'integer', 'exists:sedes,id'],
            'comite_id'             => ['nullable', 'integer', 'exists:comites,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre_proyecto.required'       => 'El nombre del proyecto es obligatorio.',
            'nombre_proyecto.max'            => 'El nombre no puede superar los 200 caracteres.',
            'objetivo.required'              => 'El objetivo del proyecto es obligatorio.',
            'fuente_financiamiento.required' => 'La fuente de financiamiento es obligatoria.',
            'fuente_financiamiento.in'       => 'La fuente debe ser: CFG, Alcaldía, Gobernación o Autogestión.',
            'estatus.required'               => 'El estatus del proyecto es obligatorio.',
            'estatus.in'                     => 'Estatus no válido.',
            'fecha_fin.after_or_equal'       => 'La fecha de fin debe ser igual o posterior a la fecha de inicio.',
            'sede_id.exists'                 => 'La sede seleccionada no existe.',
            'comite_id.exists'               => 'El comité seleccionado no existe.',
        ];
    }

    // ─── Regla 3.3: Forzar respuesta JSON (nunca redirect HTML) ─────────────
    protected function failedValidation(Validator $validator): never
    {
        throw new HttpResponseException(
            response()->json([
                'message' => 'Error de validación.',
                'errors'  => $validator->errors(),
            ], 422)
        );
    }

    protected function failedAuthorization(): never
    {
        throw new HttpResponseException(
            response()->json([
                'message' => 'No autorizado.',
            ], 403)
        );
    }
}

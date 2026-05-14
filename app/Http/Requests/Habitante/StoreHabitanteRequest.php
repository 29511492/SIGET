<?php

namespace App\Http\Requests\Habitante;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * ═══════════════════════════════════════════════════════════════
 *  StoreHabitanteRequest — Validación del registro de habitante
 * ───────────────────────────────────────────────────────────────
 *  REGLAS CRÍTICAS:
 *
 *  cedula: unique:habitantes — un habitante no puede registrarse dos
 *    veces. Es nullable porque algunos habitantes no tienen cédula
 *    (niños, personas sin documentación), pero si se provee DEBE
 *    ser único. La regla 'unique' de Laravel ignora automáticamente
 *    los NULL — solo valida unicidad sobre valores no nulos.
 *
 *  tipo_discapacidad: solo requerido si es_discapacitado = true.
 *    Regla 'required_if' de Laravel: aplica la validación solo
 *    cuando otra condición se cumple. Evita que el campo sea
 *    obligatorio para todos los habitantes.
 *
 *  fecha_nacimiento: before:today — no puede ser una fecha futura.
 *    'date_format:Y-m-d' asegura que React envíe el formato correcto.
 * ═══════════════════════════════════════════════════════════════
 */
class StoreHabitanteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->rol, ['admin', 'operador'], true);
    }

    public function rules(): array
    {
        return [
            'familia_id' => [
                'required',
                'integer',
                'exists:familias,id',   // La familia debe existir
            ],
            'cedula' => [
                'nullable',
                'string',
                'max:15',
                'unique:habitantes,cedula', // Único si se provee (NULL ignorado)
            ],
            'nombres' => [
                'required',
                'string',
                'max:100',
            ],
            'apellidos' => [
                'required',
                'string',
                'max:100',
            ],
            'fecha_nacimiento' => [
                'required',
                'date_format:Y-m-d',
                'before:today',         // No puede ser fecha futura
                'after:1900-01-01',     // Razonable para un censo
            ],
            'sexo' => [
                'required',
                'string',
                'in:masculino,femenino,otro',
            ],
            'es_discapacitado' => [
                'required',
                'boolean',
            ],
            'tipo_discapacidad' => [
                'nullable',
                'string',
                'max:100',
                // Obligatorio SOLO si es_discapacitado = true
                'required_if:es_discapacitado,true',
            ],
            'enfermedad_cronica' => [
                'nullable',
                'string',
                'max:150',
            ],
            'nivel_educativo' => [
                'required',
                'string',
                // Valores del ENUM de la migración mejorada
                'in:ninguno,primaria,bachillerato,tecnico,universitario,postgrado',
            ],
        ];
    }

    public function attributes(): array
    {
        return [
            'familia_id'        => 'familia',
            'cedula'            => 'cédula',
            'nombres'           => 'nombres',
            'apellidos'         => 'apellidos',
            'fecha_nacimiento'  => 'fecha de nacimiento',
            'sexo'              => 'sexo',
            'es_discapacitado'  => 'discapacidad',
            'tipo_discapacidad' => 'tipo de discapacidad',
            'enfermedad_cronica'=> 'enfermedad crónica',
            'nivel_educativo'   => 'nivel educativo',
        ];
    }

    public function messages(): array
    {
        return [
            'cedula.unique'                    => 'Esta cédula ya está registrada en el sistema.',
            'familia_id.exists'                => 'La familia seleccionada no existe.',
            'fecha_nacimiento.before'          => 'La fecha de nacimiento no puede ser una fecha futura.',
            'fecha_nacimiento.after'           => 'La fecha de nacimiento no es válida.',
            'sexo.in'                          => 'El sexo debe ser: masculino, femenino u otro.',
            'nivel_educativo.in'               => 'El nivel educativo seleccionado no es válido.',
            'tipo_discapacidad.required_if'    => 'Debes describir el tipo de discapacidad.',
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
            response()->json([
                'message' => 'No tienes permiso para registrar habitantes.',
                'errors'  => [],
            ], 403)
        );
    }
}

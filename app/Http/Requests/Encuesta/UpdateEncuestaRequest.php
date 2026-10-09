<?php

namespace App\Http\Requests\Encuesta;

use App\Models\Encuesta;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

class UpdateEncuestaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->esAdmin() === true;
    }

    public function rules(): array
    {
        return [
            'nombre'       => ['sometimes', 'required', 'string', 'max:150'],
            'tipo'         => ['sometimes', 'required', 'string', Rule::in(Encuesta::TIPOS)],
            'descripcion'  => ['nullable', 'string', 'max:1000'],
            'fecha_inicio' => ['nullable', 'date'],
            'fecha_cierre' => ['nullable', 'date', 'after_or_equal:fecha_inicio'],
            'activa'       => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'tipo.in'                      => 'El tipo debe ser bombona_gas, bolsa_clap u otro.',
            'fecha_cierre.after_or_equal'  => 'La fecha de cierre no puede ser anterior a la de inicio.',
        ];
    }

    /**
     * Regla cruzada de robustez: cambiar el tipo de una campaña que ya tiene
     * entregas cambiaría el significado de esos datos (el estimador de gas
     * solo mira encuestas de tipo bombona_gas). Se bloquea.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            /** @var Encuesta|null $encuesta */
            $encuesta = $this->route('encuesta');

            if (! $encuesta instanceof Encuesta || ! $this->filled('tipo')) {
                return;
            }

            if ($this->input('tipo') !== $encuesta->tipo && $encuesta->respuestas()->exists()) {
                $validator->errors()->add(
                    'tipo',
                    'No se puede cambiar el tipo de una encuesta que ya tiene entregas registradas.'
                );
            }
        });
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

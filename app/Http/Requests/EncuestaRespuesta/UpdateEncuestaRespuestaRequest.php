<?php

namespace App\Http\Requests\EncuestaRespuesta;

use App\Models\EncuestaRespuesta;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Corregir una entrega ya registrada. Solo admin.
 * La familia y la encuesta no se pueden cambiar: para eso se elimina
 * el registro y se crea uno nuevo.
 */
class UpdateEncuestaRespuestaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->esAdmin() === true;
    }

    public function rules(): array
    {
        return [
            'cantidad'      => ['sometimes', 'required', 'integer', 'min:1', 'max:99'],
            'fecha_entrega' => ['sometimes', 'required', 'date', 'before_or_equal:today'],
            'observaciones' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'cantidad.min'                  => 'La cantidad debe ser al menos 1.',
            'fecha_entrega.before_or_equal' => 'La fecha de entrega no puede ser futura.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty() || ! $this->filled('fecha_entrega')) {
                return;
            }

            /** @var EncuestaRespuesta|null $respuesta */
            $respuesta = $this->route('encuestaRespuesta');

            if (! $respuesta instanceof EncuestaRespuesta) {
                return;
            }

            $yaExiste = EncuestaRespuesta::query()
                ->where('encuesta_id', $respuesta->encuesta_id)
                ->where('familia_id', $respuesta->familia_id)
                ->whereDate('fecha_entrega', $this->input('fecha_entrega'))
                ->where('id', '!=', $respuesta->id)
                ->exists();

            if ($yaExiste) {
                $validator->errors()->add(
                    'fecha_entrega',
                    'Ya hay otra entrega de esa familia en esa fecha para esta encuesta.'
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

<?php

namespace App\Http\Requests\EncuestaRespuesta;

use App\Models\Encuesta;
use App\Models\EncuestaRespuesta;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

/**
 * Registrar una entrega dentro de una encuesta. Solo admin.
 *
 * Validaciones de robustez (corrección 3 del profesor):
 *  - la familia debe existir y NO estar dada de baja
 *  - cantidad mínima 1 (con 0 el estimador contaría una entrega falsa)
 *  - la fecha no puede ser futura
 *  - la encuesta debe estar activa
 *  - no se repite la misma familia + encuesta + fecha (ignora bajas)
 */
class StoreEncuestaRespuestaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->esAdmin() === true;
    }

    public function rules(): array
    {
        return [
            'familia_id'    => ['required', 'integer', Rule::exists('familias', 'id')->whereNull('deleted_at')],
            'cantidad'      => ['required', 'integer', 'min:1', 'max:99'],
            'fecha_entrega' => ['required', 'date', 'before_or_equal:today'],
            'observaciones' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'familia_id.exists'            => 'La familia seleccionada no existe o fue dada de baja.',
            'cantidad.min'                 => 'La cantidad debe ser al menos 1.',
            'fecha_entrega.before_or_equal' => 'La fecha de entrega no puede ser futura.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return; // primero deben pasar las reglas básicas
            }

            /** @var Encuesta|null $encuesta */
            $encuesta = $this->route('encuesta');

            if (! $encuesta instanceof Encuesta) {
                return;
            }

            if (! $encuesta->activa) {
                $validator->errors()->add('encuesta', 'La encuesta está cerrada: no admite nuevas entregas.');
                return;
            }

            $yaExiste = EncuestaRespuesta::query()
                ->where('encuesta_id', $encuesta->id)
                ->where('familia_id', (int) $this->input('familia_id'))
                ->whereDate('fecha_entrega', $this->input('fecha_entrega'))
                ->exists();

            if ($yaExiste) {
                $validator->errors()->add(
                    'fecha_entrega',
                    'Ya hay una entrega de esa familia en esa fecha para esta encuesta.'
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

<?php

namespace App\Http\Requests\EncuestaRespuesta;

use App\Models\Encuesta;
use App\Models\Familia;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Registro masivo: una misma entrega (cantidad + fecha) aplicada a varias
 * familias de una sola vez. Solo admin.
 *
 * Origen: propuesta de la compañera que diseñó el módulo, adaptada a las
 * reglas del proyecto (oct-2026):
 *  · solo admin (el rol operador no recibe permisos nuevos);
 *  · cantidad entre 1 y 99 y fecha no futura, igual que el registro individual;
 *  · la encuesta debe estar activa;
 *  · la existencia de las familias se comprueba con UNA consulta (la versión
 *    original hacía una por cada familia, hasta 500).
 */
class StoreEncuestaRespuestaMasivaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->esAdmin() === true;
    }

    public function rules(): array
    {
        return [
            'familia_ids'   => ['required', 'array', 'min:1', 'max:500'],
            'familia_ids.*' => ['integer', 'distinct'],
            'cantidad'      => ['required', 'integer', 'min:1', 'max:99'],
            'fecha_entrega' => ['required', 'date', 'before_or_equal:today'],
            'observaciones' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function attributes(): array
    {
        return [
            'familia_ids'   => 'familias',
            'cantidad'      => 'cantidad',
            'fecha_entrega' => 'fecha de entrega',
        ];
    }

    public function messages(): array
    {
        return [
            'familia_ids.required'          => 'Selecciona al menos una familia.',
            'familia_ids.min'               => 'Selecciona al menos una familia.',
            'familia_ids.max'               => 'No puedes registrar más de 500 familias a la vez.',
            'cantidad.min'                  => 'La cantidad debe ser al menos 1.',
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

            if ($encuesta instanceof Encuesta && ! $encuesta->activa) {
                $validator->errors()->add('encuesta', 'La encuesta está cerrada: no admite nuevas entregas.');
                return;
            }

            // Todas las familias deben existir y no estar dadas de baja (una consulta)
            $ids      = array_values(array_unique(array_map('intval', (array) $this->input('familia_ids'))));
            $vigentes = Familia::whereIn('id', $ids)->count();

            if ($vigentes !== count($ids)) {
                $validator->errors()->add(
                    'familia_ids',
                    'Alguna de las familias seleccionadas no existe o fue dada de baja. Recarga la lista e inténtalo de nuevo.'
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

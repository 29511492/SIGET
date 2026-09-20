<?php

namespace App\Http\Requests\Familia;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * ═══════════════════════════════════════════════════════════════
 *  Validación del registro de familia + sus habitantes
 * ───────────────────────────────────────────────────────────────
 *  CAMBIO (sept-2026): por instrucción del profesor, el módulo de
 *  Habitantes deja de ser independiente. El payload ahora puede
 *  traer un array `habitantes[]` — el registro de habitantes ya
 *  no tiene su propio endpoint/FormRequest, todo se valida y se
 *  crea junto con la familia (ver FamiliaController::store,
 *  DB::transaction: o se guarda todo, o no se guarda nada).
 *
 *  Las reglas por-elemento del array usan la notación wildcard de
 *  Laravel (`habitantes.*.campo`). Lo que Laravel NO resuelve bien
 *  con wildcards es la validación cruzada (p. ej. "tipo_discapacidad
 *  obligatorio SOLO si ESE MISMO habitante tiene es_discapacitado
 *  = true"), así que esa regla se aplica a mano en withValidator()
 *  recorriendo el array — mismo criterio que usaba la extinta
 *  StoreHabitanteRequest, adaptado a que ahora son N habitantes.
 *
 *  CAMPOS DEL FORMULARIO React → reglas de validación (familia):
 *  igual que antes de este cambio — ver historial del documento
 *  maestro para el detalle campo por campo.
 * ═══════════════════════════════════════════════════════════════
 */
class StoreFamiliaRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Solo operadores y admins pueden registrar familias
        // (el AdminMiddleware ya protege la ruta — esto es una segunda barrera)
        return in_array($this->user()?->rol, ['admin', 'operador'], true);
    }

    public function rules(): array
    {
        return [
            'codigo_vivienda' => [
                'required',
                'string',
                'max:20',
                'unique:familias,codigo_vivienda', // Unicidad en PostgreSQL
            ],
            'nombre_responsable' => [
                'required',
                'string',
                'max:100',
                // Solo letras (con tildes/ñ), espacios, apóstrofes y guiones
                'regex:/^[\p{L}\s\'\-]+$/u',
            ],
            'sede_id' => [
                'required',
                'integer',
                'exists:sedes,id',
            ],
            'calle_id' => [
                'required',
                'integer',
                'exists:calles,id',
            ],
            'condicion_vivienda' => [
                'required',
                'string',
                'in:optima,regular,critica',
            ],
            'cantidad_bombonas' => [
                'required',
                'integer',
                'min:0',
                'max:99',
            ],
            'capacidad_bombona' => [
                'required',
                'string',
                'in:10kg,18kg,43kg',
            ],
            'posee_agua_potable' => [
                'required',
                'boolean',
            ],
            'posee_luz' => [
                'required',
                'boolean',
            ],
            'posee_aseo' => [
                'required',
                'boolean',
            ],
            'punto_referencia' => [
                'nullable',
                'string',
                'max:255',
            ],

            // ── Habitantes de la familia (array opcional) ────────
            // Sin FormRequest propio — todo el detalle vive aquí.
            'habitantes' => [
                'sometimes',
                'array',
            ],
            'habitantes.*.cedula' => [
                'nullable',
                'string',
                'max:15',
                'distinct',                 // Sin cédulas repetidas en el mismo envío
                'unique:habitantes,cedula',  // Único contra la BD (NULL se ignora)
            ],
            'habitantes.*.nombres' => [
                'required_with:habitantes',
                'string',
                'max:100',
                'regex:/^[\p{L}\s\'\-]+$/u',
            ],
            'habitantes.*.apellidos' => [
                'required_with:habitantes',
                'string',
                'max:100',
                'regex:/^[\p{L}\s\'\-]+$/u',
            ],
            'habitantes.*.fecha_nacimiento' => [
                'required_with:habitantes',
                'date_format:Y-m-d',
                'before:today',
                'after:1900-01-01',
            ],
            'habitantes.*.sexo' => [
                'required_with:habitantes',
                'string',
                'in:masculino,femenino,otro',
            ],
            'habitantes.*.es_discapacitado' => [
                'required_with:habitantes',
                'boolean',
            ],
            'habitantes.*.tipo_discapacidad' => [
                'nullable',
                'string',
                'max:100',
                // NOTA: el "required_if" cruzado (obligatorio solo si
                // ese mismo habitante tiene es_discapacitado=true) se
                // valida a mano en withValidator(), no aquí.
            ],
            'habitantes.*.enfermedad_cronica' => [
                'nullable',
                'string',
                'max:150',
            ],
            'habitantes.*.nivel_educativo' => [
                'required_with:habitantes',
                'string',
                'in:ninguno,primaria,bachillerato,tecnico,universitario,postgrado',
            ],
        ];
    }

    /**
     * Validación cruzada por habitante que las reglas wildcard de
     * arriba no pueden expresar de forma fiable.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $habitantes = $this->input('habitantes', []);

            foreach ($habitantes as $i => $h) {
                $esDiscapacitado = filter_var($h['es_discapacitado'] ?? false, FILTER_VALIDATE_BOOLEAN);
                $tipo = trim((string) ($h['tipo_discapacidad'] ?? ''));

                if ($esDiscapacitado && $tipo === '') {
                    $validator->errors()->add(
                        "habitantes.{$i}.tipo_discapacidad",
                        'Debes describir el tipo de discapacidad.'
                    );
                }
            }
        });
    }

    public function attributes(): array
    {
        return [
            'codigo_vivienda'    => 'código de vivienda',
            'nombre_responsable' => 'responsable de la familia',
            'sede_id'            => 'sede',
            'calle_id'           => 'calle',
            'condicion_vivienda' => 'condición de la vivienda',
            'cantidad_bombonas'  => 'cantidad de bombonas',
            'capacidad_bombona'  => 'capacidad de bombona',
            'posee_agua_potable' => 'agua potable',
            'posee_luz'          => 'servicio de luz',
            'posee_aseo'         => 'servicio de aseo',
            'punto_referencia'   => 'punto de referencia',
        ];
    }

    public function messages(): array
    {
        return [
            'codigo_vivienda.unique'                       => 'Este código de vivienda ya está registrado.',
            'sede_id.exists'                                => 'La sede seleccionada no existe.',
            'calle_id.exists'                               => 'La calle seleccionada no existe.',
            'condicion_vivienda.in'                         => 'La condición debe ser: óptima, regular o crítica.',
            'capacidad_bombona.in'                          => 'La capacidad debe ser: 10kg, 18kg o 43kg.',
            'nombre_responsable.regex'                      => 'El responsable solo puede contener letras.',
            'habitantes.*.nombres.regex'                    => 'Los nombres solo pueden contener letras.',
            'habitantes.*.apellidos.regex'                  => 'Los apellidos solo pueden contener letras.',
            'habitantes.*.cedula.distinct'                  => 'Hay cédulas repetidas entre los habitantes que estás registrando.',
            'habitantes.*.cedula.unique'                    => 'Una de las cédulas ya está registrada en el sistema.',
            'habitantes.*.nombres.required_with'            => 'Cada habitante debe tener nombres.',
            'habitantes.*.apellidos.required_with'          => 'Cada habitante debe tener apellidos.',
            'habitantes.*.fecha_nacimiento.required_with'   => 'Cada habitante debe tener fecha de nacimiento.',
            'habitantes.*.fecha_nacimiento.before'          => 'La fecha de nacimiento no puede ser futura.',
            'habitantes.*.sexo.required_with'               => 'Debes seleccionar el sexo de cada habitante.',
            'habitantes.*.nivel_educativo.required_with'    => 'Debes seleccionar el nivel de instrucción de cada habitante.',
        ];
    }

    /**
     * CRÍTICO: Fuerza JSON en vez de redirect para la SPA React.
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(
            response()->json([
                'message' => 'Los datos proporcionados no son válidos.',
                'errors'  => $validator->errors(),
            ], 422)
        );
    }

    /**
     * CRÍTICO: Fuerza JSON en vez de redirect para fallos de autorización.
     */
    protected function failedAuthorization(): void
    {
        throw new HttpResponseException(
            response()->json([
                'message' => 'No tienes permiso para registrar familias.',
                'errors'  => [],
            ], 403)
        );
    }
}

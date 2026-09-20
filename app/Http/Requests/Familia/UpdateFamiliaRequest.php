<?php

namespace App\Http\Requests\Familia;

use App\Models\Habitante;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

/**
 * ═══════════════════════════════════════════════════════════════
 *  UpdateFamiliaRequest — Corrección del Rule::unique
 * ───────────────────────────────────────────────────────────────
 *  CORRECCIÓN CRÍTICA — La causa más probable del error 500:
 *
 *  VERSIÓN ANTERIOR (frágil):
 *    $familiaId = $this->route('familia')?->id;
 *    Rule::unique('familias','codigo_vivienda')->ignore($familiaId)
 *
 *  PROBLEMA:
 *    $this->route('familia') devuelve el modelo resuelto por Route
 *    Model Binding. Si por cualquier razón (typo en la ruta, modelo
 *    no encontrado) devuelve null, entonces ->ignore(null) no ignora
 *    nada. El registro existente hace fallar la validación 'unique',
 *    pero failedValidation() relanza como HttpResponseException.
 *    Dependiendo de dónde falla, puede convertirse en un 500 en vez
 *    de un 422.
 *
 *  VERSIÓN CORREGIDA (robusta):
 *    Rule::unique('familias','codigo_vivienda')->ignore($this->route('familia'))
 *
 *    Cuando ->ignore() recibe un Model (no un ID entero), Laravel
 *    extrae automáticamente la PK del modelo. Esto es más seguro
 *    porque si el modelo no se resolvió, Route Model Binding ya
 *    habría devuelto 404 ANTES de que el Request se ejecute.
 *    Si llega aquí, el modelo existe y tiene ID válido.
 *
 *  DEFENSA ADICIONAL — whereNull('deleted_at'):
 *    Con SoftDeletes, puede existir un registro borrado con el mismo
 *    codigo_vivienda. Sin ->whereNull(), la validación 'unique'
 *    fallaría aunque el registro esté borrado lógicamente.
 *    Con ->whereNull(), solo compara contra registros activos.
 * ───────────────────────────────────────────────────────────────
 *  CAMBIO (sept-2026) — Habitantes anidados en la edición:
 *  El payload puede traer `habitantes[]`. Cada elemento puede
 *  traer `id` (habitante existente que se edita) o no traerlo
 *  (habitante nuevo agregado durante la edición). En
 *  withValidator() se verifica que todo `id` recibido pertenezca
 *  realmente a ESTA familia — evita que, por error de datos en el
 *  frontend, se edite el habitante de otra familia desde este
 *  formulario.
 *
 *  La unicidad de cédula NO se valida con la regla `unique` de
 *  Laravel a nivel de array (no soporta "ignorar el registro N del
 *  wildcard"), así que se hace a mano en withValidator(),
 *  excluyendo el propio id del habitante cuando aplica.
 * ═══════════════════════════════════════════════════════════════
 */
class UpdateFamiliaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->rol, ['admin', 'operador'], true);
    }

    public function rules(): array
    {
        // $this->familia viene del Route Model Binding en la ruta
        // PUT/PATCH /api/v1/familias/{familia}
        $familia = $this->route('familia');

        return [
            'codigo_vivienda' => [
                'sometimes', 'required', 'string', 'max:20',
                Rule::unique('familias', 'codigo_vivienda')
                    ->ignore($familia)
                    ->whereNull('deleted_at'),
            ],

            'nombre_responsable' => [
                'sometimes', 'required', 'string', 'max:100',
                // Solo letras (con tildes/ñ), espacios, apóstrofes y guiones
                'regex:/^[\p{L}\s\'\-]+$/u',
            ],
            'sede_id' => ['sometimes', 'required', 'integer', 'exists:sedes,id'],
            'calle_id' => ['sometimes', 'required', 'integer', 'exists:calles,id'],

            'condicion_vivienda' => [
                'sometimes',
                'required',
                'string',
                'in:optima,regular,critica',
            ],

            'cantidad_bombonas' => [
                'sometimes',
                'required',
                'integer',
                'min:0',
                'max:99',
            ],

            'capacidad_bombona' => [
                'sometimes',
                'required',
                'string',
                'in:10kg,18kg,43kg',
            ],

            'posee_agua_potable' => [
                'sometimes',
                'required',
                'boolean',
            ],

            'posee_luz' => [
                'sometimes',
                'required',
                'boolean',
            ],

            'posee_aseo' => [
                'sometimes',
                'required',
                'boolean',
            ],

            'punto_referencia' => [
                'sometimes',
                'nullable',
                'string',
                'max:255',
            ],

            // ── Habitantes de la familia (array opcional) ────────
            'habitantes' => [
                'sometimes',
                'array',
            ],
            'habitantes.*.id' => [
                'sometimes',
                'nullable',
                'integer',
                'exists:habitantes,id',
            ],
            'habitantes.*.cedula' => [
                'nullable',
                'string',
                'max:15',
                'distinct', // Sin cédulas repetidas dentro del mismo envío
                // Unicidad contra la BD (ignorando el propio registro)
                // se valida a mano en withValidator() — ver comentario arriba.
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
     * Validación cruzada por habitante: tipo_discapacidad condicional,
     * pertenencia del id a esta familia, y unicidad de cédula contra
     * la BD ignorando el propio registro.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $familia    = $this->route('familia');
            $habitantes = $this->input('habitantes', []);

            // IDs de habitantes que realmente pertenecen a esta familia
            $idsPropios = $familia
                ? $familia->habitantes()->pluck('id')->all()
                : [];

            foreach ($habitantes as $i => $h) {
                $id              = $h['id'] ?? null;
                $tipo            = trim((string) ($h['tipo_discapacidad'] ?? ''));
                $esDiscapacitado = filter_var($h['es_discapacitado'] ?? false, FILTER_VALIDATE_BOOLEAN);

                // Tipo de discapacidad obligatorio si aplica
                if ($esDiscapacitado && $tipo === '') {
                    $validator->errors()->add(
                        "habitantes.{$i}.tipo_discapacidad",
                        'Debes describir el tipo de discapacidad.'
                    );
                }

                // El id, si viene, debe pertenecer a ESTA familia
                if ($id && !in_array($id, $idsPropios, true)) {
                    $validator->errors()->add(
                        "habitantes.{$i}.id",
                        'Este habitante no pertenece a la familia que estás editando.'
                    );
                }

                // Unicidad de cédula contra la BD, ignorando el propio registro
                $cedula = trim((string) ($h['cedula'] ?? ''));
                if ($cedula !== '') {
                    $existe = Habitante::where('cedula', $cedula)
                        ->whereNull('deleted_at')
                        ->when($id, fn ($q) => $q->where('id', '!=', $id))
                        ->exists();

                    if ($existe) {
                        $validator->errors()->add(
                            "habitantes.{$i}.cedula",
                            'Esta cédula ya pertenece a otro habitante registrado.'
                        );
                    }
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
            'codigo_vivienda.unique'         => 'Este código de vivienda ya pertenece a otra familia.',
            'sede_id.exists'                 => 'La sede seleccionada no existe.',
            'calle_id.exists'                => 'La calle seleccionada no existe.',
            'condicion_vivienda.in'          => 'La condición debe ser: óptima, regular o crítica.',
            'capacidad_bombona.in'           => 'La capacidad debe ser: 10kg, 18kg o 43kg.',
            'nombre_responsable.regex'       => 'El responsable solo puede contener letras.',
            'habitantes.*.nombres.regex'     => 'Los nombres solo pueden contener letras.',
            'habitantes.*.apellidos.regex'   => 'Los apellidos solo pueden contener letras.',
            'habitantes.*.id.exists'         => 'Uno de los habitantes ya no existe.',
            'habitantes.*.cedula.distinct'   => 'Hay cédulas repetidas entre los habitantes.',
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
                'message' => 'No tienes permiso para editar familias.',
                'errors'  => [],
            ], 403)
        );
    }
}

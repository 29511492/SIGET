<?php

namespace App\Http\Requests\Organizacion;

use App\Models\Organizacion;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOrganizacionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->esAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'nombre'        => ['required', 'string', 'max:150'],
            'tipo_servicio' => ['required', Rule::in(array_keys(Organizacion::TIPOS_SERVICIO))],
            'contacto'      => ['nullable', 'string', 'max:100'],
            'descripcion'   => ['nullable', 'string', 'max:1000'],
            'estatus'       => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required'        => 'El nombre de la organización es obligatorio.',
            'tipo_servicio.required' => 'El tipo de servicio es obligatorio.',
            'tipo_servicio.in'       => 'El tipo de servicio seleccionado no es válido.',
        ];
    }

    protected function failedAuthorization(): never
    {
        throw new \Illuminate\Auth\Access\AuthorizationException(
            'Solo administradores pueden registrar organizaciones.'
        );
    }
}

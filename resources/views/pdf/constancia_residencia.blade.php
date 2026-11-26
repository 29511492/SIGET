@extends('pdf.pdf_master')

{{-- ── Estilos propios de la constancia (nov-2026) ───────────────────────
     Una sola hoja carta con márgenes. Solo afecta a esta vista: la plantilla
     maestra y los demás PDF (estadísticas, comunicados) no cambian. --}}
@section('estilos')
    <style>
        @page {
            margin: 1.2cm 2cm 2cm 2cm !important;
        }

        body {
            line-height: 1.35;
        }

        .membrete {
            padding-bottom: 8px;
            margin-bottom: 8px;
        }

        .membrete-banda {
            padding: 6px 16px;
            margin-bottom: 5px;
        }

        .membrete-datos {
            padding: 2px 16px 0 16px;
        }

        .doc-titulo {
            margin: 6px 0 2px 0;
            padding: 5px 0;
            font-size: 12.5pt;
        }

        .seccion {
            margin: 6px 0;
        }

        .seccion-titulo {
            margin-bottom: 4px;
        }

        .tabla-datos {
            margin: 4px 0;
        }

        .tabla-datos td {
            padding: 2px 10px;
            font-size: 9pt;
        }

        .linea-gris {
            margin: 4px 0;
        }

        .linea-dorada {
            margin: 6px 0;
        }

        .cuerpo-texto {
            font-size: 9.5pt;
            line-height: 1.45;
            margin: 6px 0;
        }

        .cuerpo-texto p {
            margin-bottom: 6px;
        }

        .nota-validez {
            margin-top: 8px;
            padding: 5px 12px;
            font-size: 8pt;
        }

        .firma-bloque {
            margin-top: 14px;
            page-break-inside: avoid;
        }

        .firma-sello {
            width: 58px;
            height: 58px;
            margin-top: 2px;
        }

        /* Pie dentro del margen inferior; una sola hoja no necesita "Página x de y" */
        .pie-pagina {
            bottom: -1.4cm;
            height: 28px;
            padding: 0 16px;
        }

        .pie-izq {
            width: 100%;
        }

        .pie-der {
            display: none;
        }
    </style>
@endsection

@section('contenido')
    {{-- ── Datos del solicitante ─────────────────────────────────────────── --}}
    <div class="seccion">
        <div class="seccion-titulo">Datos del Titular</div>

        <table class="tabla-datos">
            <tr>
                <td class="etiqueta">Nombres y Apellidos</td>
                <td class="valor">
                    {{ strtoupper($habitante->nombres . ' ' . $habitante->apellidos) }}
                </td>
            </tr>
            <tr>
                <td class="etiqueta">Cédula de Identidad</td>
                <td class="valor">{{ $habitante->cedula ?? 'Sin registrar' }}</td>
            </tr>
            <tr>
                <td class="etiqueta">Fecha de Nacimiento</td>
                <td class="valor">
                    {{ $habitante->fecha_nacimiento
                        ? \Carbon\Carbon::parse($habitante->fecha_nacimiento)->locale('es')->isoFormat('D [de] MMMM [de] YYYY')
                        : 'No registrada' }}
                </td>
            </tr>
            <tr>
                <td class="etiqueta">Sexo</td>
                <td class="valor">{{ ucfirst($habitante->sexo ?? 'No registrado') }}</td>
            </tr>
            <tr>
                <td class="etiqueta">Nivel Educativo</td>
                <td class="valor">{{ ucfirst(str_replace('_', ' ', $habitante->nivel_educativo ?? 'No registrado')) }}</td>
            </tr>
            @if ($habitante->es_discapacitado)
                <tr>
                    <td class="etiqueta">Condición Especial</td>
                    <td class="valor">
                        Persona con discapacidad &mdash; {{ $habitante->tipo_discapacidad ?? 'Tipo no especificado' }}
                    </td>
                </tr>
            @endif
        </table>
    </div>

    <hr class="linea-gris">

    {{-- ── Datos de residencia ────────────────────────────────────────────── --}}
    <div class="seccion">
        <div class="seccion-titulo">Datos de Residencia</div>

        <table class="tabla-datos">
            @if ($familia)
                <tr>
                    <td class="etiqueta">Código de Vivienda</td>
                    <td class="valor">{{ $familia->codigo_vivienda ?? 'No asignado' }}</td>
                </tr>
            @endif
            @if ($calle)
                <tr>
                    <td class="etiqueta">Calle / Sector</td>
                    <td class="valor">{{ $calle->nombre ?? 'No registrada' }}</td>
                </tr>
            @endif
            @if ($sede)
                <tr>
                    <td class="etiqueta">Sede Comunal</td>
                    <td class="valor">{{ $sede->nombre ?? 'No registrada' }}</td>
                </tr>
                <tr>
                    <td class="etiqueta">Dirección de Sede</td>
                    <td class="valor">{{ $sede->direccion ?? 'No registrada' }}</td>
                </tr>
            @endif
            @if ($familia)
                <tr>
                    <td class="etiqueta">Condición de Vivienda</td>
                    <td class="valor">
                        {{ ucfirst($familia->condicion_vivienda ?? 'No registrada') }}
                    </td>
                </tr>
            @endif
        </table>
    </div>

    <hr class="linea-dorada">

    {{-- ── Cuerpo de texto de la constancia ──────────────────────────────── --}}
    <div class="cuerpo-texto">
        <p>
            El <strong>Consejo Comunal</strong>, en ejercicio de sus funciones como instancia
            de participación, articulación e integración entre los ciudadanos, ciuda&shy;danas
            y las diversas organizaciones comunitarias, movimientos sociales y populares,
            hace constar mediante la presente que:
        </p>
        <p>
            El (La) ciudadano (a) <strong>{{ strtoupper($habitante->nombres . ' ' . $habitante->apellidos) }}</strong>,
            titular de la cédula de identidad <strong>N° {{ $habitante->cedula ?? '—' }}</strong>,
            se encuentra debidamente registrado (a) en el censo comunal de este Consejo Comunal,
            con residencia
            @if ($calle)
                en la <strong>{{ $calle->nombre }}</strong>
            @endif
            @if ($familia)
                , vivienda con código <strong>{{ $familia->codigo_vivienda ?? '—' }}</strong>
            @endif
            @if ($sede)
                , jurisdicción de la sede <strong>{{ $sede->nombre }}</strong>
            @endif
            .
        </p>
        <p>
            La presente constancia se expide a solicitud del interesado, en
            <strong>{{ config('app.municipio_consejo', 'el Municipio') }}</strong>,
            a los <strong>{{ $fecha_emision }}</strong>.
        </p>
    </div>

    {{-- ── Nota de validez ────────────────────────────────────────────────── --}}
    <div class="nota-validez">
        Este documento es válido únicamente con la firma y sello del vocero principal del Consejo Comunal.
        Emitido por el Sistema de Gestión Territorial (SIGET) el {{ now()->format('d/m/Y \a \l\a\s H:i') }} hrs.
    </div>

    {{-- ── Firmas ─────────────────────────────────────────────────────────── --}}
    <div class="firma-bloque">
        <div class="firma-izq">
            <div class="firma-sello">
                <div class="firma-sello-texto">SELLO<br>CONSEJO<br>COMUNAL</div>
            </div>
        </div>
        <div class="firma-der">
            <div class="firma-linea"></div>
            <div class="firma-nombre">
                {{ config('app.vocero_principal', 'Vocero (a) Principal') }}
            </div>
            <div class="firma-cargo">Vocero Principal del Consejo Comunal</div>
        </div>
    </div>
@endsection

@extends('pdf.pdf_master')

@section('contenido')
    {{-- ── Encabezado informativo ────────────────────────────────────────── --}}
    <div class="cuerpo-texto" style="margin-bottom: 16px;">
        <p>
            El presente reporte refleja el estado actual del censo comunal registrado
            en el Sistema de Gestión Territorial (SIGET), generado al <strong>{{ $fecha_emision }}</strong>.
        </p>
    </div>

    <hr class="linea-gris">

    {{-- ── Tarjetas de estadísticas principales ──────────────────────────── --}}
    <div class="seccion">
        <div class="seccion-titulo">Resumen General del Censo</div>

        <table class="tabla-datos">
            <tr>
                <td class="etiqueta">Total de Familias Registradas</td>
                <td class="valor" style="font-size:13pt; font-weight:bold; color:#0d1f35;">
                    {{ number_format($total_familias) }}
                </td>
            </tr>
            <tr>
                <td class="etiqueta">Total de Habitantes</td>
                <td class="valor" style="font-size:13pt; font-weight:bold; color:#0d1f35;">
                    {{ number_format($total_habitantes) }}
                </td>
            </tr>
            <tr>
                <td class="etiqueta">Habitantes con Discapacidad</td>
                <td class="valor" style="color:#c0392b; font-weight:bold;">
                    {{ number_format($con_discapacidad) }}
                    @if ($total_habitantes > 0)
                        <span style="font-size:8.5pt; font-weight:normal; color:#555;">
                            ({{ number_format(($con_discapacidad / $total_habitantes) * 100, 1) }}%)
                        </span>
                    @endif
                </td>
            </tr>
        </table>
    </div>

    <hr class="linea-gris">

    {{-- ── Condición de viviendas ─────────────────────────────────────────── --}}
    <div class="seccion">
        <div class="seccion-titulo">Condición de Viviendas</div>

        <table style="width:100%; border-collapse: collapse; margin-top: 8px;">
            <thead>
                <tr style="background-color: #0d1f35;">
                    <th
                        style="padding:8px 12px; text-align:left; color:#c9a84c; font-size:9pt; font-weight:bold; width:50%;">
                        Condición
                    </th>
                    <th
                        style="padding:8px 12px; text-align:center; color:#c9a84c; font-size:9pt; font-weight:bold; width:25%;">
                        Cantidad
                    </th>
                    <th
                        style="padding:8px 12px; text-align:center; color:#c9a84c; font-size:9pt; font-weight:bold; width:25%;">
                        Porcentaje
                    </th>
                </tr>
            </thead>
            <tbody>
                @php
                    $filas = [
                        ['label' => 'Óptima', 'valor' => $viviendas_optimas, 'color' => '#27ae60'],
                        ['label' => 'Regular', 'valor' => $viviendas_regulares, 'color' => '#f39c12'],
                        ['label' => 'Crítica', 'valor' => $viviendas_criticas, 'color' => '#c0392b'],
                    ];
                    $totalViviendas = $viviendas_optimas + $viviendas_regulares + $viviendas_criticas;
                @endphp

                @foreach ($filas as $i => $fila)
                    <tr style="background-color: {{ $i % 2 === 0 ? '#ffffff' : '#f9f9f9' }};">
                        <td style="padding:7px 12px; border-bottom:0.5px solid #eeeeee;">
                            <span
                                style="display:inline-block; width:10px; height:10px;
                                    background-color:{{ $fila['color'] }}; margin-right:6px;
                                    border-radius:2px; vertical-align:middle;"></span>
                            {{ $fila['label'] }}
                        </td>
                        <td
                            style="padding:7px 12px; text-align:center; font-weight:bold;
                            color:{{ $fila['color'] }}; border-bottom:0.5px solid #eeeeee;">
                            {{ number_format($fila['valor']) }}
                        </td>
                        <td
                            style="padding:7px 12px; text-align:center; font-size:9pt;
                            color:#555; border-bottom:0.5px solid #eeeeee;">
                            {{ $totalViviendas > 0 ? number_format(($fila['valor'] / $totalViviendas) * 100, 1) . '%' : '0%' }}
                        </td>
                    </tr>
                @endforeach

                <tr style="background-color:#f0f4f8;">
                    <td style="padding:7px 12px; font-weight:bold; color:#0d1f35;">TOTAL</td>
                    <td style="padding:7px 12px; text-align:center; font-weight:bold; color:#0d1f35;">
                        {{ number_format($totalViviendas) }}
                    </td>
                    <td style="padding:7px 12px; text-align:center; font-weight:bold; color:#0d1f35;">
                        100%
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    {{-- ── Nota legal ──────────────────────────────────────────────────────── --}}
    <div class="nota-validez" style="margin-top: 24px;">
        Los datos presentados corresponden al registro activo en el sistema al momento de la generación
        de este documento. Este reporte es de carácter informativo y no constituye un instrumento legal.
    </div>
@endsection

<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>{{ $titulo_doc ?? 'SIGET — Documento Oficial' }}</title>
    <style>
        /* ================================================================
           SIGET — Plantilla Maestra PDF
           Paleta oficial: Azul petróleo #0d1f35 · Dorado #c9a84c
           Fuente: DejaVu Sans (incluida en DomPDF, soporte UTF-8 completo)
           ================================================================ */

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: "DejaVu Sans", sans-serif;
            font-size: 11pt;
            color: #1a1a2e;
            background: #ffffff;
            line-height: 1.6;
        }

        /* ── Página ─────────────────────────────────────────────────── */
        .page {
            width: 100%;
            min-height: 100%;
            padding: 0;
            position: relative;
        }

        /* ── Membrete superior ──────────────────────────────────────── */
        .membrete {
            width: 100%;
            border-bottom: 3px solid #c9a84c;
            padding-bottom: 12px;
            margin-bottom: 24px;
        }

        .membrete-banda {
            background-color: #0d1f35;
            width: 100%;
            padding: 10px 20px;
            margin-bottom: 10px;
        }

        .membrete-banda-titulo {
            color: #c9a84c;
            font-size: 13pt;
            font-weight: bold;
            letter-spacing: 1.5px;
            text-transform: uppercase;
        }

        .membrete-banda-subtitulo {
            color: #a0b4c8;
            font-size: 8.5pt;
            letter-spacing: 0.8px;
            margin-top: 2px;
        }

        .membrete-datos {
            display: table;
            width: 100%;
            padding: 4px 20px 0 20px;
        }

        .membrete-izq {
            display: table-cell;
            width: 70%;
            vertical-align: middle;
        }

        .membrete-der {
            display: table-cell;
            width: 30%;
            vertical-align: middle;
            text-align: right;
        }

        .membrete-nombre-consejo {
            font-size: 10pt;
            color: #0d1f35;
            font-weight: bold;
        }

        .membrete-rif {
            font-size: 8pt;
            color: #555;
            margin-top: 2px;
        }

        .membrete-numero-doc {
            font-size: 8.5pt;
            color: #0d1f35;
            font-weight: bold;
            border: 1px solid #c9a84c;
            padding: 3px 8px;
            display: inline-block;
        }

        .membrete-fecha {
            font-size: 8pt;
            color: #555;
            margin-top: 4px;
        }

        /* ── Línea separadora decorativa ────────────────────────────── */
        .linea-dorada {
            border: none;
            border-top: 1.5px solid #c9a84c;
            margin: 16px 0;
        }

        .linea-gris {
            border: none;
            border-top: 0.5px solid #cccccc;
            margin: 12px 0;
        }

        /* ── Título del documento ───────────────────────────────────── */
        .doc-titulo {
            text-align: center;
            font-size: 13pt;
            font-weight: bold;
            color: #0d1f35;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin: 20px 0 8px 0;
            padding: 8px 0;
            border-top: 1px solid #e0e0e0;
            border-bottom: 1px solid #e0e0e0;
        }

        /* ── Sección de contenido ───────────────────────────────────── */
        .seccion {
            margin: 16px 0;
        }

        .seccion-titulo {
            font-size: 9pt;
            font-weight: bold;
            color: #0d1f35;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-left: 3px solid #c9a84c;
            padding-left: 8px;
            margin-bottom: 8px;
        }

        /* ── Tabla de datos ─────────────────────────────────────────── */
        .tabla-datos {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0;
        }

        .tabla-datos td {
            padding: 6px 10px;
            font-size: 10pt;
            border-bottom: 0.5px solid #eeeeee;
        }

        .tabla-datos td.etiqueta {
            width: 35%;
            font-weight: bold;
            color: #0d1f35;
            background-color: #f5f7fa;
        }

        .tabla-datos td.valor {
            width: 65%;
            color: #2c2c2c;
        }

        /* ── Cuerpo de texto (párrafos) ─────────────────────────────── */
        .cuerpo-texto {
            font-size: 11pt;
            color: #1a1a2e;
            text-align: justify;
            line-height: 1.8;
            margin: 12px 0;
        }

        .cuerpo-texto p {
            margin-bottom: 10px;
        }

        /* ── Bloque de firma ────────────────────────────────────────── */
        .firma-bloque {
            margin-top: 48px;
            display: table;
            width: 100%;
        }

        .firma-izq {
            display: table-cell;
            width: 45%;
            text-align: center;
        }

        .firma-der {
            display: table-cell;
            width: 45%;
            text-align: center;
        }

        .firma-linea {
            border-top: 1px solid #0d1f35;
            margin: 0 auto 6px auto;
            width: 80%;
        }

        .firma-nombre {
            font-size: 9.5pt;
            font-weight: bold;
            color: #0d1f35;
        }

        .firma-cargo {
            font-size: 8.5pt;
            color: #555;
            margin-top: 2px;
        }

        .firma-sello {
            width: 80px;
            height: 80px;
            border: 2px dashed #c9a84c;
            margin: 16px auto 0 auto;
            border-radius: 50%;
            display: table;
        }

        .firma-sello-texto {
            display: table-cell;
            vertical-align: middle;
            text-align: center;
            font-size: 7pt;
            color: #c9a84c;
        }

        /* ── Nota al pie del contenido ──────────────────────────────── */
        .nota-validez {
            margin-top: 32px;
            padding: 8px 12px;
            border-left: 3px solid #c9a84c;
            background-color: #fafafa;
            font-size: 8.5pt;
            color: #555;
            font-style: italic;
        }

        /* ── Pie de página (DomPDF page counter) ────────────────────── */
        .pie-pagina {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 36px;
            background-color: #0d1f35;
            padding: 0 20px;
            display: table;
            width: 100%;
        }

        .pie-izq {
            display: table-cell;
            vertical-align: middle;
            width: 60%;
            color: #a0b4c8;
            font-size: 7.5pt;
            letter-spacing: 0.5px;
        }

        .pie-der {
            display: table-cell;
            vertical-align: middle;
            width: 40%;
            text-align: right;
            color: #c9a84c;
            font-size: 7.5pt;
        }

        /* ── Script DomPDF para numeración automática ───────────────── */
        /* DomPDF evalúa estas variables en tiempo de renderizado        */
        .numero-pagina::before {
            content: counter(page);
        }

        .total-paginas::before {
            content: counter(pages);
        }
    </style>
</head>

<body>

    {{-- ═══════════════════════════════════════════════════════════════════
        PIE DE PÁGINA FIJO — Se renderiza en todas las páginas
        DomPDF usa script inline para acceder a page/pages counters
    ═══════════════════════════════════════════════════════════════════ --}}
    <div class="pie-pagina">
        <div class="pie-izq">
            SIGET &mdash; Sistema de Gestión Territorial &nbsp;|&nbsp; Documento Oficial
        </div>
        <div class="pie-der">
            Página <span class="numero-pagina"></span>
            de <span class="total-paginas"></span>
        </div>
    </div>

    {{-- ═══════════════════════════════════════════════════════════════════
        CONTENIDO PRINCIPAL — Inyectado por cada vista hija
    ═══════════════════════════════════════════════════════════════════ --}}
    <div class="page">

        {{-- MEMBRETE ──────────────────────────────────────────────────── --}}
        <div class="membrete">
            <div class="membrete-banda">
                <div class="membrete-banda-titulo">Sistema de Gestión Territorial</div>
                <div class="membrete-banda-subtitulo">SIGET &nbsp;&bull;&nbsp; Consejo Comunal &nbsp;&bull;&nbsp;
                    República Bolivariana de Venezuela</div>
            </div>

            <div class="membrete-datos">
                <div class="membrete-izq">
                    <div class="membrete-nombre-consejo">
                        Consejo Comunal &mdash; {{ config('app.nombre_consejo', 'Nombre del Consejo Comunal') }}
                    </div>
                    <div class="membrete-rif">
                        RIF: {{ config('app.rif_consejo', 'J-00000000-0') }}
                        &nbsp;&bull;&nbsp;
                        {{ config('app.municipio_consejo', 'Municipio / Estado') }}
                    </div>
                </div>
                <div class="membrete-der">
                    @isset($comunicado)
                        <div class="membrete-numero-doc">Nro. {{ $comunicado->numero_oficio }}</div>
                    @endisset
                    <div class="membrete-fecha">{{ $fecha_emision ?? now()->format('d/m/Y') }}</div>
                </div>
            </div>
        </div>

        {{-- TÍTULO DEL DOCUMENTO ──────────────────────────────────────── --}}
        <div class="doc-titulo">{{ $titulo_doc ?? 'DOCUMENTO OFICIAL' }}</div>

        {{-- CONTENIDO INYECTADO POR LA VISTA HIJA ─────────────────────── --}}
        @yield('contenido')

    </div>

</body>

</html>

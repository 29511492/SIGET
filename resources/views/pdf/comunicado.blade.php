@extends('pdf.pdf_master')

@section('contenido')
    {{-- ── Datos del destinatario ────────────────────────────────────────── --}}
    <div class="seccion">
        <table class="tabla-datos">
            <tr>
                <td class="etiqueta">Ciudadano (a)</td>
                <td class="valor"><strong>{{ strtoupper($comunicado->destinatario) }}</strong></td>
            </tr>
            @if ($comunicado->cargo_destinatario)
                <tr>
                    <td class="etiqueta">Cargo</td>
                    <td class="valor">{{ $comunicado->cargo_destinatario }}</td>
                </tr>
            @endif
            <tr>
                <td class="etiqueta">Presente</td>
                <td class="valor">&mdash;</td>
            </tr>
        </table>
    </div>

    <hr class="linea-gris">

    {{-- ── Asunto ──────────────────────────────────────────────────────────── --}}
    <div class="seccion">
        <table class="tabla-datos">
            <tr>
                <td class="etiqueta">Ref. / Asunto</td>
                <td class="valor"><strong>{{ $comunicado->asunto }}</strong></td>
            </tr>
        </table>
    </div>

    <hr class="linea-dorada">

    {{-- ── Saludo formal ───────────────────────────────────────────────────── --}}
    <div class="cuerpo-texto">
        <p>Estimado (a) ciudadano (a) <strong>{{ $comunicado->destinatario }}</strong>:</p>
    </div>

    {{-- ── Cuerpo del comunicado ───────────────────────────────────────────── --}}
    <div class="cuerpo-texto">
        {!! nl2br(e($comunicado->cuerpo)) !!}
    </div>

    {{-- ── Despedida formal ────────────────────────────────────────────────── --}}
    <div class="cuerpo-texto" style="margin-top: 20px;">
        <p>
            Sin más a que hacer referencia y en espera de una pronta y favorable respuesta,
            se despide de usted atentamente,
        </p>
    </div>

    {{-- ── Firmas ──────────────────────────────────────────────────────────── --}}
    <div class="firma-bloque" style="margin-top: 36px;">
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
            @if ($comunicado->numero_oficio)
                <div class="membrete-rif" style="margin-top: 6px;">
                    Oficio: {{ $comunicado->numero_oficio }}
                </div>
            @endif
        </div>
    </div>

    {{-- ── Nota de auditoría ───────────────────────────────────────────────── --}}
    <div class="nota-validez" style="margin-top: 28px;">
        Documento generado por SIGET el {{ now()->format('d/m/Y \a \l\a\s H:i') }} hrs.
        @if ($comunicado->user)
            Redactado por: {{ $comunicado->user->name }}.
        @endif
        Número de oficio: {{ $comunicado->numero_oficio ?? '—' }}.
    </div>
@endsection

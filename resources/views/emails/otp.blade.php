<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Código de verificación — SIGET</title>
    <style>
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #f5f7fa;
            margin: 0;
            padding: 0;
        }

        .wrapper {
            max-width: 520px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(13, 31, 53, 0.12);
        }

        .header {
            background: #0d1f35;
            padding: 28px 32px;
            text-align: center;
        }

        .header h1 {
            color: #c9a84c;
            font-size: 1.2rem;
            margin: 0;
            letter-spacing: 1px;
        }

        .header p {
            color: #a0b4c8;
            font-size: 0.8rem;
            margin: 6px 0 0 0;
        }

        .body {
            padding: 32px;
        }

        .saludo {
            font-size: 1rem;
            color: #0d1f35;
            font-weight: 600;
            margin-bottom: 12px;
        }

        .texto {
            font-size: 0.9rem;
            color: #4a5568;
            line-height: 1.7;
            margin-bottom: 24px;
        }

        .otp-box {
            background: #f0f4f8;
            border: 2px dashed #c9a84c;
            border-radius: 8px;
            text-align: center;
            padding: 20px;
            margin: 24px 0;
        }

        .otp-codigo {
            font-size: 2.4rem;
            font-weight: 900;
            color: #0d1f35;
            letter-spacing: 8px;
            font-family: monospace;
        }

        .otp-expira {
            font-size: 0.78rem;
            color: #8898aa;
            margin-top: 8px;
        }

        .advertencia {
            background: #fff8e6;
            border-left: 3px solid #c9a84c;
            padding: 10px 14px;
            border-radius: 4px;
            font-size: 0.82rem;
            color: #7d6008;
            margin-top: 20px;
        }

        .footer {
            background: #f5f7fa;
            padding: 16px 32px;
            text-align: center;
            font-size: 0.75rem;
            color: #8898aa;
            border-top: 1px solid #e4e9f0;
        }
    </style>
</head>

<body>
    <div class="wrapper">

        <div class="header">
            <h1>SIGET — Sistema de Gestión Territorial</h1>
            <p>Consejo Comunal &mdash; {{ config('app.nombre_consejo', 'Comunidad') }}</p>
        </div>

        <div class="body">
            <p class="saludo">Hola, {{ $nombre }}.</p>

            @if ($motivo === 'desbloqueo')
                <p class="texto">
                    Tu cuenta ha sido bloqueada temporalmente por múltiples intentos de acceso fallidos.
                    Usa el siguiente código para desbloquearla y establecer una nueva contraseña:
                </p>
            @else
                <p class="texto">
                    Recibimos una solicitud para recuperar el acceso a tu cuenta en SIGET.
                    Usa el siguiente código para verificar tu identidad y cambiar tu contraseña:
                </p>
            @endif

            <div class="otp-box">
                <div class="otp-codigo">{{ $otp }}</div>
                <div class="otp-expira">Este código expira en <strong>15 minutos</strong>.</div>
            </div>

            <div class="advertencia">
                ⚠ Si no solicitaste este código, ignora este correo. Tu cuenta permanece segura.
            </div>
        </div>

        <div class="footer">
            Este mensaje fue generado automáticamente por SIGET. No respondas a este correo.
        </div>

    </div>
</body>

</html>

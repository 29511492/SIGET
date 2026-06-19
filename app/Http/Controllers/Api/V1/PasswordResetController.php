<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Mail\OtpMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class PasswordResetController extends Controller
{
    // ─────────────────────────────────────────────────────────
    //  POST /api/v1/forgot-password
    //  Genera OTP y lo envía por correo.
    //  Sirve tanto para "olvidé contraseña" como para desbloqueo.
    // ─────────────────────────────────────────────────────────
    public function enviarOtp(ForgotPasswordRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = User::where('email', $request->email)->first();

        $otp    = $user->generarOtp();
        $motivo = $user->is_locked ? 'desbloqueo' : 'recuperacion';

        Mail::to($user->email)->send(new OtpMail(
            otp:    $otp,
            motivo: $motivo,
            nombre: $user->name,
        ));

        return response()->json([
            'message' => 'Código de verificación enviado a tu correo.',
            'locked'  => $user->is_locked,
        ], 200);
    }

    // ─────────────────────────────────────────────────────────
    //  POST /api/v1/verify-otp
    //  Valida el OTP sin cambiar contraseña todavía.
    //  Permite al frontend mostrar el formulario de nueva contraseña
    //  solo si el código es correcto.
    // ─────────────────────────────────────────────────────────
    public function verificarOtp(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email', 'exists:users,email'],
            'otp'   => ['required', 'string', 'size:6'],
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user->otpEsValido($request->otp)) {
            return response()->json([
                'message' => 'El código es incorrecto o ha expirado.',
                'errors'  => ['otp' => ['Código inválido o expirado.']],
            ], 422);
        }

        return response()->json([
            'message' => 'Código verificado correctamente.',
            'valid'   => true,
        ], 200);
    }

    // ─────────────────────────────────────────────────────────
    //  POST /api/v1/reset-password
    //  Verifica OTP, cambia contraseña y desbloquea la cuenta.
    // ─────────────────────────────────────────────────────────
    public function resetearPassword(ResetPasswordRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = User::where('email', $request->email)->first();

        if (! $user->otpEsValido($request->otp)) {
            return response()->json([
                'message' => 'El código es incorrecto o ha expirado.',
                'errors'  => ['otp' => ['Código inválido o expirado.']],
            ], 422);
        }

        // Actualizar contraseña — el cast 'hashed' del modelo la encripta
        $user->update(['password' => $request->password]);

        // Desbloquear cuenta y limpiar OTP en una sola operación
        $user->desbloquear();

        // Revocar todos los tokens activos por seguridad
        $user->tokens()->delete();

        return response()->json([
            'message' => 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.',
        ], 200);
    }
}

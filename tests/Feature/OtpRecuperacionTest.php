<?php

namespace Tests\Feature;

use App\Mail\OtpMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Código OTP de recuperación de contraseña y desbloqueo de cuenta (ERR-04).
 * El OTP se guarda con hash; en la base de datos nunca queda el código.
 */
class OtpRecuperacionTest extends TestCase
{
    use RefreshDatabase;

    private function crearUsuario(): User
    {
        return User::create([
            'name'     => 'Usuario de prueba',
            'email'    => 'otp@prueba.test',
            'password' => 'password123',
            'rol'      => 'usuario',
        ]);
    }

    private function codigoDistintoDe(string $codigo): string
    {
        return $codigo === '000000' ? '111111' : '000000';
    }

    public function test_el_otp_se_guarda_con_hash_y_no_en_texto_plano(): void
    {
        $user   = $this->crearUsuario();
        $codigo = $user->generarOtp();

        $this->assertMatchesRegularExpression('/^\d{6}$/', $codigo);

        $guardado = $user->fresh()->otp_code;

        $this->assertNotSame($codigo, $guardado);
        $this->assertTrue(Hash::isHashed($guardado));
        $this->assertTrue(Hash::check($codigo, $guardado));
    }

    public function test_el_otp_correcto_es_valido_y_uno_incorrecto_no(): void
    {
        $user   = $this->crearUsuario();
        $codigo = $user->generarOtp();
        $user   = $user->fresh();

        $this->assertTrue($user->otpEsValido($codigo));
        $this->assertFalse($user->otpEsValido($this->codigoDistintoDe($codigo)));
    }

    public function test_el_otp_vence_a_los_15_minutos(): void
    {
        $user   = $this->crearUsuario();
        $codigo = $user->generarOtp();

        $this->travel(16)->minutes();

        $this->assertFalse($user->fresh()->otpEsValido($codigo));
    }

    public function test_el_otp_deja_de_valer_al_limpiarlo(): void
    {
        $user   = $this->crearUsuario();
        $codigo = $user->generarOtp();

        $user->limpiarOtp();

        $this->assertNull($user->fresh()->otp_code);
        $this->assertFalse($user->fresh()->otpEsValido($codigo));
    }

    public function test_un_valor_antiguo_en_texto_plano_se_rechaza_sin_error(): void
    {
        $user = $this->crearUsuario();
        $user->forceFill([
            'otp_code'       => '123456',
            'otp_expires_at' => now()->addMinutes(10),
        ])->save();

        $this->assertFalse($user->fresh()->otpEsValido('123456'));
    }

    public function test_forgot_password_envia_el_correo_y_guarda_un_hash(): void
    {
        Mail::fake();
        $user = $this->crearUsuario();

        $this->postJson('/api/v1/forgot-password', ['email' => $user->email])->assertOk();

        Mail::assertSent(OtpMail::class, fn ($mail) => $mail->hasTo($user->email));
        $this->assertTrue(Hash::isHashed($user->fresh()->otp_code));
    }

    public function test_verify_otp_acepta_el_codigo_correcto_y_rechaza_el_incorrecto(): void
    {
        $user   = $this->crearUsuario();
        $codigo = $user->generarOtp();

        $this->postJson('/api/v1/verify-otp', ['email' => $user->email, 'otp' => $codigo])
            ->assertOk()
            ->assertJsonPath('valid', true);

        $this->postJson('/api/v1/verify-otp', [
            'email' => $user->email,
            'otp'   => $this->codigoDistintoDe($codigo),
        ])->assertStatus(422);
    }
}

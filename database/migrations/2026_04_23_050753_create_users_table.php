<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: users (+ password_reset_tokens, sessions)
 * ───────────────────────────────────────────────────────────────
 *  DECISIONES ARQUITECTÓNICAS:
 *  1. `rol` como ENUM controlado: evita valores inconsistentes
 *     ('Admin', 'ADMIN', 'admin') que rompen la autorización.
 *
 *  2. `softDeletes()`: los usuarios NUNCA se eliminan físicamente,
 *     para preservar la integridad con `auditorias`.
 *
 *  3. Campos de seguridad (bloqueo por intentos fallidos y OTP de
 *     recuperación) y `cedula` viven aquí desde la creación de la
 *     tabla. Antes se agregaban con una migración `alter_users_...`
 *     posterior; se fusionaron para dejar una instalación limpia
 *     con un solo archivo por tabla.
 *
 *  NOTA: `habitante_id` NO se agrega aquí. Lo añade la migración
 *  `add_habitante_id_to_users_table`, porque `habitantes` se crea
 *  después de `users` (orden de dependencias FK, patrón
 *  Two-Phase Migration).
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('cedula', 20)->nullable()->unique();
            $table->string('email', 150)->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');

            // ── Bloqueo por intentos fallidos ─────────────────
            $table->unsignedTinyInteger('failed_attempts')->default(0);
            $table->boolean('is_locked')->default(false);
            $table->timestamp('locked_at')->nullable();

            // ── OTP para recuperación y desbloqueo ────────────
            $table->string('otp_code', 6)->nullable();
            $table->timestamp('otp_expires_at')->nullable();

            // ENUM estricto: evita valores arbitrarios como 'superAdmin'
            $table->enum('rol', ['admin', 'operador', 'vocero', 'usuario'])
                ->default('usuario');

            $table->rememberToken();
            $table->softDeletes(); // deleted_at: desactivación lógica, no física
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};

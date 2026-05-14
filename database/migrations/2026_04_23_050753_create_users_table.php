<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: users
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA:
 *  Se migra el campo `rol` de string libre a ENUM controlado.
 *  Un string libre permite valores inconsistentes ('Admin', 'ADMIN',
 *  'admin') que rompen la autorización. El ENUM garantiza integridad
 *  a nivel de base de datos, sin depender solo de la validación PHP.
 *
 *  Se agrega `softDeletes()`: los usuarios NUNCA se eliminan físicamente.
 *  Esto preserva la integridad referencial con `auditorias` y cumple
 *  con buenas prácticas de trazabilidad en sistemas de gestión pública.
 *
 *  NOTA: `habitante_id` NO se agrega aquí. Se añadirá en una migración
 *  posterior (after habitantes) para respetar el orden de dependencias FK.
 *  Patrón: Dependency Order en migraciones.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('email', 150)->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');

            // ENUM estricto: evita valores arbitrarios como 'superAdmin' o 'OPERADOR'
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

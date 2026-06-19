<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {

            // ── Campos de bloqueo por intentos fallidos ────────────
            $table->unsignedTinyInteger('failed_attempts')
                 ->default(0)
                 ->after('password');

            $table->boolean('is_locked')
                  ->default(false)
                  ->after('failed_attempts');

            $table->timestamp('locked_at')
                  ->nullable()
                  ->after('is_locked');

            // ── Campos OTP para recuperación y desbloqueo ──────────
            $table->string('otp_code', 6)
                  ->nullable()
                  ->after('locked_at');

            $table->timestamp('otp_expires_at')
                  ->nullable()
                  ->after('otp_code');

            // ── Cédula/DNI para registro de habitantes ─────────────
            // Solo añadir si la columna no existe ya en users
            // (puede existir en habitantes pero no en users)
            if (!Schema::hasColumn('users', 'cedula')) {
                $table->string('cedula', 20)
                      ->nullable()
                      ->unique()
                      ->after('name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'failed_attempts',
                'is_locked',
                'locked_at',
                'otp_code',
                'otp_expires_at',
            ]);

            if (Schema::hasColumn('users', 'cedula')) {
                $table->dropColumn('cedula');
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  ALTER: users ← añade habitante_id FK
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA — ¿Por qué una migración separada?
 *
 *  `users` se crea en el archivo 000000 (el primero).
 *  `habitantes` se crea después. Si ponemos la FK en la primera
 *  migración, Laravel fallará porque la tabla `habitantes` no
 *  existe aún en ese momento.
 *
 *  La solución correcta es un ALTER posterior: primero creamos
 *  ambas tablas, luego establecemos la relación entre ellas.
 *  Patrón: Two-Phase Migration (crear → relacionar).
 *
 *  Esta FK permite responder: "¿Qué usuario del sistema
 *  corresponde a qué habitante del censo?"
 *  Es opcional (nullable) porque un admin técnico puede no
 *  estar registrado en el padrón comunal.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('habitante_id')
                ->nullable()
                ->after('rol')
                ->constrained('habitantes')
                ->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['habitante_id']);
            $table->dropColumn('habitante_id');
        });
    }
};

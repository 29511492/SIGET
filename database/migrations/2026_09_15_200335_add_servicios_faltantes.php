<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  Agrega servicios básicos adicionales a `familias`: luz y aseo.
 * ───────────────────────────────────────────────────────────────
 *  Se agregan como boolean default true, siguiendo exactamente la
 *  misma convención que `posee_agua_potable` (columna existente
 *  desde la migración original de la tabla).
 *
 *  Schema::table incremental — NUNCA migrate:fresh. No se usa
 *  ->after() porque ese modificador solo lo soporta MySQL/MariaDB;
 *  en PostgreSQL se ignora silenciosamente y las columnas se
 *  agregan al final de la tabla, que es el comportamiento esperado
 *  aquí.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('familias', function (Blueprint $table) {
            $table->boolean('posee_luz')->default(true);
            $table->boolean('posee_aseo')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('familias', function (Blueprint $table) {
            $table->dropColumn(['posee_luz', 'posee_aseo']);
        });
    }
};

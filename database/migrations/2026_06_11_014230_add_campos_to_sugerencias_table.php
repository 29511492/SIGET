<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migración incremental — tabla sugerencias
 *
 * Agrega los campos faltantes al schema original:
 *   + categoria  ENUM — clasifica el tipo de sugerencia
 *   + prioridad  ENUM — permite priorizar la atención
 *   + deleted_at — SoftDeletes para preservar historial
 *   + índices adicionales para filtros frecuentes
 *
 * Regla PostgreSQL: columnas → softDeletes → timestamps → índices.
 * SoftDeletes se agrega como columna de datos, índices al final.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sugerencias', function (Blueprint $table) {

            // ── 1. Nuevas columnas de datos ────────────────────
            $table->enum('categoria', [
                'mejora',
                'queja',
                'consulta',
                'emergencia',
            ])->default('consulta')->after('mensaje');

            $table->enum('prioridad', [
                'baja',
                'media',
                'alta',
            ])->default('media')->after('categoria');

            // ── 2. SoftDeletes ─────────────────────────────────
            $table->softDeletes()->after('revisada_en');

            // ── 3. Índices al final (regla PostgreSQL) ─────────
            $table->index('categoria');
            $table->index('prioridad');
        });
    }

    public function down(): void
    {
        Schema::table('sugerencias', function (Blueprint $table) {
            $table->dropIndex(['categoria']);
            $table->dropIndex(['prioridad']);
            $table->dropSoftDeletes();
            $table->dropColumn(['categoria', 'prioridad']);
        });
    }
};

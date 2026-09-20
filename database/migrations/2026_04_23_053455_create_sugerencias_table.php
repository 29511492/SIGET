<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: sugerencias
 * ───────────────────────────────────────────────────────────────
 *  DECISIONES ARQUITECTÓNICAS:
 *  1. `onDelete('set null')`: si el usuario que envió la sugerencia
 *     se da de baja, la sugerencia se conserva.
 *
 *  2. `revisada_por` (FK a users): trazabilidad de QUIÉN revisó.
 *
 *  3. `respuesta`: respuesta formal del operador dentro del sistema.
 *
 *  4. `categoria`, `prioridad` y `softDeletes` antes se agregaban
 *     con la migración `add_campos_to_sugerencias_table`; se
 *     fusionaron aquí para la instalación limpia.
 *
 *  Patrón: Workflow de doble actor (quien envía / quien revisa).
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sugerencias', function (Blueprint $table) {
            $table->id();

            // Quien envió la sugerencia
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->onDelete('set null');

            // Quien la revisó (admin u operador)
            $table->foreignId('revisada_por')
                ->nullable()
                ->constrained('users')
                ->onDelete('set null');

            $table->text('mensaje');

            $table->enum('categoria', [
                'mejora',
                'queja',
                'consulta',
                'emergencia',
            ])->default('consulta');

            $table->enum('prioridad', [
                'baja',
                'media',
                'alta',
            ])->default('media');

            $table->text('respuesta')->nullable(); // Respuesta formal del operador

            $table->boolean('revisada')->default(false);
            $table->timestamp('revisada_en')->nullable();

            $table->softDeletes();
            $table->timestamps();

            // Índices al final
            $table->index('revisada');
            $table->index('categoria');
            $table->index('prioridad');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sugerencias');
    }
};

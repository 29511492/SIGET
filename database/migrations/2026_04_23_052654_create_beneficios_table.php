<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: beneficios
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA:
 *  Se agrega `user_id` para trazabilidad: ¿qué operador registró
 *  la entrega de este beneficio? En sistemas de gestión pública,
 *  la trazabilidad de quién entregó qué y cuándo es un requisito
 *  de transparencia. Esto refuerza el módulo de auditoría.
 *
 *  Se agrega índice compuesto (familia_id, fecha_entrega):
 *  La consulta "todos los beneficios de la familia X, ordenados
 *  por fecha" es el patrón más frecuente en la vista de perfil
 *  de familia. El índice compuesto hace esta query óptima.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('beneficios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('familia_id')
                  ->constrained('familias')
                  ->onDelete('cascade');

            // Quién registró la entrega del beneficio
            $table->foreignId('user_id')
                  ->nullable()
                  ->constrained('users')
                  ->onDelete('set null');

            $table->string('nombre_beneficio', 200);
            $table->date('fecha_entrega')->nullable();
            $table->text('observaciones')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Optimiza "historial de beneficios por familia ordenado por fecha"
            $table->index(['familia_id', 'fecha_entrega'], 'idx_familia_fecha');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('beneficios');
    }
};

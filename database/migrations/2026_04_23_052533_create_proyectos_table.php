<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: proyectos
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA:
 *  1. `comite` (string libre) → `comite_id` (FK): misma corrección
 *     que en voceros. Consistencia en todo el esquema.
 *
 *  2. Se agrega `user_id` (FK a users): permite saber qué operador
 *     registró el proyecto. Fundamental para la auditoría y para
 *     responder "¿quién cargó este proyecto?" en la tesis.
 *
 *  3. Se agrega `fecha_fin` para registrar el cierre del proyecto.
 *     Con fecha_inicio + fecha_fin se puede calcular la duración
 *     real del proyecto vs. lo planificado (indicador de gestión).
 *
 *  4. Índice en `estatus`: las consultas del dashboard filtran
 *     frecuentemente por estatus ('en_ejecucion', 'paralizado').
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proyectos', function (Blueprint $table) {
            $table->id();

            $table->foreignId('sede_id')
                ->nullable()
                ->constrained('sedes')
                ->onDelete('set null');

            // FK a comites — reemplaza string libre
            $table->foreignId('comite_id')
                ->nullable()
                ->constrained('comites')
                ->onDelete('set null');

            // Quién registró el proyecto
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->onDelete('set null');

            $table->string('nombre_proyecto', 200);
            $table->text('objetivo');

            $table->decimal('monto_aprobado', 15, 2)->default(0.00);
            $table->enum('fuente_financiamiento', [
                'CFG',
                'Alcaldia',
                'Gobernacion',
                'Autogestion',
            ]);

            $table->enum('estatus', [
                'presentado',
                'aprobado',
                'en_ejecucion',
                'finalizado',
                'paralizado',
            ])->default('presentado');

            $table->date('fecha_inicio')->nullable();
            $table->date('fecha_fin')->nullable(); // añadido: cierre del proyecto

            $table->softDeletes();
            $table->timestamps();

            $table->index('estatus'); // Optimiza filtros del dashboard
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proyectos');
    }
};

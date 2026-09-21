<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: habitantes
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA:
 *  1. `softDeletes()`: un habitante dado de baja (mudanza,
 *     fallecimiento) no debe borrarse. Sus registros históricos
 *     (pagos, beneficios) deben mantenerse.
 *
 *  2. `nivel_educativo` incluye 'tecnico' y 'postgrado': la
 *     clasificación original era demasiado básica para un censo.
 *
 *  3. `cedula` es unique (y nullable): el índice único ya sirve
 *     para buscar por cédula, por eso no se define un índice
 *     adicional.
 *
 *  4. Índice en `familia_id`: PostgreSQL no indexa las FK
 *     automáticamente; este índice acelera la carga de
 *     $familia->habitantes (hasMany).
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('habitantes', function (Blueprint $table) {
            $table->id();

            $table->foreignId('familia_id')
                ->constrained('familias')
                ->onDelete('cascade');

            $table->string('cedula', 15)->unique()->nullable();
            $table->string('nombres', 100);
            $table->string('apellidos', 100);
            $table->date('fecha_nacimiento');
            $table->enum('sexo', ['masculino', 'femenino', 'otro']);

            // Indicadores sociales
            $table->boolean('es_discapacitado')->default(false);
            $table->string('tipo_discapacidad', 100)->nullable(); // Detalle si es_discapacitado = true
            $table->string('enfermedad_cronica', 150)->nullable();

            $table->enum('nivel_educativo', [
                'ninguno',
                'primaria',
                'bachillerato',
                'tecnico',
                'universitario',
                'postgrado',
            ])->default('ninguno');

            $table->softDeletes();
            $table->timestamps();

            // Índices al final
            $table->index('familia_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('habitantes');
    }
};

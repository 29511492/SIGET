<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: habitantes
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA:
 *  1. `softDeletes()`: un habitante dado de baja (mudanza, fallecimiento)
 *     no debe borrarse. Sus registros históricos (pagos, beneficios)
 *     deben mantenerse. El soft delete actúa como "dar de baja" al
 *     ciudadano sin destruir su historial.
 *
 *  2. `nivel_educativo` agrega 'tecnico' y 'postgrado': la clasificación
 *     original era demasiado básica para un censo moderno.
 *
 *  3. Índice en `cedula`: es la forma más común de buscar un habitante
 *     ("buscar por cédula"). Sin índice, cada búsqueda es O(n).
 *     Con el índice, es O(log n). En un census con miles de registros,
 *     la diferencia es significativa.
 *
 *  4. Índice en `familia_id`: Eloquent usará este índice al cargar
 *     la relación $familia->habitantes (método hasMany). Sin él,
 *     MySQL haría full scan en cada carga de página de familia.
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

            // Nivel educativo ampliado
            $table->enum('nivel_educativo', [
                'ninguno',
                'primaria',
                'bachillerato',
                'tecnico',        // añadido
                'universitario',
                'postgrado',      // añadido
            ])->default('ninguno');

            $table->softDeletes();
            $table->timestamps();

            // Índices para búsquedas frecuentes
            $table->index('cedula');
            $table->index('familia_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('habitantes');
    }
};

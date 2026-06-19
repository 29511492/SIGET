<?php
/**
 * ⚠️ MIGRACIÓN ORIGINAL — SCHEMA INCORRECTO
 * Esta migración creó la tabla noticias con columnas erróneas.
 * Fue corregida por: 2026_06_06_052032_fix_noticias_table_to_correct_schema.php
 * NO eliminar — Laravel necesita este registro para reconstruir el historial.
 */
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizaciones', function (Blueprint $table) {
            $table->id();

            $table->string('nombre', 150);

            $table->enum('tipo_servicio', [
                'agua',
                'electricidad',
                'gas',
                'salud',
                'educacion',
                'seguridad',
                'transporte',
                'otro',
            ])->default('otro');

            // Teléfono, WhatsApp o email — el frontend detecta el tipo
            $table->string('contacto', 100)->nullable();

            $table->text('descripcion')->nullable();

            // true = visible en el directorio público
            $table->boolean('estatus')->default(true);

            $table->timestamps();
            $table->softDeletes(); // admin da de baja sin eliminar físicamente

            $table->index('tipo_servicio');
            $table->index('estatus');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organizaciones');
    }
};

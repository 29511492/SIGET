<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: organizaciones
 * ───────────────────────────────────────────────────────────────
 *  Esquema final que usa el código actual de SIGET. Es la única
 *  migración que crea esta tabla (ya no existe una versión previa
 *  que haya que reemplazar con dropIfExists).
 * ═══════════════════════════════════════════════════════════════
 */
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

            // Teléfono, WhatsApp o email — el frontend detecta el tipo automáticamente
            $table->string('contacto', 100)->nullable();

            $table->text('descripcion')->nullable();

            // true = visible en el directorio público, false = dado de baja
            $table->boolean('estatus')->default(true);

            $table->timestamps();

            // SoftDeletes: rellena deleted_at en lugar de eliminar físicamente
            $table->softDeletes();

            // Índices para los filtros más frecuentes del index()
            $table->index('tipo_servicio');
            $table->index('estatus');
            $table->index('deleted_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organizaciones');
    }
};

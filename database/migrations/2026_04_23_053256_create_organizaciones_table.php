<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  MIGRACIÓN DE REEMPLAZO — tabla organizaciones
 * ───────────────────────────────────────────────────────────────
 *  Esta migración elimina la tabla anterior (vacía) y la recrea
 *  con la estructura correcta que usa el código actual de SIGET.
 *
 *  Archivo: database/migrations/[timestamp]_recreate_organizaciones_table.php
 *
 *  Comandos de instalación:
 *    php artisan migrate:rollback --path=database/migrations/[archivo_anterior]
 *    php artisan migrate --path=database/migrations/[este_archivo]
 *
 *  O si quieres correr todas las pendientes:
 *    php artisan migrate
 *
 *  Diferencias respecto a la tabla anterior:
 *    ANTES               → AHORA
 *    nombre_organizacion → nombre
 *    tipo (4 valores)    → tipo_servicio (8 valores)
 *    codigo_situr        → contacto
 *    (sin estatus)       → estatus boolean default true
 *    (sin deleted_at)    → deleted_at (SoftDeletes)
 *    sede_id FK          → eliminado (no está en el modelo actual)
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        // Drop seguro — la tabla está vacía y confirmada por el usuario
        Schema::dropIfExists('organizaciones');

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

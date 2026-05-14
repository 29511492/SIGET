<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: eventos_calendario
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA:
 *  1. Misma corrección que noticias: `onDelete('set null')` en lugar
 *     de cascade. Un evento comunal no debe desaparecer si el usuario
 *     que lo creó es dado de baja.
 *
 *  2. Se agrega `hora_inicio` y `hora_fin` opcionales: un evento
 *     "Asamblea de voceros" necesita hora, no solo fecha. Esto
 *     permite mostrar eventos con duración real en el calendario.
 *
 *  3. Se agrega índice en `fecha`: el calendario cargará eventos
 *     frecuentemente filtrando por mes. Sin índice, cada cambio
 *     de mes haría full-table-scan.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('eventos_calendario', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                  ->onDelete('set null'); // corregido: era cascade

            $table->string('titulo', 255);
            $table->date('fecha');
            $table->time('hora_inicio')->nullable(); // añadido
            $table->time('hora_fin')->nullable();    // añadido
            $table->text('descripcion')->nullable();
            $table->string('color_etiqueta', 20)->default('#3b82f6');

            $table->timestamps();

            $table->index('fecha'); // Optimiza "eventos del mes X"
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('eventos_calendario');
    }
};

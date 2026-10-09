<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: encuesta_respuestas
 * ───────────────────────────────────────────────────────────────
 *  Una fila = una entrega registrada para una familia dentro de una
 *  encuesta. Depende de `encuestas` y `familias` (timestamps previos).
 *
 *  FK con restrict: ni la encuesta ni la familia se borran
 *  físicamente (ambas usan SoftDeletes), así que el historial que
 *  consume el estimador de consumo no se pierde.
 *
 *  Índices: PostgreSQL no indexa las FK automáticamente. Se agregan
 *  el compuesto por familia (estimador de consumo) y uno por
 *  encuesta (listado de entregas de una campaña).
 *
 *  La no duplicación (misma familia + encuesta + fecha) se valida en
 *  los FormRequest ignorando registros dados de baja, no con un
 *  unique de BD, porque el soft delete no libera esa combinación.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('encuesta_respuestas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('encuesta_id')->constrained('encuestas')->restrictOnDelete();
            $table->foreignId('familia_id')->constrained('familias')->restrictOnDelete();
            $table->integer('cantidad');
            $table->date('fecha_entrega');
            $table->text('observaciones')->nullable();

            $table->softDeletes();
            $table->timestamps();

            $table->index(['familia_id', 'encuesta_id', 'fecha_entrega']);
            $table->index(['encuesta_id', 'fecha_entrega']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('encuesta_respuestas');
    }
};

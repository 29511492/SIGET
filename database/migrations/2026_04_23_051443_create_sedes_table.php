<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: sedes
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA:
 *  `tipo_sede` se convierte de string libre a ENUM. En el sistema
 *  original, un operador podría escribir "administrativa",
 *  "Administrativa" o "administ." — tres valores distintos para
 *  el mismo concepto. El ENUM lo previene a nivel de DB.
 *
 *  Se agrega `softDeletes()`: una sede puede cerrarse pero sus
 *  historiales de familias, voceros y proyectos deben preservarse.
 *  Eliminar físicamente una sede huérfana los datos relacionados.
 *  Patrón: Data Preservation + Soft Delete.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sedes', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 100);
            $table->string('direccion', 255);

            // ENUM: reemplaza el string libre del original
            $table->enum('tipo_sede', [
                'administrativa',
                'salud',
                'educativa',
                'deportiva',
                'cultural',
                'otra',
            ])->default('administrativa');

            $table->enum('estado_infraestructura', ['optima', 'regular', 'critica'])
                ->default('optima');

            $table->text('observaciones')->nullable();

            // Oct-2026 (georreferenciación): polígono del territorio de la sede
            // (array de coordenadas [lng, lat]) para dibujar su contorno en el
            // mapa de calor. Nullable: no todas las sedes lo tendrán trazado.
            $table->json('limites')->nullable();

            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sedes');
    }
};

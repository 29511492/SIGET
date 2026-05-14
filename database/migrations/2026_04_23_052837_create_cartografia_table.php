<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: cartografia
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA:
 *  Se agrega `sede_id` FK: cada punto cartográfico pertenece a
 *  una sede, permitiendo filtrar el mapa por sede en el frontend.
 *
 *  NOTA TÉCNICA sobre precisión de coordenadas:
 *  decimal(10,8) para latitud y decimal(11,8) para longitud.
 *  Con 8 decimales, la precisión es ±1.1mm en el ecuador.
 *  Más que suficiente para cartografía comunal.
 *  Si en el futuro se necesitan polígonos (no solo puntos),
 *  se migraría a tipo GEOMETRY de MySQL — decisión Just-in-Time.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cartografia', function (Blueprint $table) {
            $table->id();

            $table->foreignId('sede_id')
                ->nullable()
                ->constrained('sedes')
                ->onDelete('set null');

            $table->string('nombre_sector', 150);
            $table->decimal('latitud', 10, 8);
            $table->decimal('longitud', 11, 8);
            $table->text('descripcion_limites')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cartografia');
    }
};

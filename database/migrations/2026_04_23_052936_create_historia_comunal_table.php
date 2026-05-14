<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: historia_comunal
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA:
 *  Se reemplaza `autor` (string libre) por `user_id` (FK a users).
 *  Un string libre "autor" es ambiguo: ¿es el nombre del redactor
 *  o del historiador original? Con la FK, sabemos exactamente
 *  qué usuario del sistema registró el hecho, preservando la
 *  cadena de responsabilidad.
 *
 *  Se mantiene `autor` como campo libre ADICIONAL para registrar
 *  el nombre de la fuente histórica original (Ej: "Testimonio de
 *  la Sra. Carmen Díaz, fundadora del sector") — distinto del
 *  usuario que lo digitalizó.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('historia_comunal', function (Blueprint $table) {
            $table->id();

            // Quién digitalizó este registro en el sistema
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->onDelete('set null');

            $table->string('titulo', 255);
            $table->text('descripcion');
            $table->year('anio_suceso')->nullable();

            // Fuente histórica original (puede ser distinta del user que digitalizó)
            $table->string('fuente_original', 200)->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('historia_comunal');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: encuestas
 * ───────────────────────────────────────────────────────────────
 *  Campaña de censo territorial (entrega de gas, bolsas CLAP, etc.).
 *  `tipo` es string validado en la app (constante Encuesta::TIPOS),
 *  no enum de PostgreSQL: agregar un tipo no vuelve a tocar el esquema.
 *
 *  Orden Blueprint (regla 14): columnas → softDeletes → timestamps
 *  → índices.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('encuestas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 150);
            $table->string('tipo', 30); // bombona_gas | bolsa_clap | otro
            $table->text('descripcion')->nullable();
            $table->date('fecha_inicio')->nullable();
            $table->date('fecha_cierre')->nullable();
            $table->boolean('activa')->default(true);

            $table->softDeletes();
            $table->timestamps();

            $table->index('tipo');
            $table->index('activa');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('encuestas');
    }
};

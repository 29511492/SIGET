<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: voceros
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA — Corrección crítica:
 *
 *  PROBLEMA ORIGINAL: `comite` era un string libre nullable.
 *  Esto permitía "Salud", "salud", "SALUD" como valores distintos,
 *  haciendo imposible agrupar voceros por comité en reportes.
 *
 *  SOLUCIÓN: Se reemplaza `comite` (string) por `comite_id` (FK
 *  a la tabla `comites`). Ahora hay una única fuente de verdad
 *  para los nombres de comités. Esto es el principio DRY
 *  (Don't Repeat Yourself) aplicado al diseño de base de datos.
 *
 *  TAMBIÉN: Se agrega `fecha_fin` para registrar cuándo terminó
 *  el mandato, sin eliminar el registro histórico del vocero.
 *  Un vocero puede tener múltiples mandatos a lo largo del tiempo.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('voceros', function (Blueprint $table) {
            $table->id();

            $table->foreignId('habitante_id')
                ->constrained('habitantes')
                ->onDelete('cascade');

            $table->foreignId('sede_id')
                ->constrained('sedes')
                  ->onDelete('restrict'); // No permitir eliminar sede con voceros activos

            // FK a comites — reemplaza el string libre del original
            $table->foreignId('comite_id')
                ->nullable()
                ->constrained('comites')
                ->onDelete('set null');

            $table->string('unidad_comunal', 150);
            $table->date('fecha_eleccion');
            $table->date('fecha_fin')->nullable(); // Fin del mandato (si ya culminó)
            $table->boolean('esta_activo')->default(true);

            $table->timestamps();

            // Índice: consultas frecuentes de voceros activos por sede
            $table->index(['sede_id', 'esta_activo'], 'idx_sede_activo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voceros');
    }
};

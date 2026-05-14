<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: comites
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA — Adelanto de posición en el orden:
 *
 *  En el esquema original esta migración estaba al final (abril).
 *  Se mueve ANTES que `calles` porque `voceros` y `proyectos`
 *  referenciarán `comite_id` (FK). Sin este adelanto, esas FKs
 *  fallarían al ejecutar `php artisan migrate`.
 *
 *  Patrón aplicado: Dependency Graph en migraciones.
 *  Antes de crear una migración, mapeamos el grafo de dependencias:
 *  comites → (ninguna)
 *  calles  → sedes
 *  familias → sedes, calles
 *  habitantes → familias
 *  voceros → habitantes, sedes, comites   ← necesita comites primero
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comites', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 100)->unique();
            $table->text('descripcion')->nullable(); // Campo añadido: útil para reportes
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comites');
    }
};

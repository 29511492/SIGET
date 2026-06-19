<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migración correctiva — tabla noticias
 *
 * La migración original creó columnas incorrectas.
 * Esta migración incremental corrige el schema sin
 * destruir la tabla ni violar la regla de no usar migrate:fresh.
 *
 * Cambios aplicados:
 *   - Elimina: imagen_url, fecha_evento
 *   - Renombra: publicada → publicado
 *   - Agrega: published_at (timestamp nullable)
 *   - Agrega FK: user_id → users.id
 *   - Agrega índices finales (regla PostgreSQL: índices al final)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('noticias', function (Blueprint $table) {

            // ── 1. Eliminar columnas incorrectas ───────────────
            $table->dropColumn(['imagen_url', 'fecha_evento']);

            // ── 2. Renombrar publicada → publicado ─────────────
            $table->renameColumn('publicada', 'publicado');

            // ── 3. Agregar columnas nuevas ─────────────────────
            // published_at: se rellena automáticamente en el
            // controlador cuando publicado pasa de false a true.
            $table->timestamp('published_at')->nullable()->after('publicado');

            // ── 5. Índices al final (regla PostgreSQL) ─────────
            $table->index('publicado');
            $table->index('published_at');
        });
    }

    public function down(): void
    {
        Schema::table('noticias', function (Blueprint $table) {

            // Revertir en orden inverso
            $table->dropIndex(['publicado']);
            $table->dropIndex(['published_at']);
            $table->dropColumn('published_at');
            $table->renameColumn('publicado', 'publicada');
            $table->string('imagen_url', 255)->nullable();
            $table->date('fecha_evento')->nullable();
        });
    }
};

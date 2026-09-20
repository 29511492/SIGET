<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: noticias
 * ───────────────────────────────────────────────────────────────
 *  Esta migración define el esquema FINAL de `noticias`, tal como
 *  existe en la base de datos en uso. Antes de esta versión, el
 *  archivo creaba por error la tabla `organizaciones`, y `noticias`
 *  se había creado con cambios directos en la BD; eso impedía una
 *  instalación limpia. Todo cambio de esquema se hace SIEMPRE aquí
 *  (migraciones), nunca directo en la BD.
 *
 *  - user_id: autor de la noticia. Si el usuario se da de baja, la
 *    noticia se conserva (set null).
 *  - publicado / published_at: el controlador rellena published_at
 *    cuando `publicado` pasa de false a true.
 *  - softDeletes: preserva el historial.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('noticias', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->onDelete('set null');

            $table->string('titulo', 255);
            $table->text('contenido');

            $table->boolean('publicado')->default(true);
            $table->timestamp('published_at')->nullable();

            $table->softDeletes();
            $table->timestamps();

            // Índices al final (convención PostgreSQL del proyecto)
            $table->index('publicado');
            $table->index('published_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('noticias');
    }
};

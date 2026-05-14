<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: calles
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA:
 *  Sin cambios estructurales mayores. Se mantiene la FK a `sedes`
 *  con CASCADE: si una sede es eliminada (soft delete), sus calles
 *  también quedan inaccesibles en cascada.
 *
 *  NOTA sobre soft deletes en cascada:
 *  Laravel's softDeletes() es a nivel de aplicación, no de DB.
 *  La FK ON DELETE CASCADE opera a nivel de DB sobre el DELETE físico.
 *  Para coherencia total, el Service de Sedes debe encargarse de
 *  propagar el soft-delete a sus calles. Esto se documenta en el
 *  SedeService para transparencia en la tesis.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sede_id')
                ->constrained('sedes')
                ->onDelete('cascade');
            $table->string('nombre', 150);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calles');
    }
};

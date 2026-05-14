<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: cache / cache_locks
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA:
 *  Migración estándar de Laravel 11. No se modifica.
 *  El sistema de caché se utilizará en SIGET para almacenar
 *  temporalmente los conteos del dashboard (total_familias,
 *  total_habitantes, etc.) y evitar queries repetidas en cada
 *  carga de página. Patrón aplicado: Cache-Aside.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cache', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->mediumText('value');
            $table->integer('expiration')->index();
        });

        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('owner');
            $table->integer('expiration')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cache_locks');
        Schema::dropIfExists('cache');
    }
};

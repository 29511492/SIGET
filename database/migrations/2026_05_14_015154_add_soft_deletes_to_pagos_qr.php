<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  MIGRACIÓN DE ALTERACIÓN — añade deleted_at a pagos_qr
 * ───────────────────────────────────────────────────────────────
 *  Por qué ocurre el error:
 *  La tabla pagos_qr fue creada con la migración ORIGINAL (sin
 *  softDeletes). La migración de reemplazo que generamos no se
 *  ejecutó. El modelo PagoQr usa `use SoftDeletes`, lo que hace
 *  que Eloquent añada `AND deleted_at IS NULL` a cada query —
 *  columna que no existe → PostgreSQL lanza:
 *    "ERROR: no existe la columna pagos_qr.deleted_at"
 *
 *  Solución: ALTER TABLE sin tocar los datos existentes.
 *
 *  Pasos:
 *  1. Copiar este archivo a database/migrations/
 *     Nombre sugerido: 2026_05_XX_000001_add_softdeletes_to_pagos_qr.php
 *  2. Ejecutar: php artisan migrate
 *
 *  NO usar migrate:fresh ni migrate:rollback — eso borraría datos.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pagos_qr', function (Blueprint $table) {
            // softDeletes() añade la columna deleted_at TIMESTAMP nullable
            // Postgres lo interpreta como: ALTER TABLE pagos_qr ADD COLUMN deleted_at TIMESTAMPTZ NULL
            // Los registros existentes quedarán con deleted_at = NULL (activos) — sin pérdida de datos.
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('pagos_qr', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};

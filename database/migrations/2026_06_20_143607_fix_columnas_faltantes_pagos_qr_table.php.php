<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migración incremental — fix_columnas_faltantes_pagos_qr_table
 *
 * REGLA INVIOLABLE #1 respetada: jamás migrate:fresh ni dropIfExists.
 * Se usa Schema::table para modificar la tabla existente.
 *
 * CONTEXTO (junio 2026):
 * Existía una migración de reemplazo ya escrita en el proyecto
 * (2026_05_13_053022_create_pagos_qr_table.php) que agregaba
 * familia_id, organizacion_id y renombraba codigo_hash_qr a
 * comprobante_path — pero usaba Schema::dropIfExists seguido de
 * Schema::create, y NUNCA llegó a ejecutarse contra la base de
 * datos real. El modelo PagoQr.php y el controlador
 * PagoQrController.php ya asumían que esas columnas existían,
 * causando el error:
 *   SQLSTATE[42703]: Undefined column "comprobante_path"
 *
 * Esta migración aplica los mismos cambios de forma incremental
 * y segura, sin destruir la tabla:
 *   1. Renombra 'codigo_hash_qr' → 'comprobante_path' (incrementando
 *      el tamaño de 500 si era más corto, para rutas largas).
 *   2. Agrega 'familia_id' (FK nullable → familias, set null).
 *   3. Agrega 'organizacion_id' (FK nullable → organizaciones, set null).
 *
 * Confirmado por el desarrollador: la tabla está vacía (solo datos
 * de prueba descartables), por lo que renombrar la columna no
 * implica pérdida de información real.
 *
 * Orden de Blueprint respetado: columnas → índices al final.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pagos_qr', function (Blueprint $table) {
            // 1. Renombrar codigo_hash_qr → comprobante_path
            $table->renameColumn('codigo_hash_qr', 'comprobante_path');
        });

        // El cambio de tamaño de columna (a 500 chars) y el ajuste de
        // nullable se hacen en una segunda operación porque PostgreSQL
        // no permite renombrar y modificar tipo en el mismo Blueprint
        // de forma confiable vía Doctrine DBAL.
        Schema::table('pagos_qr', function (Blueprint $table) {
            $table->string('comprobante_path', 500)->nullable()->change();

            // 2. Agregar familia_id — agrupa pagos por núcleo familiar
            $table->foreignId('familia_id')
                ->nullable()
                ->after('habitante_id')
                ->constrained('familias')
                ->nullOnDelete();

            // 3. Agregar organizacion_id — vincula el pago a un servicio
            $table->foreignId('organizacion_id')
                ->nullable()
                ->after('familia_id')
                ->constrained('organizaciones')
                ->nullOnDelete();

            // Índices al final, según convención del proyecto
            $table->index('familia_id', 'idx_pagos_familia');
        });
    }

    public function down(): void
    {
        Schema::table('pagos_qr', function (Blueprint $table) {
            $table->dropConstrainedForeignId('organizacion_id');
            $table->dropConstrainedForeignId('familia_id');
        });

        Schema::table('pagos_qr', function (Blueprint $table) {
            $table->renameColumn('comprobante_path', 'codigo_hash_qr');
        });
    }
};

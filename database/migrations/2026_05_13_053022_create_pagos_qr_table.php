<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  MIGRACIÓN DE REEMPLAZO — pagos_qr (tabla vacía confirmada)
 * ───────────────────────────────────────────────────────────────
 *  Cambios respecto a la versión anterior:
 *
 *  + familia_id        FK nullable → familias
 *                      Agrupa los pagos por núcleo familiar.
 *
 *  + organizacion_id   FK nullable → organizaciones
 *                      Vincula el pago a un servicio (Gas, Agua…).
 *
 *  ~ comprobante_path   → nombre corregido (era codigo_hash_qr en la migración anterior)
 *                      Ruta del archivo en storage/app/comprobantes/
 *                      Nombre más claro para su propósito real.
 *
 *  = habitante_id, verificado_por, referencia_bancaria, monto,
 *    concepto_pago, estado, motivo_rechazo, fecha_pago,
 *    fecha_verificacion  →  sin cambios.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('pagos_qr');

        Schema::create('pagos_qr', function (Blueprint $table) {
            $table->id();

            // ── Quién paga ────────────────────────────────────
            $table->foreignId('habitante_id')
                ->constrained('habitantes')
                ->onDelete('restrict');         // No borrar habitante con pagos

            $table->foreignId('familia_id')     // Núcleo familiar del habitante
                ->nullable()
                ->constrained('familias')
                ->onDelete('set null');

            // ── Qué servicio se paga ──────────────────────────
            $table->foreignId('organizacion_id') // Ej. CORPOELEC, Hidrocapital
                ->nullable()
                ->constrained('organizaciones')
                ->onDelete('set null');

            // ── Quién verificó ────────────────────────────────
            $table->foreignId('verificado_por')
                ->nullable()
                ->constrained('users')
                ->onDelete('set null');

            // ── Datos del pago ────────────────────────────────
            $table->string('referencia_bancaria', 100)->unique();
            $table->decimal('monto', 12, 2);
            $table->string('concepto_pago', 200);

            // Ruta relativa en storage: 'comprobantes/2026/05/abc.jpg'
            $table->string('comprobante_path', 500)->nullable();

            // ── Máquina de estados ────────────────────────────
            $table->enum('estado', ['pendiente', 'verificado', 'rechazado'])
                ->default('pendiente');

            $table->string('motivo_rechazo', 255)->nullable();

            $table->timestamp('fecha_pago');
            $table->timestamp('fecha_verificacion')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // Índices para las queries más frecuentes
            $table->index(['estado', 'fecha_pago'],     'idx_pagos_estado_fecha');
            $table->index(['habitante_id', 'estado'],   'idx_pagos_habitante_estado');
            $table->index(['familia_id'],                'idx_pagos_familia');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pagos_qr');
    }
};

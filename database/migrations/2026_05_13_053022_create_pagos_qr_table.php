<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: pagos_qr — esquema final
 * ───────────────────────────────────────────────────────────────
 *  Esta migración reemplaza a las que antes parchaban la tabla:
 *  add_soft_deletes_to_pagos_qr, add_user_id_to_pagos_qr_table,
 *  fix_columnas_faltantes_pagos_qr_table,
 *  make_habitante_id_nullable_pagos_qr_table y
 *  add_cuenta_pago_id_to_pagos_qr_table.
 *
 *  Dos flujos conviven en la misma tabla:
 *    - admin/operador: habitante_id poblado, user_id null
 *    - Portal Ciudadano (rol usuario): user_id poblado,
 *      habitante_id null
 *  Por eso `habitante_id` es nullable (con restrict: no se borra
 *  un habitante que tenga pagos vinculados).
 *
 *  DEPENDENCIAS: habitantes, familias, organizaciones, users y
 *  cuentas_pago deben existir antes (por eso cuentas_pago tiene un
 *  timestamp anterior a esta migración).
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pagos_qr', function (Blueprint $table) {
            $table->id();

            // ── Quién paga ────────────────────────────────────
            $table->foreignId('habitante_id')
                ->nullable()
                ->constrained('habitantes')
                ->onDelete('restrict');         // No borrar habitante con pagos

            $table->foreignId('user_id')        // Flujo Portal Ciudadano
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('familia_id')     // Núcleo familiar
                ->nullable()
                ->constrained('familias')
                ->nullOnDelete();

            // ── Qué servicio se paga ──────────────────────────
            $table->foreignId('organizacion_id')
                ->nullable()
                ->constrained('organizaciones')
                ->nullOnDelete();

            $table->foreignId('cuenta_pago_id') // Cuenta elegida al pagar
                ->nullable()
                ->constrained('cuentas_pago')
                ->nullOnDelete();

            // ── Quién verificó ────────────────────────────────
            $table->foreignId('verificado_por')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

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

            $table->softDeletes();
            $table->timestamps();

            // ── Índices al final ──────────────────────────────
            $table->index(['estado', 'fecha_pago'], 'idx_estado_fecha');
            $table->index('familia_id',             'idx_pagos_familia');
            $table->index('user_id');
            $table->index('cuenta_pago_id',         'idx_pagos_cuenta_pago');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pagos_qr');
    }
};

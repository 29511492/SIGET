<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: pagos_qr — esquema final
 * ───────────────────────────────────────────────────────────────
 *  Dos flujos conviven en la misma tabla:
 *    - admin/operador: habitante_id poblado, user_id null
 *    - Portal Ciudadano (rol usuario): user_id poblado,
 *      habitante_id null
 *
 *  CAMBIO (sept-2026, corrección 2 del profesor: proceso de pago) —
 *  Se agrega `metodo_pago` (con qué método se realizó ESTE pago,
 *  copiado del método de la cuenta al momento de pagar — así el
 *  histórico no cambia si luego el admin edita la cuenta) y
 *  `banco_origen` (desde qué banco pagó el ciudadano, para que el
 *  operador concilie el comprobante contra el extracto). Todos los
 *  pagos previos quedan como 'pago_movil' (default), que era el
 *  único método que existía hasta ahora.
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

            // Método usado en ESTE pago (copiado de la cuenta al pagar).
            $table->string('metodo_pago', 20)->default('pago_movil');

            // Banco desde el que el ciudadano pagó (ayuda a conciliar).
            $table->string('banco_origen', 100)->nullable();

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

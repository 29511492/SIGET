<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migración incremental — add_cuenta_pago_id_to_pagos_qr_table
 *
 * Vincula cada pago a la cuenta de pago (servicio) que el usuario
 * eligió al momento de pagar. Nullable porque los pagos ya
 * existentes (creados antes de esta migración) no tienen ese dato,
 * y el flujo de admin/operador para habitantes puede seguir sin
 * usarlo si no aplica.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pagos_qr', function (Blueprint $table) {
            $table->foreignId('cuenta_pago_id')
                ->nullable()
                ->after('organizacion_id')
                ->constrained('cuentas_pago')
                ->nullOnDelete();

            $table->index('cuenta_pago_id', 'idx_pagos_cuenta_pago');
        });
    }

    public function down(): void
    {
        Schema::table('pagos_qr', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cuenta_pago_id');
        });
    }
};

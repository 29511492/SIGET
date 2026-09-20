<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migración — create_cuentas_pago_table
 *
 * Cuentas bancarias de destino para los pagos QR. El admin/operador
 * gestiona MÚLTIPLES cuentas (ej. "Gas", "Cuota mensual", "Aseo
 * urbano"); el ciudadano elige a cuál corresponde su pago. Reemplaza
 * los datos bancarios que estaban hardcodeados en PagoQrWidget.jsx.
 *
 * ORDEN: esta migración debe correr ANTES que `create_pagos_qr_table`
 * (que tiene FK a `cuentas_pago`), por eso su timestamp es anterior.
 *
 * Orden de Blueprint: columnas → softDeletes → timestamps → índices.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cuentas_pago', function (Blueprint $table) {
            $table->id();

            $table->string('nombre_servicio', 100);   // Ej: "Gas", "Cuota mensual"
            $table->string('banco', 100);              // Ej: "Banco de Venezuela (0102)"
            $table->string('telefono', 20);             // Ej: "0412-1234567"
            $table->string('cedula_rif', 20);            // Ej: "V-12345678"
            $table->string('titular', 150);              // Ej: "Consejo Comunal..."
            $table->text('descripcion')->nullable();     // Nota opcional para el ciudadano
            $table->boolean('activa')->default(true);    // Toggle activar/desactivar sin borrar

            $table->softDeletes();
            $table->timestamps();

            $table->index('activa', 'idx_cuentas_pago_activa');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cuentas_pago');
    }
};

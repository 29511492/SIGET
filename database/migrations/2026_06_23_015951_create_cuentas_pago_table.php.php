<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migración — create_cuentas_pago_table
 *
 * CONTEXTO (junio 2026):
 * Hasta ahora los datos bancarios que el ciudadano ve al pagar
 * (banco, teléfono, cédula/RIF, titular) estaban hardcodeados como
 * una constante fija en PagoQrWidget.jsx. El admin no tenía forma
 * de editarlos desde el sistema, y solo existía UNA cuenta posible.
 *
 * Esta tabla permite que el admin/operador gestione MÚLTIPLES
 * cuentas de pago (ej. "Gas", "Cuota mensual", "Aseo urbano"), cada
 * una con sus propios datos bancarios. El usuario, al ir a pagar,
 * elige a cuál corresponde su pago — reemplazando la dependencia
 * del texto libre en 'concepto_pago' para identificar el servicio.
 *
 * Orden de Blueprint respetado: columnas → softDeletes → timestamps
 * → índices al final.
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

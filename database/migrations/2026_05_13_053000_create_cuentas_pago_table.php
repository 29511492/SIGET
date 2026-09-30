<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migración — create_cuentas_pago_table
 *
 * Cuentas de destino para los pagos QR. El admin/operador gestiona
 * MÚLTIPLES cuentas (ej. "Gas", "Cuota mensual", "Aseo urbano"); el
 * ciudadano elige a cuál corresponde su pago.
 *
 * CAMBIO (sept-2026, corrección 2 del profesor: proceso de pago) —
 * Se agrega `metodo` y `numero_cuenta`. Antes solo existía pago móvil
 * (implícito: el QR y el formulario decían "Pago Móvil" a secas).
 * Ahora una cuenta declara explícitamente su método:
 *   - pago_movil   → requiere telefono
 *   - transferencia→ requiere numero_cuenta
 * Para aceptar ambos métodos en un mismo servicio, el admin crea dos
 * cuentas con el mismo nombre_servicio y distinto metodo — no hace
 * falta una tabla de métodos aparte, y agregar un tercer método en el
 * futuro (ver 4.4) no vuelve a tocar el esquema: basta con sumarlo a
 * la constante CuentaPago::METODOS y validar el campo que use.
 *
 * `telefono` pasa a NULLABLE (ya no aplica a transferencia).
 *
 * Corrección del profesor (sept-2026): una sola migración `create`
 * por tabla, con el esquema final — sin migraciones de parche.
 * Esta migración reemplaza directamente a la versión anterior (sin
 * metodo/numero_cuenta); ver nota de alineación de BD real al final
 * de este archivo, en el mensaje de entrega.
 *
 * ORDEN: debe correr ANTES que `create_pagos_qr_table` (FK).
 * Orden de Blueprint: columnas → softDeletes → timestamps → índices.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cuentas_pago', function (Blueprint $table) {
            $table->id();

            $table->string('nombre_servicio', 100);   // Ej: "Gas", "Cuota mensual"

            // Método de pago que acepta esta cuenta.
            $table->string('metodo', 20)->default('pago_movil');

            $table->string('banco', 100);              // Ej: "Banco de Venezuela (0102)"
            $table->string('telefono', 20)->nullable();      // Pago móvil
            $table->string('numero_cuenta', 20)->nullable(); // Transferencia
            $table->string('cedula_rif', 20);            // Ej: "V-12345678"
            $table->string('titular', 150);              // Ej: "Consejo Comunal..."
            $table->text('descripcion')->nullable();     // Nota opcional para el ciudadano
            $table->boolean('activa')->default(true);    // Toggle activar/desactivar sin borrar

            $table->softDeletes();
            $table->timestamps();

            $table->index('activa', 'idx_cuentas_pago_activa');
            $table->index('metodo', 'idx_cuentas_pago_metodo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cuentas_pago');
    }
};

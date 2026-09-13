<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migración incremental — make_habitante_id_nullable_pagos_qr_table
 *
 * REGLA INVIOLABLE #1 respetada: jamás migrate:fresh.
 * Se usa Schema::table para modificar la columna existente.
 *
 * CONTEXTO (junio 2026):
 * La migración original de pagos_qr definió 'habitante_id' como
 * NOT NULL (->constrained('habitantes') sin ->nullable()), porque
 * en el diseño original todo pago se vinculaba obligatoriamente a
 * un habitante del censo.
 *
 * Con la introducción del Portal Ciudadano (rol "usuario"), un pago
 * puede registrarse directamente vía 'user_id' SIN un habitante_id
 * vinculado — el rol "usuario" no necesariamente tiene ese vínculo
 * poblado en la tabla users. El INSERT fallaba con:
 *   SQLSTATE[23502]: Not null violation: habitante_id
 *
 * Esta migración hace 'habitante_id' nullable, preservando su FK
 * y el 'restrict' on delete para los pagos que SÍ tienen habitante
 * vinculado (flujo admin/operador, sin cambios de comportamiento
 * para ellos). Ahora un pago puede tener:
 *   - habitante_id poblado, user_id null  → flujo admin/operador
 *   - habitante_id null, user_id poblado  → flujo Portal Ciudadano
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pagos_qr', function (Blueprint $table) {
            $table->foreignId('habitante_id')
                ->nullable()
                ->change();
        });
    }

    public function down(): void
    {
        Schema::table('pagos_qr', function (Blueprint $table) {
            $table->foreignId('habitante_id')
                ->nullable(false)
                ->change();
        });
    }
};

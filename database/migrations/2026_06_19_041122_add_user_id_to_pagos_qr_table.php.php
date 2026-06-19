<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migración incremental — add_user_id_to_pagos_qr_table
 *
 * REGLA INVIOLABLE #1 respetada: jamás migrate:fresh.
 * Se usa Schema::table para modificar la tabla existente sin
 * destruir datos.
 *
 * CONTEXTO (junio 2026):
 * El rol "usuario" no necesariamente tiene un habitante_id vinculado
 * en la tabla users (ese vínculo puede no estar poblado todavía).
 * Para permitir que cualquier usuario autenticado registre su propio
 * pago QR sin depender de ese vínculo, se agrega 'user_id' nullable
 * con FK a 'users', set null en cascada de borrado.
 *
 * habitante_id sigue existiendo y sigue siendo usado por el flujo
 * actual de admin/operador (registro de pagos por habitante). Ambos
 * campos son nullable — un pago puede tener habitante_id O user_id,
 * o ambos si en el futuro se vincula el usuario a su habitante.
 *
 * Orden de Blueprint respetado: columna nueva → índice al final.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pagos_qr', function (Blueprint $table) {
            $table->foreignId('user_id')
                ->nullable()
                ->after('habitante_id')
                ->constrained('users')
                ->nullOnDelete();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('pagos_qr', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });
    }
};

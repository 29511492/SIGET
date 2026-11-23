<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: encuestas
 * ───────────────────────────────────────────────────────────────
 *  Campaña de censo territorial (entrega de gas, bolsas CLAP, agua,
 *  condición de vivienda, pagos de un servicio, etc.).
 *  `tipo` es string validado en la app (constante Encuesta::TIPOS),
 *  no enum de PostgreSQL: agregar un tipo no vuelve a tocar el esquema.
 *
 *  `cuenta_pago_id` solo se usa en las encuestas de tipo pago_servicio:
 *  indica el servicio cuyos pagos se controlan (se cuentan los pagos de
 *  todas las cuentas con el mismo nombre de servicio). Es nullable y se
 *  anula si la cuenta se elimina físicamente (nullOnDelete).
 *
 *  Orden Blueprint (regla 14): columnas → softDeletes → timestamps
 *  → índices.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('encuestas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 150);
            $table->string('tipo', 30); // bombona_gas | bolsa_clap | combo_alimenticio | agua | condicion_vivienda | pago_servicio | otro
            $table->foreignId('cuenta_pago_id')
                ->nullable()
                ->constrained('cuentas_pago')
                ->nullOnDelete();
            $table->text('descripcion')->nullable();
            $table->date('fecha_inicio')->nullable();
            $table->date('fecha_cierre')->nullable();
            $table->boolean('activa')->default(true);

            $table->softDeletes();
            $table->timestamps();

            $table->index('tipo');
            $table->index('activa');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('encuestas');
    }
};

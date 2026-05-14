<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: auditorias
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA — Corrección de tipo de columna:
 *
 *  PROBLEMA ORIGINAL: `valor_anterior` y `valor_nuevo` eran TEXT.
 *  Almacenar JSON como texto plano impide consultas como:
 *    WHERE valor_nuevo->>'$.rol' = 'admin'
 *  MySQL no puede indexar ni consultar dentro de un TEXT.
 *
 *  SOLUCIÓN: Tipo JSON nativo de MySQL 5.7+/MariaDB 10.2+.
 *  Con JSON nativo, se pueden hacer queries como:
 *    SELECT * FROM auditorias WHERE valor_nuevo->'$.rol' = '"admin"'
 *  Esto es útil para auditar "¿cuándo le cambiaron el rol a este user?"
 *
 *  TAMBIÉN: Se agrega `user_agent` para capturar el navegador/dispositivo
 *  desde el cual se realizó la acción — dato forense valioso.
 *
 *  IMPORTANTE: Esta tabla NO tiene softDeletes ni updated_at por diseño.
 *  Los registros de auditoría son INMUTABLES. Nunca se editan ni eliminan.
 *  Patrón: Append-Only Log (registro de solo escritura).
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('auditorias', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->onDelete('set null');

            $table->string('accion', 100);        // 'login_exitoso', 'habitante_creado', etc.
            $table->string('tabla_afectada', 100);
            $table->unsignedBigInteger('registro_id');

            $table->ipAddress('direccion_ip')->nullable();
            $table->string('user_agent', 500)->nullable(); // añadido

            // JSON nativo: permite queries dentro del JSON
            $table->json('valor_anterior')->nullable();
            $table->json('valor_nuevo')->nullable();

            // Solo created_at: los logs son inmutables, no se actualizan
            $table->timestamp('created_at')->useCurrent();

            // Índices para consultas de auditoría frecuentes
            $table->index(['tabla_afectada', 'registro_id'], 'idx_tabla_registro');
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auditorias');
    }
};

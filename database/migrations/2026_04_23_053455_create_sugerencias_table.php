<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: sugerencias
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA:
 *  1. `onDelete('set null')` en lugar de cascade: si el usuario
 *     que envió la sugerencia es dado de baja, la sugerencia debe
 *     conservarse. Puede contener información valiosa para la
 *     gestión comunal independientemente de quién la envió.
 *
 *  2. Se agrega `revisada_por` (FK a users): ¿qué operador/admin
 *     marcó la sugerencia como revisada? En el original, solo
 *     había un booleano `revisada` y un timestamp, pero no se
 *     sabía QUIÉN la revisó. Esto cierra la cadena de trazabilidad.
 *
 *  3. Se agrega `respuesta`: permite al operador responder
 *     formalmente la sugerencia dentro del sistema, sin necesidad
 *     de comunicación externa. Mejora la experiencia del vocero
 *     que envió la sugerencia.
 *
 *  Patrón: Workflow de doble actor (quien envía / quien revisa).
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sugerencias', function (Blueprint $table) {
            $table->id();

            // Quien envió la sugerencia
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                  ->onDelete('set null'); // corregido: era cascade

            // Quien la revisó (admin u operador)
            $table->foreignId('revisada_por')
                ->nullable()
                ->constrained('users')
                ->onDelete('set null');

            $table->text('mensaje');
            $table->text('respuesta')->nullable();       // Respuesta formal del operador

            $table->boolean('revisada')->default(false);
            $table->timestamp('revisada_en')->nullable();

            $table->timestamps();

            // Filtro frecuente: listar sugerencias pendientes de revisión
            $table->index('revisada');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sugerencias');
    }
};

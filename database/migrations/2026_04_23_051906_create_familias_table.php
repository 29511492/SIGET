<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: familias
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA:
 *  1. Se agrega `softDeletes()`: una familia no debe eliminarse
 *     físicamente porque sus registros de beneficios, pagos y
 *     habitantes son datos censales históricos. Eliminarlos
 *     destruiría la trazabilidad del sistema.
 *
 *  2. Se agrega índice compuesto (sede_id, condicion_vivienda):
 *     El dashboard necesita frecuentemente "total de viviendas
 *     críticas por sede". Sin índice, esa query hace full-table-scan.
 *     Con el índice compuesto, MySQL lo resuelve en microsegundos.
 *     Patrón: Query Optimization por índices selectivos.
 *
 *  3. `nombre_jefe` renombrado a `nombre_responsable`: más neutro
 *     y apropiado para datos censales (puede no haber un jefe de
 *     familia tradicional).
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('familias', function (Blueprint $table) {
            $table->id();

            $table->foreignId('sede_id')
                ->nullable()
                ->constrained('sedes')
                ->onDelete('set null');

            $table->foreignId('calle_id')
                ->nullable()
                ->constrained('calles')
                ->onDelete('set null');

            // Identificación
            $table->string('codigo_vivienda', 20)->unique();
            $table->string('nombre_responsable', 100)->nullable(); // renombrado de nombre_jefe
            $table->string('punto_referencia', 255)->nullable();

            // Servicios básicos
            $table->unsignedTinyInteger('cantidad_bombonas')->default(1);
            $table->enum('capacidad_bombona', ['10kg', '18kg', '43kg'])->default('10kg');
            $table->boolean('posee_agua_potable')->default(true);

            $table->enum('condicion_vivienda', ['optima', 'regular', 'critica'])
                ->default('regular');

            $table->softDeletes();
            $table->timestamps();

            // Índice compuesto para el dashboard (viviendas críticas por sede)
            $table->index(['sede_id', 'condicion_vivienda'], 'idx_sede_condicion');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('familias');
    }
};

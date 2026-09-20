<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: familias
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA:
 *  1. `softDeletes()`: una familia no debe eliminarse físicamente
 *     porque sus beneficios, pagos y habitantes son datos censales
 *     históricos.
 *
 *  2. Índice compuesto (sede_id, condicion_vivienda): el dashboard
 *     consulta "viviendas críticas por sede"; sin índice haría un
 *     full-table-scan.
 *
 *  3. `nombre_responsable` (antes `nombre_jefe`): más neutro y
 *     apropiado para datos censales.
 *
 *  4. Servicios básicos (agua, luz, aseo) como boolean default true.
 *     `posee_luz` y `posee_aseo` antes se agregaban con la migración
 *     `add_servicios_faltantes`; se fusionaron aquí para la
 *     instalación limpia.
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
            $table->string('nombre_responsable', 100)->nullable();
            $table->string('punto_referencia', 255)->nullable();

            // Servicios básicos
            $table->unsignedTinyInteger('cantidad_bombonas')->default(1);
            $table->enum('capacidad_bombona', ['10kg', '18kg', '43kg'])->default('10kg');
            $table->boolean('posee_agua_potable')->default(true);
            $table->boolean('posee_luz')->default(true);
            $table->boolean('posee_aseo')->default(true);

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

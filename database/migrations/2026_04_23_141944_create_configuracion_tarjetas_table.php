<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * ═══════════════════════════════════════════════════════════════
 *  TABLA: configuracion_tarjetas
 * ───────────────────────────────────────────────────────────────
 *  DECISIÓN ARQUITECTÓNICA — Seed dentro de la migración:
 *
 *  El sistema original insertaba los datos por defecto directamente
 *  en el up() con DB::table()->insert(). Esta práctica es aceptable
 *  SOLO para datos de configuración que son parte estructural del
 *  sistema (no datos de prueba). Las tarjetas del dashboard son
 *  configuración base sin la cual la aplicación no funciona.
 *
 *  DISTINCIÓN IMPORTANTE para la tesis:
 *  - Seeders (database/seeders/): datos de prueba o datos iniciales
 *    opcionales. Se ejecutan con `php artisan db:seed`.
 *  - Datos en migraciones: configuración estructural obligatoria.
 *    Se ejecutan automáticamente con `php artisan migrate`.
 *  Las tarjetas del dashboard caen en la segunda categoría.
 *
 *  MEJORAS respecto al original:
 *  1. Se agrega `visible` (boolean): permite ocultar una tarjeta
 *     del dashboard sin eliminarla. Útil si una funcionalidad
 *     está deshabilitada temporalmente (ej: módulo de pagos en
 *     mantenimiento → ocultar tarjeta de total_pagos).
 *
 *  2. Se agrega `orden` (integer): define el orden visual de las
 *     tarjetas en el dashboard. Sin este campo, el frontend debe
 *     hardcodear el orden en el componente React, acoplando la
 *     presentación al código. Con este campo, el admin puede
 *     reordenar tarjetas desde la interfaz.
 *     Patrón: Configuration over Code (separar config de lógica).
 *
 *  3. Se agrega `icono` (string): nombre del ícono a mostrar
 *     en cada tarjeta (ej: 'users', 'home', 'heart').
 *     El frontend (React + lucide-react) renderiza el ícono por
 *     nombre. Cambiar el ícono es config, no un deploy de código.
 * ═══════════════════════════════════════════════════════════════
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('configuracion_tarjetas', function (Blueprint $table) {
            $table->id();

            // Identificador único de la tarjeta — nunca cambia
            $table->string('clave', 100)->unique();

            // Texto personalizable por el admin desde la interfaz
            $table->string('titulo_personalizado', 255)->nullable();
            $table->string('subtitulo_personalizado', 255)->nullable();

            // Presentación visual
            $table->string('icono', 50)->nullable();    // Nombre del ícono (lucide-react)
            $table->unsignedTinyInteger('orden')->default(0); // Orden en el dashboard
            $table->boolean('visible')->default(true);  // Mostrar/ocultar sin eliminar

            $table->timestamps();
        });

        // Datos estructurales obligatorios del sistema
        // orden: define la posición visual de izquierda a derecha, fila por fila
        DB::table('configuracion_tarjetas')->insert([
            [
                'clave'                   => 'total_familias',
                'titulo_personalizado'    => null,
                'subtitulo_personalizado' => null,
                'icono'                   => 'home',
                'orden'                   => 1,
                'visible'                 => true,
                'created_at'              => now(),
                'updated_at'              => now(),
            ],
            [
                'clave'                   => 'total_habitantes',
                'titulo_personalizado'    => null,
                'subtitulo_personalizado' => null,
                'icono'                   => 'users',
                'orden'                   => 2,
                'visible'                 => true,
                'created_at'              => now(),
                'updated_at'              => now(),
            ],
            [
                'clave'                   => 'viviendas_criticas',
                'titulo_personalizado'    => null,
                'subtitulo_personalizado' => null,
                'icono'                   => 'alert-triangle',
                'orden'                   => 3,
                'visible'                 => true,
                'created_at'              => now(),
                'updated_at'              => now(),
            ],
            [
                'clave'                   => 'con_discapacidad',
                'titulo_personalizado'    => null,
                'subtitulo_personalizado' => null,
                'icono'                   => 'heart',
                'orden'                   => 4,
                'visible'                 => true,
                'created_at'              => now(),
                'updated_at'              => now(),
            ],
            [
                'clave'                   => 'total_voceros',
                'titulo_personalizado'    => null,
                'subtitulo_personalizado' => null,
                'icono'                   => 'user-check',
                'orden'                   => 5,
                'visible'                 => true,
                'created_at'              => now(),
                'updated_at'              => now(),
            ],
            [
                'clave'                   => 'total_proyectos',
                'titulo_personalizado'    => null,
                'subtitulo_personalizado' => null,
                'icono'                   => 'folder',
                'orden'                   => 6,
                'visible'                 => true,
                'created_at'              => now(),
                'updated_at'              => now(),
            ],
            [
                'clave'                   => 'total_beneficios',
                'titulo_personalizado'    => null,
                'subtitulo_personalizado' => null,
                'icono'                   => 'gift',
                'orden'                   => 7,
                'visible'                 => true,
                'created_at'              => now(),
                'updated_at'              => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('configuracion_tarjetas');
    }
};

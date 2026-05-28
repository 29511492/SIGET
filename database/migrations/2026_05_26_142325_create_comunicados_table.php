<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comunicados', function (Blueprint $table) {
            $table->id();

            // Auditoría: quién redactó el comunicado
            $table->foreignId('user_id')
                  ->constrained('users')
                  ->restrictOnDelete();

            // Campos del comunicado
            $table->string('destinatario', 200);          // "Alcaldía del Municipio X" / "Empresa Y"
            $table->string('cargo_destinatario', 150)->nullable(); // "Alcalde" / "Gerente General"
            $table->string('asunto', 300);
            $table->text('cuerpo');                        // Cuerpo redactado en el editor

            // Estado del documento
            $table->enum('estado', ['borrador', 'enviado', 'archivado'])->default('borrador');

            // Número correlativo para el membrete (auto-calculado en el servicio)
            $table->string('numero_oficio', 30)->nullable(); // Ej: "CC-2024-0001"

            // ── Columnas de control temporal (DEBEN ir antes de los índices) ──
            $table->softDeletes(); // deleted_at — columna física primero
            $table->timestamps();  // created_at / updated_at

            // ── Índices (solo después de que todas las columnas existen) ──────
            $table->index(['user_id', 'created_at']);
            $table->index('estado');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comunicados');
    }
};

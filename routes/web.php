<?php

use Illuminate\Support\Facades\Route;

// 1. Ruta principal que carga la vista de Blade donde vive React
Route::get('/', function () {
    return view('welcome');
});

// 2. RUTA COMODÍN (Cópiala aquí al final)
// Esta ruta le dice a Laravel: "Cualquier URL que el usuario escriba,
// entrégale la vista 'welcome' y deja que React decida qué mostrar".
Route::get('/{any}', function () {
    return view('welcome');
})->where('any', '.*');

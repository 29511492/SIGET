<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     *
     * La página de inicio carga los assets con @vite. Sin `npm run dev`
     * encendido ni `npm run build` ejecutado, public/build/manifest.json
     * no existe y la petición daba 500. withoutVite() hace que la prueba
     * no dependa de los assets compilados.
     */
    public function test_the_application_returns_a_successful_response(): void
    {
        $this->withoutVite();

        $response = $this->get('/');

        $response->assertStatus(200);
    }
}

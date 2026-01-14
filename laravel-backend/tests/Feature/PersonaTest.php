<?php

namespace Tests\Feature;

use App\Models\Persona;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PersonaTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function can_list_all_personas()
    {
        Persona::factory()->count(3)->create();

        $response = $this->getJson('/api/personas');

        $response->assertStatus(200)
            ->assertJsonCount(3);
    }

    /** @test */
    public function can_create_persona_with_valid_data()
    {
        $personaData = [
            'name' => 'Test Assistant',
            'description' => 'A helpful assistant for testing',
            'system_preview' => 'Helpful and friendly',
            'provider' => 'openai',
            'system_prompt' => 'You are a helpful assistant that provides detailed answers.',
            'temperature' => 0.7,
            'model' => 'gpt-4',
            'guidelines' => ['Be helpful', 'Be concise'],
            'notes' => 'Test notes',
        ];

        $response = $this->postJson('/api/personas', $personaData);

        $response->assertStatus(201)
            ->assertJson([
                'name' => 'Test Assistant',
                'provider' => 'openai',
                'temperature' => 0.7,
            ]);

        $this->assertDatabaseHas('personas', [
            'name' => 'Test Assistant',
            'provider' => 'openai',
        ]);
    }

    /** @test */
    public function persona_requires_name()
    {
        $response = $this->postJson('/api/personas', [
            'provider' => 'openai',
            'system_prompt' => 'Test prompt',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    /** @test */
    public function persona_requires_unique_name()
    {
        Persona::factory()->create(['name' => 'Existing Persona']);

        $response = $this->postJson('/api/personas', [
            'name' => 'Existing Persona',
            'provider' => 'openai',
            'system_prompt' => 'Test prompt',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    /** @test */
    public function persona_requires_provider()
    {
        $response = $this->postJson('/api/personas', [
            'name' => 'Test Persona',
            'system_prompt' => 'Test prompt',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['provider']);
    }

    /** @test */
    public function persona_requires_system_prompt()
    {
        $response = $this->postJson('/api/personas', [
            'name' => 'Test Persona',
            'provider' => 'openai',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['system_prompt']);
    }

    /** @test */
    public function persona_validates_temperature_range()
    {
        $response = $this->postJson('/api/personas', [
            'name' => 'Test Persona',
            'provider' => 'openai',
            'system_prompt' => 'Test prompt',
            'temperature' => 1.5, // Exceeds max of 1
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['temperature']);

        $response = $this->postJson('/api/personas', [
            'name' => 'Test Persona',
            'provider' => 'openai',
            'system_prompt' => 'Test prompt',
            'temperature' => -0.1, // Below min of 0
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['temperature']);
    }

    /** @test */
    public function persona_can_be_created_without_optional_fields()
    {
        $response = $this->postJson('/api/personas', [
            'name' => 'Minimal Persona',
            'provider' => 'openai',
            'system_prompt' => 'Test prompt',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('personas', [
            'name' => 'Minimal Persona',
        ]);
    }

    /** @test */
    public function can_show_specific_persona()
    {
        $persona = Persona::factory()->create([
            'name' => 'Specific Persona',
            'provider' => 'anthropic',
        ]);

        $response = $this->getJson("/api/personas/{$persona->id}");

        $response->assertStatus(200)
            ->assertJson([
                'id' => $persona->id,
                'name' => 'Specific Persona',
                'provider' => 'anthropic',
            ]);
    }

    /** @test */
    public function show_returns_404_for_non_existent_persona()
    {
        $response = $this->getJson('/api/personas/9999');

        $response->assertStatus(404);
    }

    /** @test */
    public function persona_guidelines_can_be_array()
    {
        $response = $this->postJson('/api/personas', [
            'name' => 'Guidelines Persona',
            'provider' => 'openai',
            'system_prompt' => 'Test prompt',
            'guidelines' => [
                'First guideline',
                'Second guideline',
                'Third guideline',
            ],
        ]);

        $response->assertStatus(201);

        $persona = Persona::first();
        $this->assertIsArray($persona->guidelines);
        $this->assertCount(3, $persona->guidelines);
    }

    /** @test */
    public function empty_list_returns_empty_array()
    {
        $response = $this->getJson('/api/personas');

        $response->assertStatus(200)
            ->assertJson([]);
    }

    /** @test */
    public function persona_stores_all_fields_correctly()
    {
        $personaData = [
            'name' => 'Complete Persona',
            'description' => 'Full description',
            'system_preview' => 'Preview text',
            'provider' => 'google',
            'system_prompt' => 'Complete system prompt',
            'temperature' => 0.9,
            'model' => 'gemini-pro',
            'guidelines' => ['Guide 1', 'Guide 2'],
            'notes' => 'Important notes',
        ];

        $this->postJson('/api/personas', $personaData);

        $persona = Persona::first();

        $this->assertEquals('Complete Persona', $persona->name);
        $this->assertEquals('Full description', $persona->description);
        $this->assertEquals('Preview text', $persona->system_preview);
        $this->assertEquals('google', $persona->provider);
        $this->assertEquals('Complete system prompt', $persona->system_prompt);
        $this->assertEquals(0.9, $persona->temperature);
        $this->assertEquals('gemini-pro', $persona->model);
        $this->assertEquals(['Guide 1', 'Guide 2'], $persona->guidelines);
        $this->assertEquals('Important notes', $persona->notes);
    }
}

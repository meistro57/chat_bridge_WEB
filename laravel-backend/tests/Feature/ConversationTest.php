<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\Persona;
use App\Models\User;
use App\Services\ChatBridgeService;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class ConversationTest extends TestCase
{
    use RefreshDatabase;

    protected function mockChatBridgeService($responseBody)
    {
        $mock = new MockHandler([
            new Response(200, [], json_encode($responseBody))
        ]);

        $handlerStack = HandlerStack::create($mock);
        $client = new Client(['handler' => $handlerStack]);

        $service = $this->getMockBuilder(ChatBridgeService::class)
            ->disableOriginalConstructor()
            ->getMock();

        $reflection = new \ReflectionClass($service);
        $property = $reflection->getProperty('httpClient');
        $property->setAccessible(true);
        $property->setValue($service, $client);

        return $service;
    }

    /** @test */
    public function can_start_conversation_with_valid_data()
    {
        Event::fake();

        $persona1 = Persona::factory()->create(['name' => 'Assistant A']);
        $persona2 = Persona::factory()->create(['name' => 'Assistant B']);

        $response = $this->postJson('/api/conversations', [
            'provider_a' => 'openai',
            'provider_b' => 'anthropic',
            'persona_a' => 'Assistant A',
            'persona_b' => 'Assistant B',
            'starter_message' => 'Hello, let\'s discuss AI',
            'max_rounds' => 5,
            'temperature_a' => 0.7,
            'temperature_b' => 0.8,
            'model_a' => 'gpt-4',
            'model_b' => 'claude-3-opus',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'conversation_id',
                'status',
                'messages',
            ]);

        $this->assertDatabaseHas('conversations', [
            'provider_a' => 'openai',
            'provider_b' => 'anthropic',
            'starter_message' => 'Hello, let\'s discuss AI',
        ]);
    }

    /** @test */
    public function conversation_requires_providers()
    {
        $response = $this->postJson('/api/conversations', [
            'starter_message' => 'Hello',
        ]);

        $response->assertStatus(400)
            ->assertJsonValidationErrors(['provider_a', 'provider_b']);
    }

    /** @test */
    public function conversation_requires_starter_message()
    {
        $response = $this->postJson('/api/conversations', [
            'provider_a' => 'openai',
            'provider_b' => 'anthropic',
        ]);

        $response->assertStatus(400)
            ->assertJsonValidationErrors(['starter_message']);
    }

    /** @test */
    public function conversation_creates_personas_if_not_exist()
    {
        $this->postJson('/api/conversations', [
            'provider_a' => 'openai',
            'provider_b' => 'anthropic',
            'persona_a' => 'New Persona A',
            'persona_b' => 'New Persona B',
            'starter_message' => 'Hello',
        ]);

        $this->assertDatabaseHas('personas', ['name' => 'New Persona A']);
        $this->assertDatabaseHas('personas', ['name' => 'New Persona B']);
    }

    /** @test */
    public function conversation_uses_existing_personas()
    {
        $persona1 = Persona::factory()->create(['name' => 'Existing Persona']);

        $this->postJson('/api/conversations', [
            'provider_a' => 'openai',
            'provider_b' => 'anthropic',
            'persona_a' => 'Existing Persona',
            'persona_b' => 'New Persona',
            'starter_message' => 'Hello',
        ]);

        $conversation = Conversation::first();
        $this->assertEquals($persona1->id, $conversation->persona_a_id);
    }

    /** @test */
    public function conversation_validates_max_rounds()
    {
        $response = $this->postJson('/api/conversations', [
            'provider_a' => 'openai',
            'provider_b' => 'anthropic',
            'starter_message' => 'Hello',
            'max_rounds' => 25, // Exceeds max of 20
        ]);

        $response->assertStatus(400)
            ->assertJsonValidationErrors(['max_rounds']);
    }

    /** @test */
    public function conversation_validates_temperature_range()
    {
        $response = $this->postJson('/api/conversations', [
            'provider_a' => 'openai',
            'provider_b' => 'anthropic',
            'starter_message' => 'Hello',
            'temperature_a' => 1.5, // Exceeds max of 1
        ]);

        $response->assertStatus(400)
            ->assertJsonValidationErrors(['temperature_a']);
    }

    /** @test */
    public function conversation_uses_default_values()
    {
        $this->postJson('/api/conversations', [
            'provider_a' => 'openai',
            'provider_b' => 'anthropic',
            'starter_message' => 'Hello',
        ]);

        $conversation = Conversation::first();
        $this->assertEquals(5, $conversation->max_rounds);
        $this->assertEquals(0.7, $conversation->temperature_a);
        $this->assertEquals(0.7, $conversation->temperature_b);
    }

    /** @test */
    public function can_check_provider_status()
    {
        $response = $this->postJson('/api/provider-status', [
            'providers' => ['openai', 'anthropic'],
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'provider_statuses' => [
                    '*' => ['provider', 'valid', 'models']
                ]
            ]);
    }

    /** @test */
    public function provider_status_returns_available_models()
    {
        $response = $this->postJson('/api/provider-status', [
            'providers' => ['openai'],
        ]);

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertArrayHasKey('provider_statuses', $data);
        $this->assertNotEmpty($data['provider_statuses'][0]['models']);
    }

    /** @test */
    public function can_continue_existing_conversation()
    {
        $conversation = Conversation::factory()->create();

        $response = $this->postJson('/api/conversations/continue', [
            'conversation_id' => $conversation->id,
            'user_message' => 'Tell me more',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'conversation_id',
                'messages',
            ]);
    }

    /** @test */
    public function continue_requires_conversation_id()
    {
        $response = $this->postJson('/api/conversations/continue', [
            'user_message' => 'Tell me more',
        ]);

        $response->assertStatus(400)
            ->assertJsonValidationErrors(['conversation_id']);
    }

    /** @test */
    public function continue_requires_valid_conversation_id()
    {
        $response = $this->postJson('/api/conversations/continue', [
            'conversation_id' => 9999, // Non-existent
            'user_message' => 'Tell me more',
        ]);

        $response->assertStatus(400)
            ->assertJsonValidationErrors(['conversation_id']);
    }

    /** @test */
    public function continue_requires_user_message()
    {
        $conversation = Conversation::factory()->create();

        $response = $this->postJson('/api/conversations/continue', [
            'conversation_id' => $conversation->id,
        ]);

        $response->assertStatus(400)
            ->assertJsonValidationErrors(['user_message']);
    }

    /** @test */
    public function conversation_can_accept_api_keys()
    {
        $response = $this->postJson('/api/conversations', [
            'provider_a' => 'openai',
            'provider_b' => 'anthropic',
            'starter_message' => 'Hello',
            'api_keys' => [
                'openai' => 'sk-test-key',
                'anthropic' => 'sk-ant-test-key',
            ],
        ]);

        $response->assertStatus(200);
    }

    /** @test */
    public function conversation_stores_relationship_with_personas()
    {
        $persona1 = Persona::factory()->create(['name' => 'Persona One']);
        $persona2 = Persona::factory()->create(['name' => 'Persona Two']);

        $this->postJson('/api/conversations', [
            'provider_a' => 'openai',
            'provider_b' => 'anthropic',
            'persona_a' => 'Persona One',
            'persona_b' => 'Persona Two',
            'starter_message' => 'Hello',
        ]);

        $conversation = Conversation::first();
        $this->assertNotNull($conversation->personaA);
        $this->assertNotNull($conversation->personaB);
        $this->assertEquals('Persona One', $conversation->personaA->name);
        $this->assertEquals('Persona Two', $conversation->personaB->name);
    }
}

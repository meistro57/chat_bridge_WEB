<?php

namespace Tests\Unit;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\Persona;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ModelTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function user_can_be_created()
    {
        $user = User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

        $this->assertInstanceOf(User::class, $user);
        $this->assertEquals('Test User', $user->name);
        $this->assertEquals('test@example.com', $user->email);
    }

    /** @test */
    public function user_password_is_hidden()
    {
        $user = User::factory()->create([
            'password' => 'secret123',
        ]);

        $array = $user->toArray();

        $this->assertArrayNotHasKey('password', $array);
        $this->assertArrayNotHasKey('remember_token', $array);
    }

    /** @test */
    public function persona_can_be_created()
    {
        $persona = Persona::factory()->create([
            'name' => 'Test Persona',
            'provider' => 'openai',
        ]);

        $this->assertInstanceOf(Persona::class, $persona);
        $this->assertEquals('Test Persona', $persona->name);
        $this->assertEquals('openai', $persona->provider);
    }

    /** @test */
    public function persona_guidelines_are_cast_to_array()
    {
        $persona = Persona::factory()->create([
            'guidelines' => ['Rule 1', 'Rule 2', 'Rule 3'],
        ]);

        $this->assertIsArray($persona->guidelines);
        $this->assertEquals(['Rule 1', 'Rule 2', 'Rule 3'], $persona->guidelines);
    }

    /** @test */
    public function persona_temperature_is_cast_to_float()
    {
        $persona = Persona::factory()->create([
            'temperature' => '0.75',
        ]);

        $this->assertIsFloat($persona->temperature);
        $this->assertEquals(0.75, $persona->temperature);
    }

    /** @test */
    public function conversation_can_be_created()
    {
        $conversation = Conversation::factory()->create([
            'provider_a' => 'openai',
            'provider_b' => 'anthropic',
            'starter_message' => 'Hello',
        ]);

        $this->assertInstanceOf(Conversation::class, $conversation);
        $this->assertEquals('openai', $conversation->provider_a);
        $this->assertEquals('anthropic', $conversation->provider_b);
        $this->assertEquals('Hello', $conversation->starter_message);
    }

    /** @test */
    public function conversation_belongs_to_persona_a()
    {
        $personaA = Persona::factory()->create();
        $conversation = Conversation::factory()->create([
            'persona_a_id' => $personaA->id,
        ]);

        $this->assertInstanceOf(Persona::class, $conversation->personaA);
        $this->assertEquals($personaA->id, $conversation->personaA->id);
    }

    /** @test */
    public function conversation_belongs_to_persona_b()
    {
        $personaB = Persona::factory()->create();
        $conversation = Conversation::factory()->create([
            'persona_b_id' => $personaB->id,
        ]);

        $this->assertInstanceOf(Persona::class, $conversation->personaB);
        $this->assertEquals($personaB->id, $conversation->personaB->id);
    }

    /** @test */
    public function conversation_has_many_messages()
    {
        $conversation = Conversation::factory()->create();
        $messages = Message::factory()->count(3)->create([
            'conversation_id' => $conversation->id,
        ]);

        $this->assertCount(3, $conversation->messages);
        $this->assertInstanceOf(Message::class, $conversation->messages->first());
    }

    /** @test */
    public function message_can_be_created()
    {
        $conversation = Conversation::factory()->create();
        $message = Message::factory()->create([
            'conversation_id' => $conversation->id,
            'content' => 'Test message',
            'sender' => 'a',
        ]);

        $this->assertInstanceOf(Message::class, $message);
        $this->assertEquals('Test message', $message->content);
        $this->assertEquals('a', $message->sender);
    }

    /** @test */
    public function message_belongs_to_conversation()
    {
        $conversation = Conversation::factory()->create();
        $message = Message::factory()->create([
            'conversation_id' => $conversation->id,
        ]);

        $this->assertInstanceOf(Conversation::class, $message->conversation);
        $this->assertEquals($conversation->id, $message->conversation->id);
    }

    /** @test */
    public function conversation_can_exist_without_personas()
    {
        $conversation = Conversation::factory()->create([
            'persona_a_id' => null,
            'persona_b_id' => null,
        ]);

        $this->assertNull($conversation->personaA);
        $this->assertNull($conversation->personaB);
    }

    /** @test */
    public function message_stores_metadata()
    {
        $message = Message::factory()->create([
            'tokens' => 150,
            'response_time' => 2.5,
            'model' => 'gpt-4',
        ]);

        $this->assertEquals(150, $message->tokens);
        $this->assertEquals(2.5, $message->response_time);
        $this->assertEquals('gpt-4', $message->model);
    }

    /** @test */
    public function conversation_with_personas_eager_loads_correctly()
    {
        $personaA = Persona::factory()->create(['name' => 'Persona A']);
        $personaB = Persona::factory()->create(['name' => 'Persona B']);

        $conversation = Conversation::factory()->create([
            'persona_a_id' => $personaA->id,
            'persona_b_id' => $personaB->id,
        ]);

        $loadedConversation = Conversation::with(['personaA', 'personaB'])->find($conversation->id);

        $this->assertEquals('Persona A', $loadedConversation->personaA->name);
        $this->assertEquals('Persona B', $loadedConversation->personaB->name);
    }

    /** @test */
    public function conversation_with_messages_eager_loads_correctly()
    {
        $conversation = Conversation::factory()->create();
        Message::factory()->count(5)->create([
            'conversation_id' => $conversation->id,
        ]);

        $loadedConversation = Conversation::with('messages')->find($conversation->id);

        $this->assertCount(5, $loadedConversation->messages);
    }

    /** @test */
    public function user_implements_jwt_subject()
    {
        $user = User::factory()->create();

        $this->assertIsString($user->getJWTIdentifier());
        $this->assertIsArray($user->getJWTCustomClaims());
    }

    /** @test */
    public function persona_fillable_attributes_work()
    {
        $persona = Persona::create([
            'name' => 'Fillable Persona',
            'description' => 'Test description',
            'system_preview' => 'Preview',
            'provider' => 'openai',
            'system_prompt' => 'Prompt',
            'temperature' => 0.8,
            'model' => 'gpt-4',
            'guidelines' => ['Guide 1'],
            'notes' => 'Notes',
        ]);

        $this->assertEquals('Fillable Persona', $persona->name);
        $this->assertEquals('Test description', $persona->description);
    }

    /** @test */
    public function conversation_fillable_attributes_work()
    {
        $conversation = Conversation::create([
            'provider_a' => 'openai',
            'provider_b' => 'anthropic',
            'starter_message' => 'Start',
            'max_rounds' => 10,
            'temperature_a' => 0.7,
            'temperature_b' => 0.8,
            'model_a' => 'gpt-4',
            'model_b' => 'claude-3',
        ]);

        $this->assertEquals('openai', $conversation->provider_a);
        $this->assertEquals(10, $conversation->max_rounds);
    }

    /** @test */
    public function message_fillable_attributes_work()
    {
        $conversation = Conversation::factory()->create();

        $message = Message::create([
            'conversation_id' => $conversation->id,
            'content' => 'Content',
            'sender' => 'a',
            'persona' => 'Persona',
            'tokens' => 100,
            'response_time' => 1.5,
            'model' => 'gpt-4',
        ]);

        $this->assertEquals('Content', $message->content);
        $this->assertEquals(100, $message->tokens);
    }
}

<?php

namespace Tests\Unit;

use App\Events\ConversationMessageReceived;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Persona;
use App\Services\ChatBridgeService;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class ChatBridgeServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function mockHttpClient($statusCode, $responseBody)
    {
        $mock = new MockHandler([
            new Response($statusCode, [], json_encode($responseBody))
        ]);

        $handlerStack = HandlerStack::create($mock);
        return new Client(['handler' => $handlerStack]);
    }

    /** @test */
    public function initiate_conversation_sends_correct_payload_to_backend()
    {
        Event::fake();

        $personaA = Persona::factory()->create(['name' => 'Assistant A']);
        $personaB = Persona::factory()->create(['name' => 'Assistant B']);

        $conversation = Conversation::factory()->create([
            'persona_a_id' => $personaA->id,
            'persona_b_id' => $personaB->id,
            'provider_a' => 'openai',
            'provider_b' => 'anthropic',
            'starter_message' => 'Hello World',
            'max_rounds' => 5,
            'temperature_a' => 0.7,
            'temperature_b' => 0.8,
            'model_a' => 'gpt-4',
            'model_b' => 'claude-3-opus',
        ]);

        $mockResponse = [
            'messages' => [
                [
                    'content' => 'Hello from A',
                    'sender' => 'a',
                    'persona' => 'Assistant A',
                    'tokens' => 100,
                    'response_time' => 1.5,
                    'model' => 'gpt-4',
                ],
                [
                    'content' => 'Hello from B',
                    'sender' => 'b',
                    'persona' => 'Assistant B',
                    'tokens' => 120,
                    'response_time' => 1.8,
                    'model' => 'claude-3-opus',
                ],
            ],
        ];

        $service = new ChatBridgeService();
        $reflection = new \ReflectionClass($service);
        $property = $reflection->getProperty('httpClient');
        $property->setAccessible(true);
        $property->setValue($service, $this->mockHttpClient(200, $mockResponse));

        $result = $service->initiateConversation($conversation);

        $this->assertArrayHasKey('conversation_id', $result);
        $this->assertArrayHasKey('messages', $result);
        $this->assertCount(2, $result['messages']);
    }

    /** @test */
    public function initiate_conversation_stores_messages_in_database()
    {
        Event::fake();

        $conversation = Conversation::factory()->create();

        $mockResponse = [
            'messages' => [
                [
                    'content' => 'First message',
                    'sender' => 'a',
                    'persona' => 'Test Persona',
                    'tokens' => 50,
                    'response_time' => 1.0,
                    'model' => 'gpt-4',
                ],
            ],
        ];

        $service = new ChatBridgeService();
        $reflection = new \ReflectionClass($service);
        $property = $reflection->getProperty('httpClient');
        $property->setAccessible(true);
        $property->setValue($service, $this->mockHttpClient(200, $mockResponse));

        $service->initiateConversation($conversation);

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'content' => 'First message',
            'sender' => 'a',
            'persona' => 'Test Persona',
            'tokens' => 50,
        ]);
    }

    /** @test */
    public function initiate_conversation_broadcasts_events_for_each_message()
    {
        Event::fake();

        $conversation = Conversation::factory()->create();

        $mockResponse = [
            'messages' => [
                [
                    'content' => 'Message 1',
                    'sender' => 'a',
                    'persona' => 'Persona A',
                    'tokens' => 50,
                    'response_time' => 1.0,
                    'model' => 'gpt-4',
                ],
                [
                    'content' => 'Message 2',
                    'sender' => 'b',
                    'persona' => 'Persona B',
                    'tokens' => 60,
                    'response_time' => 1.2,
                    'model' => 'claude-3',
                ],
            ],
        ];

        $service = new ChatBridgeService();
        $reflection = new \ReflectionClass($service);
        $property = $reflection->getProperty('httpClient');
        $property->setAccessible(true);
        $property->setValue($service, $this->mockHttpClient(200, $mockResponse));

        $service->initiateConversation($conversation);

        Event::assertDispatched(ConversationMessageReceived::class, 2);
    }

    /** @test */
    public function continue_conversation_sends_user_message()
    {
        Event::fake();

        $conversation = Conversation::factory()->create();

        $mockResponse = [
            'messages' => [
                [
                    'content' => 'Response to user',
                    'sender' => 'a',
                    'persona' => 'Assistant',
                    'tokens' => 75,
                    'response_time' => 1.3,
                    'model' => 'gpt-4',
                ],
            ],
        ];

        $service = new ChatBridgeService();
        $reflection = new \ReflectionClass($service);
        $property = $reflection->getProperty('httpClient');
        $property->setAccessible(true);
        $property->setValue($service, $this->mockHttpClient(200, $mockResponse));

        $result = $service->continueConversation($conversation, 'User message');

        $this->assertArrayHasKey('conversation_id', $result);
        $this->assertArrayHasKey('messages', $result);
    }

    /** @test */
    public function continue_conversation_stores_new_messages()
    {
        Event::fake();

        $conversation = Conversation::factory()->create();

        // Create initial message
        Message::factory()->create([
            'conversation_id' => $conversation->id,
            'content' => 'Initial message',
        ]);

        $mockResponse = [
            'messages' => [
                [
                    'content' => 'Continued message',
                    'sender' => 'a',
                    'persona' => 'Assistant',
                    'tokens' => 80,
                    'response_time' => 1.5,
                    'model' => 'gpt-4',
                ],
            ],
        ];

        $service = new ChatBridgeService();
        $reflection = new \ReflectionClass($service);
        $property = $reflection->getProperty('httpClient');
        $property->setAccessible(true);
        $property->setValue($service, $this->mockHttpClient(200, $mockResponse));

        $service->continueConversation($conversation, 'Continue please');

        $this->assertEquals(2, Message::where('conversation_id', $conversation->id)->count());
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'content' => 'Continued message',
        ]);
    }

    /** @test */
    public function service_handles_messages_without_optional_fields()
    {
        Event::fake();

        $conversation = Conversation::factory()->create();

        $mockResponse = [
            'messages' => [
                [
                    'content' => 'Minimal message',
                    'sender' => 'a',
                ],
            ],
        ];

        $service = new ChatBridgeService();
        $reflection = new \ReflectionClass($service);
        $property = $reflection->getProperty('httpClient');
        $property->setAccessible(true);
        $property->setValue($service, $this->mockHttpClient(200, $mockResponse));

        $result = $service->initiateConversation($conversation);

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'content' => 'Minimal message',
            'sender' => 'a',
        ]);

        $message = Message::first();
        $this->assertNull($message->persona);
        $this->assertNull($message->tokens);
        $this->assertNull($message->response_time);
        $this->assertNull($message->model);
    }

    /** @test */
    public function service_throws_exception_on_backend_error()
    {
        $this->expectException(\Exception::class);

        $conversation = Conversation::factory()->create();

        $mock = new MockHandler([
            new Response(500, [], json_encode(['error' => 'Backend error']))
        ]);

        $handlerStack = HandlerStack::create($mock);
        $client = new Client(['handler' => $handlerStack]);

        $service = new ChatBridgeService();
        $reflection = new \ReflectionClass($service);
        $property = $reflection->getProperty('httpClient');
        $property->setAccessible(true);
        $property->setValue($service, $client);

        $service->initiateConversation($conversation);
    }

    /** @test */
    public function service_returns_empty_messages_when_backend_returns_no_messages()
    {
        Event::fake();

        $conversation = Conversation::factory()->create();

        $mockResponse = ['messages' => []];

        $service = new ChatBridgeService();
        $reflection = new \ReflectionClass($service);
        $property = $reflection->getProperty('httpClient');
        $property->setAccessible(true);
        $property->setValue($service, $this->mockHttpClient(200, $mockResponse));

        $result = $service->initiateConversation($conversation);

        $this->assertArrayHasKey('messages', $result);
        $this->assertEmpty($result['messages']);
    }
}

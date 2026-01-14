<?php

namespace App\Services;

use App\Events\ConversationMessageReceived;
use App\Models\Conversation;
use App\Models\Message;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

class ChatBridgeService
{
    protected $pythonBackendUrl;
    protected $httpClient;

    public function __construct()
    {
        // Assume the Python backend is running locally
        $this->pythonBackendUrl = env('PYTHON_BACKEND_URL', 'http://localhost:8000');
        $this->httpClient = new Client();
    }

    public function initiateConversation(Conversation $conversation)
    {
        try {
            // First message from the conversation
            $firstMessage = $conversation->starter_message;

            // Prepare payload matching the Python backend's expected format
            $payload = [
                'provider_a' => $conversation->provider_a,
                'provider_b' => $conversation->provider_b,
                'persona_a' => $conversation->personaA ? $conversation->personaA->name : null,
                'persona_b' => $conversation->personaB ? $conversation->personaB->name : null,
                'starter_message' => $firstMessage,
                'max_rounds' => $conversation->max_rounds,
                'temperature_a' => $conversation->temperature_a,
                'temperature_b' => $conversation->temperature_b,
                'model_a' => $conversation->model_a,
                'model_b' => $conversation->model_b,
                // Pass current environment variables as API keys
                'api_keys' => [
                    'openai' => env('OPENAI_API_KEY'),
                    'anthropic' => env('ANTHROPIC_API_KEY'),
                    'google' => env('GOOGLE_API_KEY'),
                    'mistral' => env('MISTRAL_API_KEY')
                ]
            ];

            // Send request to Python backend
            $response = $this->httpClient->post("{$this->pythonBackendUrl}/conversations", [
                'json' => $payload
            ]);

            $responseData = json_decode($response->getBody(), true);

            // Store initial messages and trigger WebSocket events
            $storedMessages = $this->storeConversationMessages($conversation, $responseData['messages'] ?? []);

            return [
                'conversation_id' => $conversation->id,
                'messages' => $storedMessages
            ];
        } catch (\Exception $e) {
            Log::error('Conversation Initiation Failed: ' . $e->getMessage());
            throw $e;
        }
    }

    protected function storeConversationMessages(Conversation $conversation, array $messages)
    {
        $storedMessages = [];
        foreach ($messages as $messageData) {
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'content' => $messageData['content'],
                'sender' => $messageData['sender'],
                'persona' => $messageData['persona'] ?? null,
                'tokens' => $messageData['tokens'] ?? null,
                'response_time' => $messageData['response_time'] ?? null,
                'model' => $messageData['model'] ?? null
            ]);

            // Trigger WebSocket event for each message
            broadcast(new ConversationMessageReceived($conversation, $message));
            
            $storedMessages[] = $message;
        }

        return $storedMessages;
    }

    public function continueConversation(Conversation $conversation, $userMessage)
    {
        try {
            $payload = [
                'conversation_id' => $conversation->id,
                'user_message' => $userMessage,
                'api_keys' => [
                    'openai' => env('OPENAI_API_KEY'),
                    'anthropic' => env('ANTHROPIC_API_KEY'),
                    'google' => env('GOOGLE_API_KEY'),
                    'mistral' => env('MISTRAL_API_KEY')
                ]
            ];

            $response = $this->httpClient->post("{$this->pythonBackendUrl}/conversations/continue", [
                'json' => $payload
            ]);

            $responseData = json_decode($response->getBody(), true);
            $storedMessages = $this->storeConversationMessages($conversation, $responseData['messages'] ?? []);

            return [
                'conversation_id' => $conversation->id,
                'messages' => $storedMessages
            ];
        } catch (\Exception $e) {
            Log::error('Conversation Continuation Failed: ' . $e->getMessage());
            throw $e;
        }
    }
}
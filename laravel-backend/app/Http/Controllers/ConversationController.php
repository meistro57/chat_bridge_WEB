<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Persona;
use App\Services\ChatBridgeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ConversationController extends Controller
{
    protected $chatBridgeService;

    public function __construct(ChatBridgeService $chatBridgeService)
    {
        $this->chatBridgeService = $chatBridgeService;
    }

    public function start(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'provider_a' => 'required|string',
            'provider_b' => 'required|string',
            'persona_a' => 'nullable|string',
            'persona_b' => 'nullable|string',
            'starter_message' => 'required|string',
            'max_rounds' => 'integer|min:1|max:20',
            'temperature_a' => 'numeric|min:0|max:1',
            'temperature_b' => 'numeric|min:0|max:1',
            'model_a' => 'nullable|string',
            'model_b' => 'nullable|string',
            'api_keys' => 'nullable|array'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        // Find or create personas if names are provided
        $personaA = $request->persona_a 
            ? Persona::firstOrCreate(['name' => $request->persona_a]) 
            : null;
        $personaB = $request->persona_b 
            ? Persona::firstOrCreate(['name' => $request->persona_b]) 
            : null;

        // Create conversation
        $conversation = Conversation::create([
            'provider_a' => $request->provider_a,
            'provider_b' => $request->provider_b,
            'persona_a_id' => $personaA ? $personaA->id : null,
            'persona_b_id' => $personaB ? $personaB->id : null,
            'starter_message' => $request->starter_message,
            'max_rounds' => $request->max_rounds ?? 5,
            'temperature_a' => $request->temperature_a ?? 0.7,
            'temperature_b' => $request->temperature_b ?? 0.7,
            'model_a' => $request->model_a,
            'model_b' => $request->model_b
        ]);

        // Inject API keys if provided
        if ($request->has('api_keys')) {
            foreach ($request->input('api_keys') as $provider => $key) {
                putenv(strtoupper($provider) . '_API_KEY=' . $key);
            }
        }

        // Initiate conversation via Python backend
        $result = $this->chatBridgeService->initiateConversation($conversation);

        return response()->json([
            'conversation_id' => $conversation->id,
            'status' => 'initiated',
            'messages' => $result['messages'] ?? []
        ]);
    }

    public function status(Request $request)
    {
        // Placeholder implementation of provider status check
        // In a real-world scenario, this would validate API keys
        $providersToCheck = $request->input('providers', []);

        $statuses = [];
        foreach ($providersToCheck as $provider) {
            $statuses[] = [
                'provider' => $provider,
                'valid' => !empty(env(strtoupper($provider) . '_API_KEY')),
                'models' => $this->getProviderModels($provider)
            ];
        }

        return response()->json([
            'provider_statuses' => $statuses
        ]);
    }

    protected function getProviderModels($provider)
    {
        // Hardcoded models for now, ideally this would come from a configuration
        $models = [
            'openai' => ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
            'anthropic' => ['claude-2', 'claude-instant'],
            'google' => ['gemini-pro', 'palm-2'],
            'mistral' => ['mistral-small', 'mistral-medium']
        ];

        return $models[$provider] ?? [];
    }

    public function continue(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'conversation_id' => 'required|exists:conversations,id',
            'user_message' => 'required|string',
            'api_keys' => 'nullable|array'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        // Inject API keys if provided
        if ($request->has('api_keys')) {
            foreach ($request->input('api_keys') as $provider => $key) {
                putenv(strtoupper($provider) . '_API_KEY=' . $key);
            }
        }

        $conversation = Conversation::findOrFail($request->input('conversation_id'));
        
        // Continue conversation via Python backend
        $result = $this->chatBridgeService->continueConversation(
            $conversation, 
            $request->input('user_message')
        );

        return response()->json([
            'conversation_id' => $conversation->id,
            'messages' => $result['messages'] ?? []
        ]);
    }
}
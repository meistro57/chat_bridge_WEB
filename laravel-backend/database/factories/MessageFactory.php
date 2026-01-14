<?php

namespace Database\Factories;

use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Message>
 */
class MessageFactory extends Factory
{
    protected $model = Message::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'conversation_id' => Conversation::factory(),
            'content' => fake()->paragraph(),
            'sender' => fake()->randomElement(['a', 'b']),
            'persona' => fake()->word(),
            'tokens' => fake()->numberBetween(50, 500),
            'response_time' => fake()->randomFloat(2, 0.5, 5.0),
            'model' => fake()->randomElement(['gpt-4', 'claude-3-opus', 'gemini-pro']),
        ];
    }
}

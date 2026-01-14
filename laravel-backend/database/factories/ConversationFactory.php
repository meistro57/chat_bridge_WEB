<?php

namespace Database\Factories;

use App\Models\Conversation;
use App\Models\Persona;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Conversation>
 */
class ConversationFactory extends Factory
{
    protected $model = Conversation::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'provider_a' => fake()->randomElement(['openai', 'anthropic', 'google']),
            'provider_b' => fake()->randomElement(['openai', 'anthropic', 'google']),
            'persona_a_id' => Persona::factory(),
            'persona_b_id' => Persona::factory(),
            'starter_message' => fake()->sentence(),
            'max_rounds' => fake()->numberBetween(5, 20),
            'temperature_a' => fake()->randomFloat(1, 0, 1),
            'temperature_b' => fake()->randomFloat(1, 0, 1),
            'model_a' => fake()->randomElement(['gpt-4', 'claude-3-opus', 'gemini-pro']),
            'model_b' => fake()->randomElement(['gpt-4', 'claude-3-opus', 'gemini-pro']),
        ];
    }
}

<?php

namespace Database\Factories;

use App\Models\Persona;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Persona>
 */
class PersonaFactory extends Factory
{
    protected $model = Persona::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->word() . ' Assistant',
            'description' => fake()->sentence(),
            'system_preview' => fake()->text(100),
            'provider' => fake()->randomElement(['openai', 'anthropic', 'google']),
            'system_prompt' => fake()->paragraph(),
            'temperature' => fake()->randomFloat(1, 0, 1),
            'model' => fake()->randomElement(['gpt-4', 'claude-3-opus', 'gemini-pro']),
            'guidelines' => [
                fake()->sentence(),
                fake()->sentence(),
            ],
            'notes' => fake()->sentence(),
        ];
    }
}

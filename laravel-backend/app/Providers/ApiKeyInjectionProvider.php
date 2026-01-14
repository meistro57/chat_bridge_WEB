<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class ApiKeyInjectionProvider extends ServiceProvider
{
    public function boot()
    {
        if (config('app.dynamic_key_injection', false)) {
            $this->injectApiKeys();
        }
    }

    protected function injectApiKeys()
    {
        $providers = [
            'openai' => 'OPENAI_API_KEY',
            'anthropic' => 'ANTHROPIC_API_KEY',
            'google' => 'GOOGLE_API_KEY',
            'mistral' => 'MISTRAL_API_KEY'
        ];

        // Check if the request contains API keys
        $requestKeys = request()->input('api_keys', []);

        foreach ($providers as $provider => $envKey) {
            if (isset($requestKeys[$provider])) {
                putenv("$envKey={$requestKeys[$provider]}");
                $_ENV[$envKey] = $requestKeys[$provider];
            }
        }
    }
}
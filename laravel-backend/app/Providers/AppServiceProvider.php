<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register()
    {
        // Register services
        $this->app->bind('ChatBridgeService', function ($app) {
            return new \App\Services\ChatBridgeService();
        });
    }

    public function boot()
    {
        // Boot services
    }
}
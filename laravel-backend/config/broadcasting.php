<?php

return [
    'default' => env('BROADCAST_DRIVER', 'pusher'),

    'connections' => [
        'pusher' => [
            'driver' => 'pusher',
            'key' => env('PUSHER_APP_KEY', 'local_key'),
            'secret' => env('PUSHER_APP_SECRET', 'local_secret'),
            'app_id' => env('PUSHER_APP_ID', 'local_app_id'),
            'options' => [
                'cluster' => env('PUSHER_APP_CLUSTER', 'mt1'),
                'useTLS' => true,
                'host' => env('PUSHER_HOST', 'api-' . env('PUSHER_APP_CLUSTER', 'mt1') . '.pusher.com'),
                'port' => env('PUSHER_PORT', 443),
                'scheme' => env('PUSHER_SCHEME', 'https'),
                'encrypted' => true,
            ],
        ],
    ],
];
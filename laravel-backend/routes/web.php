<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'application' => 'Chat Bridge Web Backend',
        'status' => 'operational'
    ]);
});
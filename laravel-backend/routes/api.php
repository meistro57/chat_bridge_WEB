<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\PersonaController;

Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('logout', [AuthController::class, 'logout'])->middleware('jwt.auth');
    Route::get('me', [AuthController::class, 'me'])->middleware('jwt.auth');
});

Route::middleware('jwt.auth')->group(function () {
    // Conversation Routes
    Route::post('/conversations', [ConversationController::class, 'start']);
    Route::post('/conversations/continue', [ConversationController::class, 'continue']);
    Route::post('/provider-status', [ConversationController::class, 'status']);

    // Persona Routes
    Route::get('/personas', [PersonaController::class, 'index']);
    Route::post('/personas', [PersonaController::class, 'store']);
    Route::get('/personas/{id}', [PersonaController::class, 'show']);
});
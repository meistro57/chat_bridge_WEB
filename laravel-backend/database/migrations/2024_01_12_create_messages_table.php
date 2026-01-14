<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->onDelete('cascade');
            $table->text('content');
            $table->enum('sender', ['user', 'agent_a', 'agent_b']);
            $table->string('persona')->nullable();
            $table->integer('tokens')->nullable();
            $table->float('response_time')->nullable();
            $table->string('model')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('messages');
    }
};
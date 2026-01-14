<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->string('provider_a');
            $table->string('provider_b');
            $table->foreignId('persona_a_id')->nullable()->constrained('personas')->onDelete('set null');
            $table->foreignId('persona_b_id')->nullable()->constrained('personas')->onDelete('set null');
            $table->text('starter_message');
            $table->integer('max_rounds')->default(5);
            $table->float('temperature_a')->default(0.7);
            $table->float('temperature_b')->default(0.7);
            $table->string('model_a')->nullable();
            $table->string('model_b')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('conversations');
    }
};
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Conversation extends Model
{
    protected $fillable = [
        'provider_a', 
        'provider_b', 
        'persona_a_id', 
        'persona_b_id', 
        'starter_message', 
        'max_rounds', 
        'temperature_a', 
        'temperature_b', 
        'model_a', 
        'model_b'
    ];

    public function personaA()
    {
        return $this->belongsTo(Persona::class, 'persona_a_id');
    }

    public function personaB()
    {
        return $this->belongsTo(Persona::class, 'persona_b_id');
    }

    public function messages()
    {
        return $this->hasMany(Message::class);
    }
}
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Persona extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 
        'description', 
        'system_preview', 
        'provider', 
        'system_prompt', 
        'temperature', 
        'model', 
        'guidelines', 
        'notes'
    ];

    protected $casts = [
        'guidelines' => 'array',
        'temperature' => 'float'
    ];
}
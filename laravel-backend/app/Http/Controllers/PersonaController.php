<?php

namespace App\Http\Controllers;

use App\Models\Persona;
use Illuminate\Http\Request;

class PersonaController extends Controller
{
    public function index()
    {
        return response()->json(Persona::all());
    }

    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'name' => 'required|string|unique:personas',
            'description' => 'nullable|string',
            'system_preview' => 'nullable|string',
            'provider' => 'required|string',
            'system_prompt' => 'required|string',
            'temperature' => 'nullable|numeric|min:0|max:1',
            'model' => 'nullable|string',
            'guidelines' => 'nullable|array',
            'notes' => 'nullable|string'
        ]);

        $persona = Persona::create($validatedData);

        return response()->json($persona, 201);
    }

    public function show($id)
    {
        return response()->json(Persona::findOrFail($id));
    }
}
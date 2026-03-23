<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PlaylistController;

Route::get('/', function () {
    return view('welcome');
});

Route::post('/api/parse-playlist', [PlaylistController::class, 'parse']);

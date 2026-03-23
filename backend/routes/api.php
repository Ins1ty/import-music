<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PlaylistController;
use App\Http\Controllers\ProxyController;
use App\Http\Controllers\DownloadController;

Route::post('/parse-playlist', [PlaylistController::class, 'parse']);
Route::get('/proxy', [ProxyController::class, 'proxy']);
Route::post('/proxy', [ProxyController::class, 'proxy']);
Route::match(['post', 'options'], '/download-playlist', [DownloadController::class, 'downloadPlaylist']);

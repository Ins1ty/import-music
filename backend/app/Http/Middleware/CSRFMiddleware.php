<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class CSRFMiddleware extends Middleware
{
    protected $except = [
        'api/*',
    ];
}

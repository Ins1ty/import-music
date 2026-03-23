<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PlaylistController extends Controller
{
    public function parse(Request $request)
    {
        $url = $request->input('url');

        if (!$url) {
            return response()->json(['error' => 'URL is required'], 400);
        }

        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            return response()->json(['error' => 'Invalid URL'], 400);
        }

        if (!str_contains($url, 'music.yandex.ru') && !str_contains($url, 'yandex.ru/music')) {
            return response()->json(['error' => 'Only Yandex Music URLs are supported'], 400);
        }

        try {
            $client = new \GuzzleHttp\Client([
                'verify' => false,
                'headers' => [
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                ],
                'timeout' => 30,
            ]);

            $response = $client->get($url);
            $html = (string) $response->getBody();

            if (str_contains($html, 'робот') || str_contains($html, 'captcha')) {
                return response()->json([
                    'captcha' => true,
                    'message' => 'Yandex is showing a captcha. Please open https://music.yandex.ru in your browser, solve the captcha, then try again.',
                ], 403);
            }

            $tracks = $this->extractTracksFromHtml($html);

            return response()->json([
                'success' => true,
                'tracks' => $tracks,
                'count' => count($tracks)
            ]);
        } catch (\Exception $e) {
            Log::error('Playlist parse error: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to parse playlist: ' . $e->getMessage()], 500);
        }
    }

    private function extractTracksFromHtml(string $html): array
    {
        $tracks = [];
        
        if (preg_match_all('/"tracks"\s*:\s*\[(.*?)\]/s', $html, $matches)) {
            $tracksJson = '[' . implode(',', $matches[1]) . ']';
            $decoded = json_decode($tracksJson, true);
            
            if (is_array($decoded)) {
                foreach ($decoded as $track) {
                    if (isset($track['title'])) {
                        $artist = 'Unknown';
                        if (isset($track['artists']) && is_array($track['artists'])) {
                            $artistNames = array_column($track['artists'], 'name');
                            $artist = implode(', ', $artistNames);
                        }
                        $tracks[] = [
                            'title' => $track['title'],
                            'artist' => $artist,
                        ];
                    }
                }
            }
        }

        if (empty($tracks) && preg_match_all('/"title"\s*:\s*"([^"]+)"[^{}]*"artists"\s*:\s*\[(.*?)\]/s', $html, $matches)) {
            foreach ($matches[1] as $index => $title) {
                $artistName = isset($matches[2][$index]) ? strip_tags($matches[2][$index]) : 'Unknown';
                $tracks[] = [
                    'title' => html_entity_decode($title, ENT_QUOTES, 'UTF-8'),
                    'artist' => html_entity_decode($artistName, ENT_QUOTES, 'UTF-8'),
                ];
            }
        }
        
        return $tracks;
    }
}

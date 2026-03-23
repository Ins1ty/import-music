<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use ZipStream\ZipStream;
use ZipStream\OperationMode;

class DownloadController extends Controller
{
    private string $secret = 'p93jhgh689SBReK6ghtw62';
    private string $md5Salt = 'XGRlBW9FXlekgbPrRHuSiA';
    private int $timeout = 120;

    public function downloadPlaylist(Request $request)
    {
        set_time_limit(0);
        
        $token = $request->input('token');
        $playlistUrl = $request->input('playlistUrl');

        if (!$token || !$playlistUrl) {
            return response()->json(['error' => 'Token and playlist URL are required'], 400);
        }

        preg_match('/\/playlists\/([a-zA-Z0-9-]+)/', $playlistUrl, $matches);
        if (!$matches) {
            return response()->json(['error' => 'Invalid playlist URL'], 400);
        }

        $playlistUuid = $matches[1];

        try {
            $playlistData = $this->fetchPlaylist($token, $playlistUuid);
            if (!$playlistData || !isset($playlistData['result']['tracks'])) {
                return response()->json(['error' => 'Playlist not found'], 404);
            }

            $playlistTitle = $playlistData['result']['title'] ?? 'playlist';
            $tracks = $playlistData['result']['tracks'];

            if (empty($tracks)) {
                return response()->json(['error' => 'Playlist is empty'], 400);
            }

            $trackList = [];
            foreach ($tracks as $idx => $trackRef) {
                $track = $trackRef['track'] ?? null;
                if (!$track) continue;

                $trackList[] = [
                    'index' => $idx + 1,
                    'id' => $track['id'],
                    'title' => $track['title'] ?? 'Unknown',
                    'artists' => $this->extractArtists($track['artists'] ?? []),
                ];
            }

            $zipFileName = $this->sanitizeFileName($playlistTitle) . '.zip';
            
            return response()->stream(function() use ($token, $trackList, $zipFileName) {
                $zip = new ZipStream(
                    operationMode: OperationMode::NORMAL,
                    outputName: $zipFileName,
                    sendHttpHeaders: true
                );

                foreach ($trackList as $trackInfo) {
                    $audioData = $this->downloadTrack($token, $trackInfo['id']);
                    
                    if ($audioData) {
                        $fileName = sprintf(
                            '%02d - %s.mp3',
                            $trackInfo['index'],
                            $this->sanitizeFileName($trackInfo['artists'] . ' - ' . $trackInfo['title'])
                        );
                        $zip->addFile($fileName, $audioData);
                    }
                }

                $zip->finish();
                flush();
            }, 200, [
                'Content-Type' => 'application/zip',
                'Content-Disposition' => 'attachment; filename="' . $zipFileName . '"',
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Expose-Headers' => 'Content-Disposition',
            ]);

        } catch (\Exception $e) {
            Log::error('Download playlist error: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function downloadSelected(Request $request)
    {
        set_time_limit(0);
        
        $token = $request->input('token');
        $tracksJson = $request->input('tracks');
        $playlistTitle = $request->input('playlistTitle', 'playlist');

        if (!$token || !$tracksJson) {
            return response()->json(['error' => 'Token and tracks are required'], 400);
        }

        try {
            $tracks = json_decode($tracksJson, true);
            if (!is_array($tracks) || empty($tracks)) {
                return response()->json(['error' => 'No tracks to download'], 400);
            }

            $trackCount = count($tracks);
            $safeTitle = $this->sanitizeFileName($playlistTitle);
            $zipFileName = "{$safeTitle} ({$trackCount} tracks).zip";
            
            return response()->stream(function() use ($token, $tracks, $zipFileName) {
                $zip = new ZipStream(
                    operationMode: OperationMode::NORMAL,
                    outputName: $zipFileName,
                    sendHttpHeaders: true
                );

                foreach ($tracks as $idx => $track) {
                    $trackId = $track['trackId'] ?? $track['id'] ?? 0;
                    if (!$trackId) continue;

                    $audioData = $this->downloadTrack($token, $trackId);
                    
                    if ($audioData) {
                        $title = $track['title'] ?? 'Unknown';
                        $artist = $track['artist'] ?? 'Unknown';
                        $fileName = sprintf(
                            '%02d - %s.mp3',
                            $idx + 1,
                            $this->sanitizeFileName($artist . ' - ' . $title)
                        );
                        $zip->addFile($fileName, $audioData);
                    }
                }

                $zip->finish();
                flush();
            }, 200, [
                'Content-Type' => 'application/zip',
                'Content-Disposition' => 'attachment; filename="' . $zipFileName . '"',
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Expose-Headers' => 'Content-Disposition',
            ]);

        } catch (\Exception $e) {
            Log::error('Download selected error: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    private function fetchPlaylist(string $token, string $uuid): ?array
    {
        $url = "https://api.music.yandex.net/playlist/{$uuid}";
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: OAuth ' . $token,
        ]);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $response) {
            return json_decode($response, true);
        }
        
        return null;
    }

    private function extractArtists(array $artists): string
    {
        if (empty($artists)) return 'Unknown';
        
        $names = array_map(fn($a) => $a['name'] ?? '', $artists);
        $names = array_filter($names);
        
        return implode(', ', $names) ?: 'Unknown';
    }

    private function downloadTrack(string $token, int $trackId): ?string
    {
        try {
            $downloadInfo = $this->getDownloadInfo($token, $trackId);
            if (!$downloadInfo) {
                return null;
            }

            $directUrl = $downloadInfo['directUrl'];
            if (!$directUrl) {
                return null;
            }

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $directUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer: https://music.yandex.ru/',
            ]);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

            $audioData = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode === 200 && strlen($audioData) > 1000) {
                return $audioData;
            }

            return null;

        } catch (\Exception $e) {
            Log::warning("Track download failed: {$trackId} - " . $e->getMessage());
            return null;
        }
    }

    private function getDownloadInfo(string $token, int $trackId): ?array
    {
        $timestamp = time();
        $sign = $this->computeSignature($trackId, $timestamp);

        $url = "https://api.music.yandex.net/tracks/{$trackId}/download-info?can_use_streaming=true&ts={$timestamp}&sign=" . urlencode($sign);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: OAuth ' . $token,
            'X-Yandex-Music-Client: YandexMusicAndroid/24022571',
        ]);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $response = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($response, true);
        $infos = $data['result'] ?? [];

        if (empty($infos)) {
            return null;
        }

        foreach ($infos as $info) {
            if (($info['codec'] ?? '') === 'mp3') {
                return $this->getDirectUrlFromInfo($info['downloadInfoUrl'] ?? '');
            }
        }

        return null;
    }

    private function getDirectUrlFromInfo(string $xmlUrl): ?array
    {
        if (empty($xmlUrl)) {
            return null;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $xmlUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);

        $xmlResponse = curl_exec($ch);
        curl_close($ch);

        $xml = @simplexml_load_string($xmlResponse, 'SimpleXMLElement', LIBXML_NOCDATA);
        
        if (!$xml) {
            return null;
        }

        $xmlArray = json_decode(json_encode($xml), true);

        $host = $xmlArray['host'] ?? '';
        $path = $xmlArray['path'] ?? '';
        $ts = $xmlArray['ts'] ?? '';
        $s = $xmlArray['s'] ?? '';

        if (empty($host) || empty($path) || empty($ts) || empty($s)) {
            return null;
        }

        $pathWithoutSlash = substr($path, 1);
        $hash = md5($this->md5Salt . $pathWithoutSlash . $s);
        $directUrl = "https://{$host}/get-mp3/{$hash}/{$ts}{$path}";

        return [
            'directUrl' => $directUrl,
            'host' => $host,
        ];
    }

    private function computeSignature(int $trackId, int $timestamp): string
    {
        $data = $trackId . $timestamp;
        return base64_encode(hash_hmac('sha256', $data, $this->secret, true));
    }

    private function sanitizeFileName(string $name): string
    {
        $name = preg_replace('/[<>:"\/\\\\|?*]/', '', $name);
        $name = preg_replace('/\s+/', ' ', $name);
        $name = trim($name);
        
        if (empty($name)) {
            return 'unknown';
        }

        return mb_substr($name, 0, 100);
    }
}

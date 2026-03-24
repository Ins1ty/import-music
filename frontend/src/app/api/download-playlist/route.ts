import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import JSZip from 'jszip';

const MD5_SALT = 'XGRlBW9FXlekgbPrRHuSiA';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, playlistUrl } = body;

    if (!token || !playlistUrl) {
      return NextResponse.json({ error: 'Token and playlist URL are required' }, { status: 400 });
    }

    const playlistMatch = playlistUrl.match(/\/playlists\/([a-zA-Z0-9-]+)/);
    if (!playlistMatch) {
      return NextResponse.json({ error: 'Invalid playlist URL' }, { status: 400 });
    }

    const playlistUuid = playlistMatch[1];

    const playlistResponse = await fetch(`https://api.music.yandex.net/playlist/${playlistUuid}`, {
      headers: { 'Authorization': `OAuth ${token}` },
    });

    if (!playlistResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch playlist' }, { status: playlistResponse.status });
    }

    const playlistData = await playlistResponse.json();
    const playlistTitle = playlistData.result?.title || 'playlist';
    const tracks = playlistData.result?.tracks || [];

    if (!tracks.length) {
      return NextResponse.json({ error: 'Playlist is empty' }, { status: 400 });
    }

    const zip = new JSZip();
    
    const trackCount = tracks.length;
    const safeTitle = sanitizeFileName(playlistTitle);
    const zipFileName = `${safeTitle}.zip`;

    for (let idx = 0; idx < tracks.length; idx++) {
      const trackRef = tracks[idx];
      const track = trackRef.track;
      if (!track) continue;

      const trackId = track.id;
      const audioData = await downloadTrack(token, trackId);
      
      if (audioData) {
        const title = track.title || 'Unknown';
        const artists = extractArtists(track.artists || []);
        const fileName = `${String(idx + 1).padStart(2, '0')} - ${sanitizeFileName(artists + ' - ' + title)}.mp3`;
        zip.file(fileName, Buffer.from(audioData));
      }
    }

    const zipBuffer = await zip.generateAsync({
      type: 'base64',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });

    const zipBufferDecoded = Buffer.from(zipBuffer, 'base64');

    return new NextResponse(zipBufferDecoded, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Download error' },
      { status: 500 }
    );
  }
}

function extractArtists(artists: Array<{ name: string }>): string {
  if (!artists.length) return 'Unknown';
  return artists.map(a => a.name).filter(Boolean).join(', ') || 'Unknown';
}

async function downloadTrack(token: string, trackId: number): Promise<Buffer | null> {
  try {
    const downloadInfo = await getDownloadInfo(token, trackId);
    if (!downloadInfo) return null;

    const response = await fetch(downloadInfo.directUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://music.yandex.ru/',
      },
    });

    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

async function getDownloadInfo(token: string, trackId: number): Promise<{ directUrl: string } | null> {
  const timestamp = Math.floor(Date.now() / 1000);
  const url = `https://api.music.yandex.net/tracks/${trackId}/download-info?can_use_streaming=true&ts=${timestamp}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `OAuth ${token}`,
        'X-Yandex-Music-Client': 'YandexMusicAndroid/24022571',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const infos = data.result || [];

    for (const info of infos) {
      if (info.codec === 'mp3') {
        return getDirectUrlFromInfo(info.downloadInfoUrl);
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function getDirectUrlFromInfo(xmlUrl: string): Promise<{ directUrl: string } | null> {
  try {
    const response = await fetch(xmlUrl);
    const xml = await response.text();

    const hostMatch = xml.match(/<host>([^<]+)<\/host>/);
    const pathMatch = xml.match(/<path>([^<]+)<\/path>/);
    const tsMatch = xml.match(/<ts>([a-zA-Z0-9]+)<\/ts>/);
    const sMatch = xml.match(/<s>([^<]+)<\/s>/);

    if (!hostMatch || !pathMatch || !tsMatch || !sMatch) return null;

    const host = hostMatch[1];
    const path = pathMatch[1];
    const ts = tsMatch[1];
    const s = sMatch[1];

    const pathWithoutSlash = path.substring(1);
    const hash = md5(MD5_SALT + pathWithoutSlash + s);
    const directUrl = `https://${host}/get-mp3/${hash}/${ts}${path}`;

    return { directUrl };
  } catch {
    return null;
  }
}

function md5(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  const hashBuffer = crypto.createHash('md5').update(utf8Bytes).digest();
  return Buffer.from(hashBuffer).toString('hex');
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/[\x00-\x1f]/g, '')
    .trim()
    .substring(0, 100) || 'unknown';
}

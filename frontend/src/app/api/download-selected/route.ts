import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const MD5_SALT = 'XGRlBW9FXlekgbPrRHuSiA';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, tracks, playlistTitle } = body;

    if (!token || !tracks || !Array.isArray(tracks)) {
      return NextResponse.json({ error: 'Token and tracks are required' }, { status: 400 });
    }

    const archiver = await import('archiver');
    
    const trackCount = tracks.length;
    const safeTitle = sanitizeFileName(playlistTitle || 'playlist');
    const zipFileName = `${safeTitle} (${trackCount} tracks).zip`;

    const chunks: Uint8Array[] = [];

    const archive = archiver.default('zip', {
      zlib: { level: 9 }
    });

    archive.on('data', (chunk: Uint8Array) => {
      chunks.push(chunk);
    });

    for (let idx = 0; idx < tracks.length; idx++) {
      const track = tracks[idx];
      const trackId = track.trackId || track.id;
      if (!trackId) continue;

      const audioData = await downloadTrack(token, trackId);
      
      if (audioData && audioData.length > 0) {
        const title = track.title || 'Unknown';
        const artist = track.artist || 'Unknown';
        const fileName = `${String(idx + 1).padStart(2, '0')} - ${sanitizeFileName(artist + ' - ' + title)}.mp3`;
        archive.append(audioData, { name: fileName });
      }
    }

    await archive.finalize();

    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'No data downloaded' }, { status: 500 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Download error' },
      { status: 500 }
    );
  }
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
  return crypto.createHash('md5').update(str).digest('hex');
}

function sanitizeFileName(name: string): string {
  let safe = name.replace(/[<>:"/\\|?*]/g, '').trim().substring(0, 100);
  return safe || 'unknown';
}

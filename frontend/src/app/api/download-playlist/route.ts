import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

    const downloadUrls: Array<{ url: string; filename: string }> = [];

    for (let idx = 0; idx < tracks.length; idx++) {
      const trackRef = tracks[idx];
      const track = trackRef.track;
      if (!track) continue;

      const trackId = track.id;
      const downloadInfo = await getDownloadInfo(token, trackId);
      if (!downloadInfo) continue;

      const title = track.title || 'Unknown';
      const artists = extractArtists(track.artists || []);
      const filename = `${String(idx + 1).padStart(2, '0')} - ${artists} - ${title}.mp3`;

      downloadUrls.push({
        url: downloadInfo.directUrl,
        filename
      });
    }

    return NextResponse.json({
      downloads: downloadUrls,
      playlistTitle
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}

function extractArtists(artists: Array<{ name: string }>): string {
  if (!artists.length) return 'Unknown';
  return artists.map(a => a.name).filter(Boolean).join(', ') || 'Unknown';
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

    const MD5_SALT = 'XGRlBW9FXlekgbPrRHuSiA';
    const pathWithoutSlash = path.substring(1);
    const crypto = await import('crypto');
    const encoder = new TextEncoder();
    const data = encoder.encode(MD5_SALT + pathWithoutSlash + s);
    const hash = crypto.createHash('md5').update(data).digest('hex');
    const directUrl = `https://${host}/get-mp3/${hash}/${ts}${path}`;

    return { directUrl };
  } catch {
    return null;
  }
}

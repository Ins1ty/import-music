'use client'

import { useState } from 'react'
import { usePlaylistStore } from '@/store/playlistStore'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Boxes } from '@/components/ui/background-boxes'
import { Music, Loader2, X, AlertCircle, Download, HardDrive, Link } from 'lucide-react'

export default function Home() {
  const { 
    tracks, 
    loading, 
    downloading,
    error, 
    setTracks, 
    setLoading, 
    setError,
    setDownloading,
    reset 
  } = usePlaylistStore()
  
  const [token] = useState('y0__xDnpeqLAhje-AYgwIDy6xY7k7c1lRcL71AES3yo_cBhvMx2Nw')
  const [playlistUrl, setPlaylistUrl] = useState('')

  const handleTokenImport = async () => {
    if (!playlistUrl.trim()) {
      setError('Please enter playlist URL')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const playlistIdMatch = playlistUrl.match(/\/playlists\/([a-zA-Z0-9-]+)/)
      
      if (!playlistIdMatch) {
        setError('Invalid playlist URL. Use format: https://music.yandex.ru/playlists/...')
        setLoading(false)
        return
      }

      const playlistUuid = playlistIdMatch[1]
      const apiUrl = encodeURIComponent(`https://api.music.yandex.net/playlist/${playlistUuid}`)

      const userResponse = await fetch(
        `http://localhost:8000/api/proxy?url=${apiUrl}`,
        {
          headers: {
            'Authorization': `OAuth ${token}`,
          }
        }
      )

      if (!userResponse.ok) {
        const errData = await userResponse.json().catch(() => ({}))
        setError(`Failed to fetch playlist: ${errData.error || userResponse.status}`)
        setLoading(false)
        return
      }

      const playlistData = await userResponse.json()
      
      if (!playlistData.result || !playlistData.result.tracks) {
        setError('Playlist not found')
        setLoading(false)
        return
      }

      const trackRefs = playlistData.result.tracks || []
      
      if (trackRefs.length === 0) {
        setError('No tracks in playlist')
        setLoading(false)
        return
      }

      const foundTracks: Array<{title: string, artist: string, trackId: number, albumId: number}> = []
      const seen = new Set<string>()

      trackRefs.forEach((ref: { track: { id: number; title: string; artists?: Array<{ name: string }>; albums?: Array<{ id: number }> } }) => {
        const track = ref.track
        if (track && track.title) {
          const title = track.title
          const trackId = track.id || 0
          const albumId = track.albums?.[0]?.id || 0
          let artist = 'Unknown'

          if (track.artists && Array.isArray(track.artists) && track.artists.length > 0) {
            const artistNames = track.artists
              .map((a: { name: string }) => a.name)
              .filter(Boolean)
            if (artistNames.length > 0) {
              artist = artistNames.join(', ')
            }
          }

          if (title.length > 2 && title.length < 200) {
            const key = title.toLowerCase()
            if (!seen.has(key)) {
              seen.add(key)
              foundTracks.push({ title, artist, trackId, albumId })
            }
          }
        }
      })

      if (foundTracks.length === 0) {
        setError('No tracks found. The playlist might be empty.')
      } else {
        setTracks(foundTracks)
      }
    } catch (err) {
      setError('Failed to fetch playlist. Make sure Laravel backend is running on port 8000.')
    }
    setLoading(false)
  }

  const handleDownload = () => {
    if (!playlistUrl.trim() || tracks.length === 0) {
      setError('Please import a playlist first')
      return
    }

    setDownloading(true)
    setError(null)

    const form = document.createElement('form')
    form.method = 'POST'
    form.action = 'http://localhost:8000/api/download-playlist'
    form.style.display = 'none'

    const tokenInput = document.createElement('input')
    tokenInput.type = 'hidden'
    tokenInput.name = 'token'
    tokenInput.value = token
    form.appendChild(tokenInput)

    const urlInput = document.createElement('input')
    urlInput.type = 'hidden'
    urlInput.name = 'playlistUrl'
    urlInput.value = playlistUrl
    form.appendChild(urlInput)

    document.body.appendChild(form)
    form.submit()
    
    setTimeout(() => {
      document.body.removeChild(form)
      setDownloading(false)
    }, 10000)
  }

  const handleClear = () => {
    setPlaylistUrl('')
    reset()
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="absolute inset-0 z-0">
        <Boxes className="opacity-30" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16 max-w-4xl">
        <div className="flex flex-col items-center justify-center mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600">
              <Music className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-white to-zinc-400 bg-clip-text text-transparent">
              Import Music
            </h1>
          </div>
          <p className="text-zinc-400 text-lg">Download Yandex Music playlists to your computer</p>
        </div>

        <div className="mb-8">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 max-w-2xl mx-auto">
            <div className="space-y-4">
              <div>
                <label className="text-zinc-400 text-sm block mb-2">Playlist URL:</label>
                <Input
                  type="url"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  placeholder="https://music.yandex.ru/playlists/55e9d094-a315-7831-b923-52c2a7555c45"
                  className="h-12 bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500"
                />
              </div>
              <p className="text-zinc-500 text-sm">
                Copy the playlist link from Yandex Music and paste it here
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={handleTokenImport} disabled={loading} className="flex-1 h-12">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Link className="w-5 h-5 mr-2" />
                    Import Playlist
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 max-w-2xl mx-auto backdrop-blur-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {tracks.length > 0 && (
          <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden max-w-2xl mx-auto backdrop-blur-sm">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-blue-400" />
                <span className="font-medium text-white">{tracks.length} tracks found</span>
              </div>
              <div className="flex items-center gap-2">
                {downloading && (
                  <div className="flex items-center gap-2 text-sm text-zinc-400 mr-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Downloading...</span>
                  </div>
                )}
                <Button onClick={handleDownload} disabled={downloading} className="bg-green-600 hover:bg-green-700">
                  <Download className="w-4 h-4 mr-2" />
                  Download ZIP
                </Button>
                <button
                  onClick={handleClear}
                  className="p-2 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {tracks.map((track, index) => (
                <div
                  key={index}
                  className="px-4 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 text-sm w-6">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-white">{track.title}</div>
                      <div className="text-sm text-zinc-400 truncate">{track.artist}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && tracks.length === 0 && !error && (
          <div className="text-center text-zinc-500 py-12">
            <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Paste a Yandex Music playlist URL above to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}

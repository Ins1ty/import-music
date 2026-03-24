'use client'

import { useState } from 'react'
import { usePlaylistStore } from '@/store/playlistStore'
import { useTheme } from '@/components/theme-provider'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Boxes } from '@/components/ui/background-boxes'
import { Music, Loader2, X, AlertCircle, Download, HardDrive, Link, CheckSquare, Square } from 'lucide-react'

export default function Home() {
  const { 
    tracks, 
    playlistTitle,
    selectedTracks,
    loading, 
    downloading,
    error, 
    setTracks, 
    toggleTrack,
    selectAll,
    unselectAll,
    setLoading, 
    setError,
    setDownloading,
    reset 
  } = usePlaylistStore()
  const { theme } = useTheme()
  
  const [token] = useState('y0__xDnpeqLAhje-AYgwIDy6xY7k7c1lRcL71AES3yo_cBhvMx2Nw')
  const [playlistUrl, setPlaylistUrl] = useState('')

  const handleTokenImport = async () => {
    if (!playlistUrl.trim()) {
      setError('Please enter playlist or album URL')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const playlistIdMatch = playlistUrl.match(/\/playlists\/([a-zA-Z0-9-]+)/)
      const albumIdMatch = playlistUrl.match(/\/album\/(\d+)/)
      
      if (playlistIdMatch) {
        const playlistUuid = playlistIdMatch[1]
        const apiUrl = `/api/proxy?url=${encodeURIComponent(`https://api.music.yandex.net/playlist/${playlistUuid}`)}`

        const userResponse = await fetch(apiUrl, {
          headers: {
            'Authorization': `OAuth ${token}`,
          }
        })

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
          const playlistTitle = playlistData.result.title || 'playlist'
          setTracks(foundTracks, playlistTitle)
        }
      } else if (albumIdMatch) {
        const albumId = albumIdMatch[1]
        const apiUrl = `/api/proxy?url=${encodeURIComponent(`https://api.music.yandex.net/albums/${albumId}`)}`

        const userResponse = await fetch(apiUrl, {
          headers: {
            'Authorization': `OAuth ${token}`,
          }
        })

        if (!userResponse.ok) {
          const errData = await userResponse.json().catch(() => ({}))
          setError(`Failed to fetch album: ${errData.error || userResponse.status}`)
          setLoading(false)
          return
        }

        const albumData = await userResponse.json()
        
        if (!albumData.result) {
          setError('Album not found')
          setLoading(false)
          return
        }

        const tracksArray = albumData.result.volumes?.[0] || []
        
        if (tracksArray.length === 0) {
          setError('No tracks in album')
          setLoading(false)
          return
        }

        const foundTracks: Array<{title: string, artist: string, trackId: number, albumId: number}> = []
        const seen = new Set<string>()

        tracksArray.forEach((track: { id: number; title: string; artists?: Array<{ name: string }> }) => {
          if (track && track.title) {
            const title = track.title
            const trackId = track.id || 0
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
                foundTracks.push({ title, artist, trackId, albumId: parseInt(albumId) })
              }
            }
          }
        })

        if (foundTracks.length === 0) {
          setError('No tracks found. The album might be empty.')
        } else {
          const albumTitle = albumData.result.title || 'album'
          setTracks(foundTracks, albumTitle)
        }
      } else {
        setError('Invalid URL. Use format: https://music.yandex.ru/playlists/... or https://music.yandex.ru/album/...')
        setLoading(false)
        return
      }
    } catch (err) {
      setError('Failed to fetch. Check console for details.')
    }
    setLoading(false)
  }

  const handleDownload = async () => {
    if (selectedTracks.size === 0) {
      setError('Please select at least one track to download')
      return
    }

    setDownloading(true)
    setError(null)

    try {
      const selectedTracksArray = tracks.filter((_, index) => selectedTracks.has(index))

      const response = await fetch('/api/download-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          tracks: selectedTracksArray,
          playlistTitle,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to get download URLs')
      }

      const data = await response.json()
      
      if (!data.downloads || data.downloads.length === 0) {
        throw new Error('No tracks available for download')
      }

      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      for (const download of data.downloads) {
        try {
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(download.url)}`
          const audioResponse = await fetch(proxyUrl)
          
          if (audioResponse.ok) {
            const arrayBuffer = await audioResponse.arrayBuffer()
            zip.file(download.filename, arrayBuffer)
          }
        } catch (e) {
          console.error('Failed to download:', download.filename, e)
        }
      }

      const zipBlob = await zip.generateAsync({ 
        type: 'blob', 
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${data.playlistTitle || 'playlist'} (${selectedTracks.size} tracks).zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    }

    setDownloading(false)
  }

  const handleClear = () => {
    setPlaylistUrl('')
    reset()
  }

  const handleSelectAllToggle = () => {
    if (selectedTracks.size === tracks.length) {
      unselectAll()
    } else {
      selectAll()
    }
  }

  const isDark = theme === 'dark'
  const allSelected = selectedTracks.size === tracks.length && tracks.length > 0

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: isDark ? '#020617' : '#f1f5f9' }}>
      <div className="absolute inset-0 z-0">
        <Boxes />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16 max-w-4xl">
        <div className="flex flex-col items-center justify-center mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600">
              <Music className="w-8 h-8 text-white" />
            </div>
            <h1 className={`text-5xl font-bold bg-gradient-to-r ${isDark ? 'from-white via-blue-200 to-blue-400' : 'from-violet-700 via-violet-600 to-blue-600'} bg-clip-text text-transparent`}>
              Import Music
            </h1>
          </div>
            <p className={`text-lg ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Download Yandex Music playlists and albums to your computer
          </p>
        </div>

        <div className="mb-8">
          <div 
            className="rounded-2xl p-6 max-w-2xl mx-auto shadow-xl"
            style={{ 
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              borderWidth: '2px',
              borderColor: isDark ? '#334155' : '#e2e8f0'
            }}
          >
            <div className="space-y-4">
              <div>
                <label 
                  className={`text-sm block mb-2 font-semibold`}
                  style={{ color: isDark ? '#e2e8f0' : '#334155' }}
                >
                  Playlist or Album URL:
                </label>
                <Input
                  type="url"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  placeholder="https://music.yandex.ru/playlists/... or https://music.yandex.ru/album/..."
                  style={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#475569' : '#cbd5e1',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                />
              </div>
              <p className={isDark ? 'text-slate-400' : 'text-slate-500'} style={{ fontSize: '14px' }}>
                Copy the playlist or album link from Yandex Music and paste it here
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
                    Import
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div 
            className="mb-6 p-4 rounded-xl max-w-2xl mx-auto flex items-start gap-3"
            style={{ 
              backgroundColor: isDark ? 'rgba(127, 29, 29, 0.3)' : '#fef2f2',
              borderWidth: '2px',
              borderColor: isDark ? '#b91c1c' : '#fecaca',
              color: isDark ? '#fca5a5' : '#b91c1c'
            }}
          >
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {tracks.length > 0 && (
          <div 
            className="rounded-2xl overflow-hidden max-w-2xl mx-auto shadow-xl"
            style={{ 
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              borderWidth: '2px',
              borderColor: isDark ? '#334155' : '#e2e8f0'
            }}
          >
            <div 
              className="p-4 flex justify-between items-center"
              style={{ 
                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                borderBottomWidth: '2px',
                borderColor: isDark ? '#334155' : '#e2e8f0'
              }}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAllToggle}
                  className="p-1"
                  style={{ color: isDark ? '#60a5fa' : '#3b82f6' }}
                >
                  {allSelected ? (
                    <CheckSquare className="w-5 h-5" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>
                <Music className="w-5 h-5" style={{ color: isDark ? '#60a5fa' : '#3b82f6' }} />
                <span className="font-semibold" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                  {selectedTracks.size} of {tracks.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                {downloading && (
                  <div className="flex items-center gap-2 text-sm mr-2" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Downloading...</span>
                  </div>
                )}
                <Button 
                  onClick={handleDownload} 
                  disabled={downloading || selectedTracks.size === 0}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download ZIP ({selectedTracks.size})
                </Button>
                <button
                  onClick={handleClear}
                  className="p-2 rounded-lg"
                  style={{ 
                    backgroundColor: 'transparent',
                    color: isDark ? '#94a3b8' : '#64748b'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? '#334155' : '#e2e8f0'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {tracks.map((track, index) => (
                <div
                  key={index}
                  className="px-4 py-3 flex items-center gap-3"
                  style={{ 
                    borderBottomWidth: index < tracks.length - 1 ? '1px' : '0',
                    borderColor: isDark ? '#1e293b' : '#f1f5f9',
                    backgroundColor: selectedTracks.has(index) 
                      ? (isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)')
                      : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedTracks.has(index)) {
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedTracks.has(index)) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  <button
                    onClick={() => toggleTrack(index)}
                    style={{ color: isDark ? '#60a5fa' : '#3b82f6' }}
                  >
                    {selectedTracks.has(index) ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <span className="text-sm w-6" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                      {track.title}
                    </div>
                    <div className="text-sm truncate" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                      {track.artist}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && tracks.length === 0 && !error && (
          <div className="text-center py-12" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
            <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Paste a Yandex Music playlist or album URL above to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}

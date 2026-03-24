"use client"

import { useState } from 'react'
import { usePlaylistStore } from '@/store/playlistStore'
import { useTheme } from '@/components/theme-provider'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Boxes } from '@/components/ui/background-boxes'
import { Music, Loader2, X, AlertCircle, Download, HardDrive, Link, CheckSquare, Square, Search } from 'lucide-react'
import JSZip from 'jszip'

export default function Home() {
  const { 
    tracks, 
    setTracks, 
    selectedTracks, 
    toggleTrack, 
    selectAll, 
    unselectAll,
    playlistTitle,
    loading,
    setLoading,
    error,
    setError,
    downloading,
    setDownloading,
    reset 
  } = usePlaylistStore()
  const { theme } = useTheme()
  
  const [token] = useState('y0__xDnpeqLAhje-AYgwIDy6xY7k7c1lRcL71AES3yo_cBhvMx2Nw')
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{title: string, artist: string, trackId: number, albumId: number}>>([])
  const [searching, setSearching] = useState(false)
  const [selectedSearchResults, setSelectedSearchResults] = useState<Set<number>>(new Set())
  const [searchDownloading, setSearchDownloading] = useState(false)
  const [activeTab, setActiveTab] = useState<'import' | 'search'>('import')

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
        const fetchedTracks: Array<{title: string, artist: string, trackId: number, albumId: number}> = []

        for (const ref of trackRefs) {
          const track = ref.track
          if (track && track.title) {
            let title = track.title.replace(/[<>:"/\\|?*]/g, '')
            let artist = 'Unknown'

            if (track.artists && Array.isArray(track.artists) && track.artists.length > 0) {
              const artistNames = track.artists
                .map((a: { name: string }) => a.name)
                .filter(Boolean)
              if (artistNames.length > 0) {
                artist = artistNames.join(', ')
              }
            }

            const albumId = track.albums?.[0]?.id || 0
            const trackId = track.id || 0

            if (title.length > 2 && title.length < 200) {
              fetchedTracks.push({ title, artist, trackId, albumId })
            }
          }
        }

        const playlistName = playlistData.result.title || 'Playlist'
        setTracks(fetchedTracks, playlistName)
      } else if (albumIdMatch) {
        const albumId = albumIdMatch[1]
        console.log('Album ID extracted:', albumId)

        const albumResponse = await fetch(
          `/api/proxy?url=${encodeURIComponent(`https://api.music.yandex.net/albums/${albumId}/with-tracks`)}`,
          {
            headers: { 'Authorization': `OAuth ${token}` }
          }
        )

        if (!albumResponse.ok) {
          const errData = await albumResponse.json().catch(() => ({}))
          setError(`Failed to fetch album: ${errData.error || albumResponse.status}`)
          setLoading(false)
          return
        }

        const albumData = await albumResponse.json()
        console.log('Album data:', albumData)

        if (!albumData.result) {
          setError('Album not found')
          setLoading(false)
          return
        }

        let tracksFromAlbum: Array<any> = []
        
        if (albumData.result.volumes && albumData.result.volumes.length > 0) {
          for (const volume of albumData.result.volumes) {
            if (Array.isArray(volume)) {
              tracksFromAlbum.push(...volume)
            }
          }
        } else if (albumData.result.tracks) {
          tracksFromAlbum = albumData.result.tracks
        }

        console.log('Tracks from album:', tracksFromAlbum.length)

        const fetchedTracks: Array<{title: string, artist: string, trackId: number, albumId: number}> = []

        for (const track of tracksFromAlbum) {
          if (track && track.title) {
            let title = track.title.replace(/[<>:"/\\|?*]/g, '')
            let artist = 'Unknown'

            if (track.artists && Array.isArray(track.artists) && track.artists.length > 0) {
              const artistNames = track.artists
                .map((a: { name: string }) => a.name)
                .filter(Boolean)
              if (artistNames.length > 0) {
                artist = artistNames.join(', ')
              }
            }

            const trackId = track.id || 0

            if (title.length > 2 && title.length < 200) {
              fetchedTracks.push({ title, artist, trackId, albumId: parseInt(albumId) })
            }
          }
        }

        console.log('Tracks found:', fetchedTracks.length)

        if (fetchedTracks.length === 0) {
          setError('No tracks in album')
          setLoading(false)
          return
        }

        const albumName = albumData.result.title || 'Album'
        setTracks(fetchedTracks, albumName)
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query')
      return
    }

    setSearching(true)
    setError(null)
    setSearchResults([])

    try {
      const response = await fetch(
        `/api/proxy?url=${encodeURIComponent(`https://api.music.yandex.net/search?text=${encodeURIComponent(searchQuery)}&type=track&page=0`)}`,
        {
          headers: { 'Authorization': `OAuth ${token}` }
        }
      )

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        setError(`Search failed: ${errData.error || response.status}`)
        setSearching(false)
        return
      }

      const data = await response.json()
      console.log('Search results:', data)

      if (!data.result || !data.result.tracks) {
        setError('No results found')
        setSearching(false)
        return
      }

      let tracks: Array<any> = []
      if (Array.isArray(data.result.tracks)) {
        tracks = data.result.tracks
      } else if (data.result.tracks.results) {
        tracks = data.result.tracks.results
      } else if (data.result.tracks.items) {
        tracks = data.result.tracks.items
      }

      if (tracks.length === 0) {
        setError('No tracks found')
        setSearching(false)
        return
      }

      const foundTracks: Array<{title: string, artist: string, trackId: number, albumId: number}> = []

      tracks.forEach((item: { track?: { id: number; title: string; artists?: Array<{ name: string }>; albums?: Array<{ id: number }> }; id?: number; title?: string; artists?: Array<{ name: string }>; albums?: Array<{ id: number }> }) => {
        const track = item.track || item
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
            foundTracks.push({ title, artist, trackId, albumId })
          }
        }
      })

      if (foundTracks.length === 0) {
        setError('No tracks found')
      } else {
        setSearchResults(foundTracks)
        setSelectedSearchResults(new Set())
      }
    } catch (err) {
      setError('Search failed. Check console for details.')
    }

    setSearching(false)
  }

  const handleAddFromSearch = () => {
    if (searchResults.length > 0) {
      setTracks(searchResults, 'Search Results')
      setSearchResults([])
      setSearchQuery('')
    }
  }

  const toggleSearchResult = (index: number) => {
    const newSelected = new Set(selectedSearchResults)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedSearchResults(newSelected)
  }

  const selectAllSearchResults = () => {
    if (selectedSearchResults.size === searchResults.length) {
      setSelectedSearchResults(new Set())
    } else {
      setSelectedSearchResults(new Set(searchResults.map((_, i) => i)))
    }
  }

  const handleDownloadFromSearch = async () => {
    if (selectedSearchResults.size === 0) {
      setError('Please select at least one track to download')
      return
    }

    setSearchDownloading(true)
    setError(null)

    try {
      const selectedTracksArray = searchResults.filter((_, index) => selectedSearchResults.has(index))

      const response = await fetch('/api/download-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          tracks: selectedTracksArray,
          playlistTitle: 'Search Results',
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
      a.download = `search_results.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    }

    setSearchDownloading(false)
  }

  const handleClearSearchResults = () => {
    setSearchResults([])
    setSearchQuery('')
    setSelectedSearchResults(new Set())
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
      a.download = `${data.playlistTitle || 'playlist'}.zip`
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

      <div className="relative z-10 container mx-auto px-3 md:px-4 py-6 md:py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-gradient-to-br from-violet-600 to-blue-600">
            <Music className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <h1 className={`text-2xl md:text-3xl font-bold bg-gradient-to-r ${isDark ? 'from-white via-blue-200 to-blue-400' : 'from-violet-700 via-violet-600 to-blue-600'} bg-clip-text text-transparent`}>
            Import Music
          </h1>
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
          <div 
            className="w-full md:w-64 flex-shrink-0 rounded-2xl overflow-hidden self-start"
            style={{ 
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              borderWidth: '2px',
              borderColor: isDark ? '#334155' : '#e2e8f0'
            }}
          >
            <div 
              className="p-4"
              style={{ 
                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                borderBottomWidth: '1px',
                borderColor: isDark ? '#334155' : '#e2e8f0'
              }}
            >
              <h2 className="text-sm font-semibold uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                Menu
              </h2>
            </div>
            <div className="p-2">
              <button
                onClick={() => setActiveTab('import')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                style={{ 
                  backgroundColor: activeTab === 'import' 
                    ? (isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)')
                    : 'transparent',
                  color: activeTab === 'import' 
                    ? (isDark ? '#a78bfa' : '#8b5cf6')
                    : (isDark ? '#e2e8f0' : '#334155')
                }}
              >
                <Link className="w-5 h-5" />
                <span className="font-medium">Import from URL</span>
              </button>
              <button
                onClick={() => setActiveTab('search')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                style={{ 
                  backgroundColor: activeTab === 'search' 
                    ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)')
                    : 'transparent',
                  color: activeTab === 'search' 
                    ? (isDark ? '#60a5fa' : '#3b82f6')
                    : (isDark ? '#e2e8f0' : '#334155')
                }}
              >
                <Search className="w-5 h-5" />
                <span className="font-medium">Search by Name</span>
              </button>
            </div>
          </div>

          <div className="flex-1 w-full">
            {activeTab === 'import' ? (
              <div 
                className="rounded-2xl p-6 shadow-xl"
                style={{ 
                  backgroundColor: isDark ? '#1e293b' : '#ffffff',
                  borderWidth: '2px',
                  borderColor: isDark ? '#334155' : '#e2e8f0'
                }}
              >
                <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                  Import from URL
                </h2>
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
                  <Button onClick={handleTokenImport} disabled={loading} className="flex-1 h-12" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Import
                      </>
                    ) : (
                      <>
                        <Link className="w-5 h-5 mr-2" />
                        Import
                      </>
                    )}
                  </Button>
                </div>

                {tracks.length > 0 && (
                  <div 
                    className="rounded-2xl overflow-hidden mt-6"
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
                        <button onClick={(e) => {
                          e.stopPropagation()
                          handleSelectAllToggle()
                        }} style={{ color: isDark ? '#60a5fa' : '#3b82f6' }}>
                          {allSelected ? (
                            <CheckSquare className="w-5 h-5" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                        <span className="font-semibold" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                          {selectedTracks.size > 0 
                            ? `${selectedTracks.size} of ${tracks.length} selected`
                            : `${tracks.length} tracks`}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {playlistTitle && playlistTitle !== 'Search Results' && (
                          <span className="text-sm mr-2" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                            {playlistTitle}
                          </span>
                        )}
                        <Button onClick={handleDownload} disabled={downloading || selectedTracks.size === 0} className="h-9" style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                          {downloading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              Download {selectedTracks.size > 0 ? `(${selectedTracks.size})` : ''}
                            </>
                          )}
                        </Button>
                        <Button onClick={handleClear} variant="outline" className="h-9" style={{ borderColor: isDark ? '#475569' : '#cbd5e1' }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {tracks.map((track, index) => (
                        <div 
                          key={`${track.trackId}-${index}`}
                          className="p-3 flex items-center gap-3 cursor-pointer"
                          onClick={() => toggleTrack(index)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDark ? '#334155' : '#f1f5f9'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleTrack(index)
                            }}
                            style={{ color: isDark ? '#60a5fa' : '#3b82f6' }}
                          >
                            {selectedTracks.has(index) ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
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
              </div>
            ) : (
              <div 
                className="rounded-2xl p-6 shadow-xl"
                style={{ 
                  backgroundColor: isDark ? '#1e293b' : '#ffffff',
                  borderWidth: '2px',
                  borderColor: isDark ? '#334155' : '#e2e8f0'
                }}
              >
                <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                  Search by Name
                </h2>
                <div className="space-y-4">
                  <div>
                    <label 
                      className={`text-sm block mb-2 font-semibold`}
                      style={{ color: isDark ? '#e2e8f0' : '#334155' }}
                    >
                      Search by track name:
                    </label>
                    <Input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Enter track or artist name..."
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      style={{
                        backgroundColor: isDark ? '#0f172a' : '#ffffff',
                        borderColor: isDark ? '#475569' : '#cbd5e1',
                        color: isDark ? '#f8fafc' : '#0f172a',
                      }}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button onClick={handleSearch} disabled={searching} className="flex-1 h-12" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {searching ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Music className="w-5 h-5 mr-2" />
                        Search
                      </>
                    )}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div 
                    className="rounded-2xl overflow-hidden mt-6"
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
                        <button onClick={(e) => {
                          e.stopPropagation()
                          selectAllSearchResults()
                        }} style={{ color: isDark ? '#60a5fa' : '#3b82f6' }}>
                          {selectedSearchResults.size === searchResults.length && searchResults.length > 0 ? (
                            <CheckSquare className="w-5 h-5" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                        <span className="font-semibold" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                          {selectedSearchResults.size > 0 
                            ? `${selectedSearchResults.size} of ${searchResults.length} selected`
                            : `${searchResults.length} results`}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleDownloadFromSearch} disabled={searchDownloading || (selectedSearchResults.size === 0 && searchResults.length > 0)} className="h-9" style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                          {searchDownloading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              {selectedSearchResults.size > 0 ? `Download (${selectedSearchResults.size})` : 'Download'}
                            </>
                          )}
                        </Button>
                        <Button onClick={handleClearSearchResults} variant="outline" className="h-9" style={{ borderColor: isDark ? '#475569' : '#cbd5e1' }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {searchResults.map((track, index) => (
                        <div 
                          key={`${track.trackId}-${index}`}
                          className="p-3 flex items-center gap-3 cursor-pointer"
                          onClick={() => toggleSearchResult(index)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDark ? '#334155' : '#f1f5f9'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          {selectedSearchResults.has(index) ? (
                            <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: isDark ? '#60a5fa' : '#3b82f6' }} />
                          ) : (
                            <Square className="w-4 h-4 flex-shrink-0" style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
                          )}
                          <Music className="w-4 h-4 flex-shrink-0" style={{ color: isDark ? '#60a5fa' : '#3b82f6' }} />
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
              </div>
            )}
          </div>
        </div>

        {error && (
          <div 
            className="mt-6 p-4 rounded-xl flex items-start gap-3"
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

        {!loading && tracks.length === 0 && searchResults.length === 0 && !error && (
          <div className="text-center py-12" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
            <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Select an option from the menu and start importing music</p>
          </div>
        )}
      </div>
    </div>
  )
}

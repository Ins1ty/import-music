import { create } from 'zustand'

export interface Track {
  title: string
  artist: string
  trackId?: number
  albumId?: number
}

interface PlaylistState {
  tracks: Track[]
  playlistTitle: string
  selectedTracks: Set<number>
  loading: boolean
  downloading: boolean
  error: string | null
  setTracks: (tracks: Track[], title?: string) => void
  toggleTrack: (trackId: number) => void
  selectAll: () => void
  unselectAll: () => void
  setLoading: (loading: boolean) => void
  setDownloading: (downloading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  tracks: [],
  playlistTitle: '',
  selectedTracks: new Set(),
  loading: false,
  downloading: false,
  error: null,
  setTracks: (tracks, title = 'playlist') => {
    const allSelected = new Set(tracks.map((_, i) => i))
    set({ tracks, playlistTitle: title, selectedTracks: allSelected })
  },
  toggleTrack: (index) => set((state) => {
    const newSelected = new Set(state.selectedTracks)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    return { selectedTracks: newSelected }
  }),
  selectAll: () => set((state) => ({
    selectedTracks: new Set(state.tracks.map((_, i) => i))
  })),
  unselectAll: () => set({ selectedTracks: new Set() }),
  setLoading: (loading) => set({ loading }),
  setDownloading: (downloading) => set({ downloading }),
  setError: (error) => set({ error }),
  reset: () => set({ tracks: [], playlistTitle: '', selectedTracks: new Set(), loading: false, downloading: false, error: null }),
}))

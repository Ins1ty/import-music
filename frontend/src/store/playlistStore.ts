import { create } from 'zustand'

export interface Track {
  title: string
  artist: string
  trackId?: number
  albumId?: number
}

interface PlaylistState {
  tracks: Track[]
  loading: boolean
  downloading: boolean
  error: string | null
  setTracks: (tracks: Track[]) => void
  setLoading: (loading: boolean) => void
  setDownloading: (downloading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const usePlaylistStore = create<PlaylistState>((set) => ({
  tracks: [],
  loading: false,
  downloading: false,
  error: null,
  setTracks: (tracks) => set({ tracks }),
  setLoading: (loading) => set({ loading }),
  setDownloading: (downloading) => set({ downloading }),
  setError: (error) => set({ error }),
  reset: () => set({ tracks: [], loading: false, downloading: false, error: null }),
}))

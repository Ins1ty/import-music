'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './theme-provider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="fixed top-4 right-4 z-50 p-3 rounded-full shadow-lg hover:scale-110"
      style={{
        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
      }}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-6 h-6 text-amber-500" />
      ) : (
        <Moon className="w-6 h-6 text-indigo-600" />
      )}
    </button>
  )
}

# Import Music

Download Yandex Music playlists to your computer as ZIP archives.

## Features

- Import playlists from Yandex Music
- Download tracks in MP3 format (320kbps)
- Beautiful dark-themed UI
- No external dependencies for download - works directly in browser

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS, Zustand
- **Backend**: Laravel PHP
- **Database**: SQLite (for future features)

## Setup

### Prerequisites

- PHP 8.1+
- Node.js 18+
- Composer

### Backend

```bash
cd backend
composer install
php artisan serve --port=8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Usage

1. Open http://localhost:3000
2. Paste a Yandex Music playlist URL
3. Click "Import Playlist"
4. Click "Download ZIP"

## API Endpoints

- `POST /api/proxy` - Proxy Yandex Music API requests
- `POST /api/download-playlist` - Download playlist as ZIP

## License

MIT

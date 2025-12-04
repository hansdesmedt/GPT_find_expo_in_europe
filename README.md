# Expo Finder Europe

Find art exhibitions and expos on an interactive map in Belgium and the Netherlands.

## Features

- 🗺️ Interactive map showing exhibitions in your area
- 🔍 Search with autocomplete for cities and neighborhoods
- 🎨 View exhibition details (title, artist, museum/gallery)
- 🔗 Direct links to museum exhibition pages
- 👨‍💼 Admin panel to manage museums and trigger indexing

## Setup

### Prerequisites

- Node.js >= 20.6.0
- PostgreSQL database
- Google Maps API key
- OpenAI/Trellis API key

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env` file and add your API keys:
   - `GOOGLE_MAPS_API_KEY` - Get from Google Cloud Console
   - `CHATITP_API_KEY` - Already configured
   - `DATABASE_URL` - PostgreSQL connection string

2. Set up the database:
```bash
npm run db:setup
```

### Development

```bash
npm run dev
```

Visit `http://localhost:3000`

### Deployment on Railway

1. Create a new project on Railway
2. Add a PostgreSQL database
3. Connect your GitHub repository
4. Add environment variables:
   - `GOOGLE_MAPS_API_KEY`
   - `CHATITP_API_KEY`
   - `OPENAI_BASE_URL`
   - `DATABASE_URL` (automatically set by Railway)

Railway will automatically deploy using the `railway.json` configuration.

## Tech Stack

- **Backend**: Express.js
- **Database**: PostgreSQL
- **Map**: Google Maps JavaScript API
- **Scraping**: jsdom + GPT-powered parsing
- **Deployment**: Railway

## Initial Coverage

Starting with major museums in Antwerp, Belgium:
- KMSKA (Royal Museum of Fine Arts)
- M HKA (Museum of Contemporary Art)
- MoMu (Fashion Museum)
- Museum Plantin-Moretus
- Rubens House

Expanding to Brussels, Ghent, and Netherlands cities.

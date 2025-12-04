# Setup Guide - Expo Finder Europe

## Prerequisites

Before you begin, make sure you have:

1. **Node.js** (version 20.6.0 or higher)
2. **PostgreSQL** database
3. **Google Maps API Key** (get from Google Cloud Console)
4. **Railway Account** (for deployment)

## Google Maps API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Geocoding API
   - Places API (optional, for enhanced search)
4. Create credentials → API Key
5. Restrict the API key (recommended):
   - For local development: Restrict to `http://localhost:3000`
   - For production: Restrict to your Railway domain

## Local Development Setup

### 1. Install Dependencies

```bash
cd /Users/hansdesmedt/Repositories/GPT_find_expo_in_europe
npm install
```

### 2. Configure Environment Variables

Edit `.env` file and add your Google Maps API key:

```bash
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

The OpenAI/Trellis API key is already configured.

### 3. Set Up PostgreSQL Database

Make sure PostgreSQL is running locally, then:

```bash
# Create database
createdb expo_finder

# Or update DATABASE_URL in .env to point to your PostgreSQL instance
DATABASE_URL=postgresql://username:password@localhost:5432/expo_finder
```

### 4. Initialize Database Schema

```bash
npm run db:setup
```

This will:
- Create all necessary tables
- Add initial Antwerp museums (KMSKA, M HKA, MoMu, etc.)
- Set up scraping sources

### 5. Update Google Maps API Key in Frontend

Edit `public/js/map.js` and replace `YOUR_API_KEY` with your actual key:

```javascript
// Line ~205 in public/js/map.js
script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_ACTUAL_API_KEY&callback=initMap`;
```

**Note:** For production, you should serve this from the backend to keep the key secure.

### 6. Start the Development Server

```bash
npm run dev
```

Visit:
- Main app: http://localhost:3000
- Admin panel: http://localhost:3000/admin.html

## First Steps After Setup

### 1. Index Initial Exhibitions

1. Go to Admin Panel: http://localhost:3000/admin.html
2. Click on "Scraping Sources" tab
3. Click "🔄 Index All Sources" button
4. Wait for the indexing to complete (this may take a few minutes)

### 2. Check the Map

1. Go back to the main page: http://localhost:3000
2. You should see exhibitions from Antwerp museums
3. Try searching for "Antwerp" in the search box

### 3. Add More Venues

Use the Admin Panel to add more museums and galleries:

**Suggested venues to add:**

**Brussels:**
- BOZAR (Centre for Fine Arts)
  - Website: https://www.bozar.be
  - Address: Rue Ravenstein 23, 1000 Brussels

- Wiels Contemporary Art Centre
  - Website: https://www.wiels.org
  - Address: Avenue Van Volxemlaan 354, 1190 Brussels

**Ghent:**
- S.M.A.K. (Museum of Contemporary Art)
  - Website: https://www.smak.be
  - Address: Jan Hoetplein 1, 9000 Ghent

**Amsterdam:**
- Rijksmuseum
  - Website: https://www.rijksmuseum.nl
  - Address: Museumstraat 1, 1071 XX Amsterdam

- Stedelijk Museum
  - Website: https://www.stedelijk.nl
  - Address: Museumplein 10, 1071 DJ Amsterdam

## Railway Deployment

### 1. Prepare Your Repository

Make sure your code is pushed to GitHub:

```bash
git init
git add .
git commit -m "Initial commit - Expo Finder Europe"
git branch -M main
git remote add origin your-github-repo-url
git push -u origin main
```

### 2. Create Railway Project

1. Go to [Railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

### 3. Add PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically set `DATABASE_URL` environment variable

### 4. Set Environment Variables

In Railway project settings, add:

```
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
CHATITP_API_KEY=sk-uNnSGRj_LhXKZzBW4V9jbw
OPENAI_BASE_URL=https://api.trellis.inthepocket.net/
NODE_ENV=production
```

### 5. Initialize Database on Railway

After deployment, use Railway's CLI or web terminal:

```bash
npm run db:setup
```

### 6. Update Google Maps API Key Restriction

In Google Cloud Console, add your Railway domain to the API key restrictions:
- Format: `https://your-app-name.up.railway.app`

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
psql -l

# Test connection
psql postgresql://localhost:5432/expo_finder
```

### Scraping Fails

- Check if website URLs are accessible
- Verify OpenAI API key is valid
- Check scraping logs in Admin Panel → Logs tab

### Map Not Loading

- Verify Google Maps API key is correct
- Check browser console for errors
- Ensure Maps JavaScript API is enabled in Google Cloud Console

### No Exhibitions Showing

- Run indexing from Admin Panel
- Check that venues have valid coordinates
- Verify exhibitions have not expired (check end_date)

## Maintenance

### Regular Indexing

Set up a cron job or Railway scheduled task to run indexing daily:

```bash
# Call the indexing endpoint
curl -X POST https://your-app.up.railway.app/admin/index/all
```

### Adding New Venues

Use the Admin Panel to add venues. The system will:
1. Automatically geocode the address
2. Create a scraping source
3. Allow you to trigger indexing

## API Endpoints

### Public API

- `GET /api/exhibitions` - Get all exhibitions
- `GET /api/exhibitions?city=Antwerp` - Filter by city
- `GET /api/search/cities?q=Ant` - Search cities (autocomplete)
- `GET /api/venues` - Get all venues
- `GET /api/stats` - Get statistics

### Admin API

- `GET /admin/venues` - Get all venues with stats
- `POST /admin/venues` - Add new venue
- `GET /admin/sources` - Get scraping sources
- `POST /admin/index/all` - Index all sources
- `POST /admin/index/:sourceId` - Index single source
- `GET /admin/logs` - Get scraping logs

## Next Steps

1. Add more museums and galleries across Belgium and Netherlands
2. Set up automated daily indexing
3. Add filtering by date range or exhibition type
4. Implement user favorites/bookmarks
5. Add image scraping for exhibitions
6. Integrate museum APIs where available

## Support

For issues or questions:
- Check the logs in Admin Panel
- Review Railway deployment logs
- Check browser console for frontend errors

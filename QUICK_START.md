# Quick Start Guide

Get your Expo Finder up and running in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Get Your Google Maps API Key

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project
3. Enable "Maps JavaScript API" and "Geocoding API"
4. Create an API key

## Step 3: Configure Environment

Add your Google Maps API key to `.env`:

```bash
GOOGLE_MAPS_API_KEY=your_key_here
```

The OpenAI/Trellis key is already configured.

## Step 4: Set Up Database

**Option A: Local PostgreSQL**

```bash
# Make sure PostgreSQL is running, then:
createdb expo_finder

# Initialize the database
npm run db:setup
```

**Option B: Railway (Production)**

Skip to "Railway Deployment" section in SETUP.md

## Step 5: Start the Server

```bash
npm run dev
```

Visit:
- **Map Interface**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin.html

## Step 6: Index Exhibitions

1. Go to Admin Panel
2. Click "Scraping Sources" tab
3. Click "🔄 Index All Sources"
4. Wait 2-3 minutes

That's it! You should now see exhibitions from Antwerp on the map.

## What's Next?

- Add more museums via Admin Panel
- Deploy to Railway (see SETUP.md)
- Customize the design
- Add more cities (Brussels, Amsterdam, etc.)

## Troubleshooting

**Map not loading?**
- Check your Google Maps API key in `.env`
- Make sure Maps JavaScript API is enabled in Google Cloud

**No exhibitions showing?**
- Go to Admin Panel and run indexing
- Check the Logs tab for any errors

**Database errors?**
- Make sure PostgreSQL is running
- Check `DATABASE_URL` in `.env`

Need more help? See the full SETUP.md guide.

# Railway Deployment Guide

## Prerequisites

1. **Railway Account** - Sign up at [railway.app](https://railway.app)
2. **GitHub Repository** - Your code should be in a GitHub repository
3. **Environment Variables** - Have your API keys ready

## Step 1: Create a New Project on Railway

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository: `GPT_find_expo_in_europe`
5. Railway will detect the Dockerfile automatically

## Step 2: Add PostgreSQL Database

1. In your Railway project, click **"New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically create a PostgreSQL database
4. The `DATABASE_URL` environment variable will be automatically set

## Step 3: Configure Environment Variables

In your Railway project settings, add these environment variables:

### Required Variables:

```
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
CHATITP_API_KEY=your_chatitp_api_key_here
OPENAI_BASE_URL=https://api.trellis.inthepocket.net/
NODE_ENV=production
```

### Auto-Set by Railway:
- `DATABASE_URL` - Automatically set when you add PostgreSQL
- `PORT` - Automatically set by Railway (usually 3000)

## Step 4: Deploy

1. Railway will automatically build and deploy when you push to GitHub
2. The build process:
   - Uses the `Dockerfile` to build the image
   - Installs dependencies
   - Sets up the database schema automatically on first run
   - Starts the application

## Step 5: Verify Deployment

1. Click on your deployment in Railway
2. Open the deployment URL (e.g., `your-app.railway.app`)
3. Check the logs for successful startup:
   ```
   ✅ Connected to PostgreSQL database
   ✅ Database tables already exist
   🚀 Expo Finder Europe server running on port 3000
   ```

## Step 6: Access Your Application

Your app will be available at: `https://your-project-name.up.railway.app`

## Monitoring & Logs

- **View Logs**: Railway Dashboard → Your Project → Deployments → Logs
- **Health Check**: Visit `/health` endpoint to verify the app is running
- **Database**: Access via Railway's PostgreSQL dashboard

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is set in Railway environment variables
- Check if PostgreSQL service is running
- Look for SSL connection errors in logs

### API Key Issues
- Ensure all environment variables are set correctly
- Check for typos in variable names
- Verify API keys are valid

### Build Failures
- Check Docker logs in Railway dashboard
- Ensure `package.json` dependencies are correct
- Verify Node.js version compatibility (requires Node 20.6+)

### Application Not Starting
- Check logs for errors
- Verify health check endpoint is responding: `/health`
- Ensure PORT is correctly configured

## Database Management

### Initialize Database Manually (if needed)
```bash
# Connect to Railway PostgreSQL
railway connect postgres

# Or run setup script locally with Railway DB
DATABASE_URL=<your-railway-db-url> npm run db:setup
```

### View Database
- Use Railway's PostgreSQL dashboard
- Or connect with any PostgreSQL client using the `DATABASE_URL`

## Updating Your Deployment

1. Push changes to GitHub main branch
2. Railway automatically detects changes and redeploys
3. Check deployment logs to verify success

## Important Notes

- **Database Auto-Init**: The database schema is automatically created on first deployment
- **SSL**: PostgreSQL SSL is automatically enabled in production
- **Health Checks**: Railway monitors your app via the `/health` endpoint
- **Restart Policy**: App will automatically restart on failure (max 10 retries)

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection (auto-set by Railway) |
| `GOOGLE_MAPS_API_KEY` | ✅ | Google Maps API key for geocoding and map |
| `CHATITP_API_KEY` | ✅ | ChatITP API key for parsing exhibitions |
| `OPENAI_BASE_URL` | ✅ | Base URL for AI service |
| `NODE_ENV` | ✅ | Set to `production` |
| `PORT` | Auto | Port number (auto-set by Railway) |

## Cost Estimation

Railway offers:
- **Hobby Plan**: $5/month (includes $5 credits)
- **PostgreSQL**: ~$5/month
- **Estimated Total**: ~$5-10/month depending on usage

## Support

- Railway Documentation: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Project Issues: https://github.com/[your-username]/GPT_find_expo_in_europe/issues

# Use Railway PostgreSQL for Local Development

If you don't want to install PostgreSQL locally, you can use Railway's database:

## Steps:

1. **Create a Railway account** at https://railway.app

2. **Create a new project:**
   - Click "New Project"
   - Select "Provision PostgreSQL"

3. **Get the connection string:**
   - Click on your PostgreSQL service
   - Go to "Connect" tab
   - Copy the "Postgres Connection URL"
   - It looks like: `postgresql://postgres:password@containers.railway.app:7432/railway`

4. **Update your `.env` file:**
   ```
   DATABASE_URL=postgresql://postgres:password@containers.railway.app:7432/railway
   ```
   (Replace with your actual connection string)

5. **Run the setup:**
   ```bash
   npm run db:setup
   npm run dev
   ```

That's it! Your local app will use Railway's cloud database.

## Advantages:
- No local PostgreSQL installation needed
- Same database for development and production
- Free tier: 500 hours/month (enough for development)
- Automatic backups

## Note:
When you deploy the full app to Railway later, you can either:
- Keep using this database, OR
- Create a separate production database

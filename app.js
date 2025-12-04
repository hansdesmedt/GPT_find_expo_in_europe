import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import apiRoutes from './src/routes/api.js';
import { initializeDatabase } from './src/database/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database on startup
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔌 Database URL present: ${!!process.env.DATABASE_URL}`);
console.log(`🔌 PORT from env: ${process.env.PORT}`);
console.log(`🔌 PORT being used: ${PORT}`);

if (process.env.NODE_ENV === 'production') {
  console.log('🚀 Production mode - initializing database...');
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('❌ Failed to initialize database. App may not work correctly.');
    console.error('Error:', error.message);
  }
} else {
  console.log('💻 Development mode - skipping automatic database initialization');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(join(__dirname, 'public')));

// API Routes
app.use('/api', apiRoutes);

// Config endpoint for frontend
app.get('/api/config', (req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  const address = server.address();
  console.log(`\n🚀 Expo Finder Europe server running`);
  console.log(`📍 Address: ${address.address}:${address.port}`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

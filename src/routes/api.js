import express from 'express';
import pool from '../database/db.js';
import { addCityAndIndex } from '../services/cityManager.js';

const router = express.Router();

/**
 * GET /api/search/cities
 * Autocomplete for cities with exhibitions
 */
router.get('/search/cities', async (req, res) => {
  try {
    const { q } = req.query;

    let query = `
      SELECT DISTINCT v.city, v.country, COUNT(e.id) as exhibition_count
      FROM venues v
      LEFT JOIN exhibitions e ON v.id = e.venue_id
      GROUP BY v.city, v.country
      ORDER BY exhibition_count DESC
    `;

    const params = [];

    if (q && q.trim() !== '') {
      query = `
        SELECT DISTINCT v.city, v.country, COUNT(e.id) as exhibition_count
        FROM venues v
        LEFT JOIN exhibitions e ON v.id = e.venue_id
        WHERE LOWER(v.city) LIKE LOWER($1)
        GROUP BY v.city, v.country
        ORDER BY exhibition_count DESC
        LIMIT 10
      `;
      params.push(`%${q}%`);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Search cities error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/exhibitions
 * Get exhibitions, optionally filtered by city or bounding box
 */
router.get('/exhibitions', async (req, res) => {
  try {
    const { city, cities, bounds } = req.query;

    let query = `
      SELECT
        e.id,
        e.title,
        e.artist,
        e.description,
        e.start_date,
        e.end_date,
        e.exhibition_url,
        e.image_url,
        v.id as venue_id,
        v.name as venue_name,
        v.city,
        v.country,
        v.address,
        v.latitude,
        v.longitude,
        v.website_url
      FROM exhibitions e
      JOIN venues v ON e.venue_id = v.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Filter by multiple cities (comma-separated)
    if (cities && cities.trim() !== '') {
      const cityArray = cities.split(',').map(c => c.trim());
      const placeholders = cityArray.map((_, i) => `$${paramIndex + i}`).join(',');
      query += ` AND LOWER(v.city) IN (${placeholders})`;
      params.push(...cityArray.map(c => c.toLowerCase()));
      paramIndex += cityArray.length;
    }
    // Fallback to single city filter
    else if (city && city.trim() !== '') {
      query += ` AND LOWER(v.city) = LOWER($${paramIndex})`;
      params.push(city);
      paramIndex++;
    }

    // Filter by map bounds (format: "swLat,swLng,neLat,neLng")
    if (bounds) {
      const [swLat, swLng, neLat, neLng] = bounds.split(',').map(parseFloat);
      if (!isNaN(swLat) && !isNaN(swLng) && !isNaN(neLat) && !isNaN(neLng)) {
        query += ` AND v.latitude BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        query += ` AND v.longitude BETWEEN $${paramIndex + 2} AND $${paramIndex + 3}`;
        params.push(swLat, neLat, swLng, neLng);
        paramIndex += 4;
      }
    }

    // Only show current/upcoming exhibitions (or those without dates)
    query += ` AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)`;

    query += ` ORDER BY e.start_date ASC NULLS LAST, e.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get exhibitions error:', error);
    res.status(500).json({ error: 'Failed to fetch exhibitions' });
  }
});

/**
 * GET /api/venues
 * Get all venues with their exhibition count
 */
router.get('/venues', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.*,
        COUNT(e.id) as exhibition_count
      FROM venues v
      LEFT JOIN exhibitions e ON v.id = e.venue_id
        AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
      GROUP BY v.id
      ORDER BY exhibition_count DESC, v.name ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get venues error:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

/**
 * GET /api/stats
 * Get overall statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const venueCount = await pool.query('SELECT COUNT(*) as count FROM venues');
    const exhibitionCount = await pool.query(
      `SELECT COUNT(*) as count FROM exhibitions
       WHERE end_date IS NULL OR end_date >= CURRENT_DATE`
    );
    const cityCount = await pool.query('SELECT COUNT(DISTINCT city) as count FROM venues');

    res.json({
      venues: parseInt(venueCount.rows[0].count),
      exhibitions: parseInt(exhibitionCount.rows[0].count),
      cities: parseInt(cityCount.rows[0].count)
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/cities
 * Get all cities with their exhibition counts
 */
router.get('/cities', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.city,
        v.country,
        COUNT(e.id) as exhibition_count
      FROM venues v
      LEFT JOIN exhibitions e ON v.id = e.venue_id
        AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
      GROUP BY v.city, v.country
      HAVING COUNT(v.id) > 0
      ORDER BY exhibition_count DESC, v.city ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get cities error:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

/**
 * GET /api/cities/status
 * Get indexing status for all cities
 */
router.get('/cities/status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.city,
        MAX(ss.last_scraped_at) as last_indexed,
        COUNT(CASE WHEN sl.status = 'failed' AND sl.scraped_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_failures
      FROM venues v
      LEFT JOIN scraping_sources ss ON v.id = ss.venue_id
      LEFT JOIN scraping_logs sl ON ss.id = sl.source_id
      GROUP BY v.city
    `);

    const cityStatus = {};
    result.rows.forEach(row => {
      cityStatus[row.city] = {
        last_indexed: row.last_indexed,
        recent_failures: parseInt(row.recent_failures) || 0
      };
    });

    res.json(cityStatus);
  } catch (error) {
    console.error('Get city status error:', error);
    res.status(500).json({ error: 'Failed to fetch city status' });
  }
});

/**
 * GET /api/cities/last-indexed
 * Check when a city was last indexed
 */
router.get('/cities/last-indexed', async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({ error: 'City parameter required' });
    }

    const result = await pool.query(`
      SELECT MAX(ss.last_scraped_at) as last_indexed
      FROM scraping_sources ss
      JOIN venues v ON ss.venue_id = v.id
      WHERE LOWER(v.city) = LOWER($1)
    `, [city]);

    res.json({
      city,
      last_indexed: result.rows[0]?.last_indexed || null
    });
  } catch (error) {
    console.error('Check last indexed error:', error);
    res.status(500).json({ error: 'Failed to check last indexed time' });
  }
});

/**
 * POST /api/cities/index
 * Add a new city and index its venues
 */
router.post('/cities/index', async (req, res) => {
  try {
    const { city } = req.body;

    if (!city) {
      return res.status(400).json({ error: 'City parameter required' });
    }

    // Check if city was indexed in last 24 hours
    const lastIndexCheck = await pool.query(`
      SELECT MAX(ss.last_scraped_at) as last_indexed
      FROM scraping_sources ss
      JOIN venues v ON ss.venue_id = v.id
      WHERE LOWER(v.city) = LOWER($1)
    `, [city]);

    const lastIndexed = lastIndexCheck.rows[0]?.last_indexed;
    if (lastIndexed) {
      const hoursSince = (new Date() - new Date(lastIndexed)) / 1000 / 60 / 60;
      if (hoursSince < 24) {
        return res.status(429).json({
          error: `City was indexed ${Math.floor(hoursSince)} hours ago. Please wait ${Math.ceil(24 - hoursSince)} more hours.`
        });
      }
    }

    // Add city and index
    const result = await addCityAndIndex(city);

    res.json(result);
  } catch (error) {
    console.error('Index city error:', error);
    res.status(500).json({ error: error.message || 'Failed to index city' });
  }
});

export default router;

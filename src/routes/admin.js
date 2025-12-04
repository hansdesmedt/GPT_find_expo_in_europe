import express from 'express';
import pool from '../database/db.js';
import { indexAllSources, indexSingleSource } from '../services/indexer.js';
import { geocodeAddress } from '../services/geocoding.js';

const router = express.Router();

/**
 * GET /admin/venues
 * Get all venues with scraping info
 */
router.get('/venues', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.*,
        COUNT(DISTINCT e.id) as exhibition_count,
        COUNT(DISTINCT ss.id) as source_count,
        MAX(ss.last_scraped_at) as last_scraped
      FROM venues v
      LEFT JOIN exhibitions e ON v.id = e.venue_id
      LEFT JOIN scraping_sources ss ON v.id = ss.venue_id
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Admin get venues error:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

/**
 * POST /admin/venues
 * Add a new venue
 */
router.post('/venues', async (req, res) => {
  try {
    const { name, city, country, address, website_url, source_url } = req.body;

    if (!name || !city || !country) {
      return res.status(400).json({ error: 'Name, city, and country are required' });
    }

    // Geocode the address
    let latitude = null;
    let longitude = null;

    if (address) {
      const geocoded = await geocodeAddress(`${address}, ${city}, ${country}`);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
      }
    }

    // Insert venue
    const venueResult = await pool.query(
      `INSERT INTO venues (name, city, country, address, latitude, longitude, website_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, city, country, address || null, latitude, longitude, website_url || null]
    );

    const venue = venueResult.rows[0];

    // Add scraping source if provided
    if (source_url) {
      await pool.query(
        `INSERT INTO scraping_sources (venue_id, source_url, source_type)
         VALUES ($1, $2, 'website')`,
        [venue.id, source_url]
      );
    }

    res.status(201).json(venue);
  } catch (error) {
    console.error('Admin add venue error:', error);
    res.status(500).json({ error: 'Failed to add venue' });
  }
});

/**
 * GET /admin/sources
 * Get all scraping sources
 */
router.get('/sources', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ss.*,
        v.name as venue_name,
        v.city,
        (SELECT COUNT(*) FROM scraping_logs WHERE source_id = ss.id) as log_count,
        (SELECT status FROM scraping_logs WHERE source_id = ss.id ORDER BY scraped_at DESC LIMIT 1) as last_status
      FROM scraping_sources ss
      JOIN venues v ON ss.venue_id = v.id
      ORDER BY ss.last_scraped_at DESC NULLS LAST
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Admin get sources error:', error);
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

/**
 * POST /admin/index/all
 * Trigger indexing of all sources
 */
router.post('/index/all', async (req, res) => {
  try {
    // Run indexing in background
    indexAllSources()
      .then(results => {
        console.log('✅ Background indexing completed:', results);
      })
      .catch(error => {
        console.error('❌ Background indexing failed:', error);
      });

    res.json({ message: 'Indexing started in background' });
  } catch (error) {
    console.error('Admin index all error:', error);
    res.status(500).json({ error: 'Failed to start indexing' });
  }
});

/**
 * POST /admin/index/:sourceId
 * Trigger indexing of a single source
 */
router.post('/index/:sourceId', async (req, res) => {
  try {
    const { sourceId } = req.params;

    const result = await indexSingleSource(parseInt(sourceId));

    res.json({
      message: 'Indexing completed',
      ...result
    });
  } catch (error) {
    console.error('Admin index source error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/logs
 * Get scraping logs
 */
router.get('/logs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        sl.*,
        ss.source_url,
        v.name as venue_name
      FROM scraping_logs sl
      JOIN scraping_sources ss ON sl.source_id = ss.id
      JOIN venues v ON ss.venue_id = v.id
      ORDER BY sl.scraped_at DESC
      LIMIT 100
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Admin get logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;

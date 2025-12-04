import pool from '../database/db.js';
import { scrapeExhibitionsWithGPT } from '../scrapers/gptParser.js';

/**
 * Index all active scraping sources
 */
export async function indexAllSources() {
  try {
    console.log('🚀 Starting indexing process...');

    const result = await pool.query(
      `SELECT ss.id, ss.source_url, ss.source_type, v.id as venue_id, v.name as venue_name
       FROM scraping_sources ss
       JOIN venues v ON ss.venue_id = v.id
       WHERE ss.is_active = true`
    );

    const sources = result.rows;
    console.log(`📋 Found ${sources.length} active sources to index`);

    const results = [];

    for (const source of sources) {
      console.log(`\n📍 Indexing ${source.venue_name}...`);

      try {
        const exhibitions = await scrapeExhibitionsWithGPT(source.source_url);

        // Store exhibitions in database
        let savedCount = 0;

        for (const exhibition of exhibitions) {
          await pool.query(
            `INSERT INTO exhibitions (venue_id, title, artist, description, start_date, end_date, image_url, exhibition_url, last_scraped_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT DO NOTHING`,
            [
              source.venue_id,
              exhibition.title,
              exhibition.artist || null,
              exhibition.description || null,
              exhibition.start_date || null,
              exhibition.end_date || null,
              exhibition.image_url || null,
              exhibition.exhibition_url || source.source_url
            ]
          );
          savedCount++;
        }

        // Log success
        await pool.query(
          `INSERT INTO scraping_logs (source_id, status, exhibitions_found)
           VALUES ($1, 'success', $2)`,
          [source.id, exhibitions.length]
        );

        // Update last scraped timestamp
        await pool.query(
          `UPDATE scraping_sources SET last_scraped_at = NOW() WHERE id = $1`,
          [source.id]
        );

        results.push({
          venue: source.venue_name,
          status: 'success',
          exhibitions_found: exhibitions.length,
          exhibitions_saved: savedCount
        });

        console.log(`✅ Saved ${savedCount} exhibitions for ${source.venue_name}`);

        // Rate limiting - wait 2 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ Failed to index ${source.venue_name}:`, error.message);

        // Log failure
        await pool.query(
          `INSERT INTO scraping_logs (source_id, status, exhibitions_found, error_message)
           VALUES ($1, 'failed', 0, $2)`,
          [source.id, error.message]
        );

        results.push({
          venue: source.venue_name,
          status: 'failed',
          error: error.message
        });
      }
    }

    console.log('\n✅ Indexing complete!');
    return results;

  } catch (error) {
    console.error('❌ Indexing process failed:', error);
    throw error;
  }
}

/**
 * Index a single source by ID
 */
export async function indexSingleSource(sourceId) {
  try {
    const result = await pool.query(
      `SELECT ss.id, ss.source_url, v.id as venue_id, v.name as venue_name
       FROM scraping_sources ss
       JOIN venues v ON ss.venue_id = v.id
       WHERE ss.id = $1`,
      [sourceId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Source ${sourceId} not found`);
    }

    const source = result.rows[0];
    console.log(`📍 Indexing ${source.venue_name}...`);

    const exhibitions = await scrapeExhibitionsWithGPT(source.source_url);

    // Clear old exhibitions for this venue
    await pool.query(
      `DELETE FROM exhibitions WHERE venue_id = $1`,
      [source.venue_id]
    );

    // Insert new exhibitions
    for (const exhibition of exhibitions) {
      await pool.query(
        `INSERT INTO exhibitions (venue_id, title, artist, description, start_date, end_date, image_url, exhibition_url, last_scraped_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          source.venue_id,
          exhibition.title,
          exhibition.artist || null,
          exhibition.description || null,
          exhibition.start_date || null,
          exhibition.end_date || null,
          exhibition.image_url || null,
          exhibition.exhibition_url || source.source_url
        ]
      );
    }

    // Log success
    await pool.query(
      `INSERT INTO scraping_logs (source_id, status, exhibitions_found)
       VALUES ($1, 'success', $2)`,
      [source.id, exhibitions.length]
    );

    await pool.query(
      `UPDATE scraping_sources SET last_scraped_at = NOW() WHERE id = $1`,
      [source.id]
    );

    console.log(`✅ Indexed ${exhibitions.length} exhibitions for ${source.venue_name}`);

    return {
      venue: source.venue_name,
      exhibitions_found: exhibitions.length
    };

  } catch (error) {
    console.error('❌ Indexing failed:', error);
    throw error;
  }
}

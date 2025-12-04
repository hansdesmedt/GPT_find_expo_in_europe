import pool from './db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupDatabase() {
  try {
    console.log('🔧 Setting up database schema...');

    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await pool.query(schema);

    console.log('✅ Database schema created successfully');

    // Insert initial Antwerp venues
    console.log('📍 Adding Antwerp museums...');

    const venues = [
      {
        name: 'KMSKA - Royal Museum of Fine Arts Antwerp',
        city: 'Antwerp',
        country: 'Belgium',
        address: 'Leopold De Waelplaats 2, 2000 Antwerpen',
        lat: 51.2171,
        lon: 4.4067,
        website: 'https://kmska.be'
      },
      {
        name: 'M HKA - Museum of Contemporary Art Antwerp',
        city: 'Antwerp',
        country: 'Belgium',
        address: 'Leuvenstraat 32, 2000 Antwerpen',
        lat: 51.2093,
        lon: 4.4038,
        website: 'https://www.muhka.be'
      },
      {
        name: 'MoMu - Fashion Museum Antwerp',
        city: 'Antwerp',
        country: 'Belgium',
        address: 'Nationalestraat 28, 2000 Antwerpen',
        lat: 51.2161,
        lon: 4.4015,
        website: 'https://www.momu.be'
      },
      {
        name: 'Museum Plantin-Moretus',
        city: 'Antwerp',
        country: 'Belgium',
        address: 'Vrijdagmarkt 22, 2000 Antwerpen',
        lat: 51.2195,
        lon: 4.4006,
        website: 'https://www.museumplantinmoretus.be'
      },
      {
        name: 'Rubens House',
        city: 'Antwerp',
        country: 'Belgium',
        address: 'Wapper 9-11, 2000 Antwerpen',
        lat: 51.2189,
        lon: 4.4053,
        website: 'https://www.rubenshuis.be'
      }
    ];

    for (const venue of venues) {
      const result = await pool.query(
        `INSERT INTO venues (name, city, country, address, latitude, longitude, website_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [venue.name, venue.city, venue.country, venue.address, venue.lat, venue.lon, venue.website]
      );

      if (result.rows.length > 0) {
        const venueId = result.rows[0].id;

        // Add scraping source for each venue
        await pool.query(
          `INSERT INTO scraping_sources (venue_id, source_url, source_type)
           VALUES ($1, $2, 'website')
           ON CONFLICT DO NOTHING`,
          [venueId, venue.website]
        );

        console.log(`  ✓ Added ${venue.name}`);
      }
    }

    console.log('✅ Initial venues added successfully');
    console.log('\n🎉 Database setup complete!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();

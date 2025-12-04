import pool from '../database/db.js';
import fetch from 'node-fetch';
import { scrapeExhibitionsWithGPT } from '../scrapers/gptParser.js';

/**
 * Add venues for a city using Google Places API and index them
 */
export async function addCityAndIndex(cityName) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        throw new Error('Google Maps API key not configured');
    }

    console.log(`\n🏙️  Adding venues for ${cityName}...`);

    // Search for museums and galleries in the city
    // Max 5 museums + 10 galleries = 15 venues per city
    const types = [
        { type: 'museum', limit: 5 },
        { type: 'art_gallery', limit: 10 }
    ];

    let totalVenuesAdded = 0;
    let totalExhibitionsFound = 0;
    const addedVenues = [];
    const failedVenues = [];

    for (const { type, limit } of types) {
        try {
            // Text search for venues
            const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(type + ' in ' + cityName)}&key=${apiKey}`;
            const searchResponse = await fetch(searchUrl);
            const searchData = await searchResponse.json();

            if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
                console.error(`Google Places API error for ${type}:`, searchData.status);
                continue;
            }

            const places = searchData.results.slice(0, limit);

            for (const place of places) {
                try {
                    // Get place details
                    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,geometry,website&key=${apiKey}`;
                    const detailsResponse = await fetch(detailsUrl);
                    const detailsData = await detailsResponse.json();

                    if (detailsData.status !== 'OK') {
                        console.error(`Failed to get details for ${place.name}`);
                        continue;
                    }

                    const details = detailsData.result;
                    const website = details.website || '';

                    // Skip if no website
                    if (!website) {
                        console.log(`⏭️  Skipping ${details.name} (no website)`);
                        continue;
                    }

                    // Extract country from address
                    const addressParts = details.formatted_address.split(',');
                    const country = addressParts[addressParts.length - 1].trim();

                    // Check if venue already exists
                    const existingVenue = await pool.query(
                        `SELECT id FROM venues WHERE name = $1 OR website_url = $2`,
                        [details.name, website]
                    );

                    let venueId;

                    if (existingVenue.rows.length > 0) {
                        venueId = existingVenue.rows[0].id;
                        console.log(`✓ ${details.name} already exists`);
                    } else {
                        // Insert venue
                        const venueResult = await pool.query(
                            `INSERT INTO venues (name, city, country, address, latitude, longitude, website_url, created_at)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                             RETURNING id`,
                            [
                                details.name,
                                cityName,
                                country,
                                details.formatted_address,
                                details.geometry.location.lat,
                                details.geometry.location.lng,
                                website
                            ]
                        );

                        venueId = venueResult.rows[0].id;
                        totalVenuesAdded++;
                        console.log(`✅ Added ${details.name}`);
                    }

                    // Check if scraping source exists
                    const existingSource = await pool.query(
                        `SELECT id FROM scraping_sources WHERE venue_id = $1`,
                        [venueId]
                    );

                    let sourceId;

                    if (existingSource.rows.length > 0) {
                        sourceId = existingSource.rows[0].id;
                    } else {
                        // Add scraping source
                        const sourceResult = await pool.query(
                            `INSERT INTO scraping_sources (venue_id, source_url, source_type, is_active, created_at)
                             VALUES ($1, $2, 'website', true, NOW())
                             RETURNING id`,
                            [venueId, website]
                        );

                        sourceId = sourceResult.rows[0].id;
                    }

                    // Index exhibitions for this venue
                    console.log(`🔍 Indexing ${details.name}...`);

                    try {
                        const exhibitions = await scrapeExhibitionsWithGPT(website);

                        // Delete old exhibitions for this venue
                        await pool.query(`DELETE FROM exhibitions WHERE venue_id = $1`, [venueId]);

                        // Insert new exhibitions
                        for (const exhibition of exhibitions) {
                            await pool.query(
                                `INSERT INTO exhibitions (venue_id, title, artist, description, start_date, end_date, image_url, exhibition_url, last_scraped_at)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                                [
                                    venueId,
                                    exhibition.title,
                                    exhibition.artist || null,
                                    exhibition.description || null,
                                    exhibition.start_date || null,
                                    exhibition.end_date || null,
                                    exhibition.image_url || null,
                                    exhibition.exhibition_url || website
                                ]
                            );
                        }

                        totalExhibitionsFound += exhibitions.length;

                        // Update scraping source timestamp
                        await pool.query(
                            `UPDATE scraping_sources SET last_scraped_at = NOW() WHERE id = $1`,
                            [sourceId]
                        );

                        // Log success
                        await pool.query(
                            `INSERT INTO scraping_logs (source_id, status, exhibitions_found)
                             VALUES ($1, 'success', $2)`,
                            [sourceId, exhibitions.length]
                        );

                        console.log(`✅ Found ${exhibitions.length} exhibitions for ${details.name}`);

                        addedVenues.push({
                            name: details.name,
                            exhibitions_found: exhibitions.length
                        });

                    } catch (scrapeError) {
                        console.error(`❌ Failed to scrape ${details.name}:`, scrapeError.message);

                        // Log failure
                        await pool.query(
                            `INSERT INTO scraping_logs (source_id, status, exhibitions_found, error_message)
                             VALUES ($1, 'failed', 0, $2)`,
                            [sourceId, scrapeError.message]
                        );

                        failedVenues.push({
                            name: details.name,
                            error: scrapeError.message
                        });
                    }

                    // Rate limiting - wait 2 seconds between requests
                    await new Promise(resolve => setTimeout(resolve, 2000));

                } catch (error) {
                    console.error(`❌ Error processing ${place.name}:`, error.message);
                }
            }

        } catch (error) {
            console.error(`Error searching for ${type}:`, error.message);
        }
    }

    console.log(`\n✅ City indexing complete!`);
    console.log(`   Venues added: ${totalVenuesAdded}`);
    console.log(`   Exhibitions found: ${totalExhibitionsFound}`);
    if (failedVenues.length > 0) {
        console.log(`   Failed venues: ${failedVenues.length}\n`);
    }

    return {
        city: cityName,
        venues_added: totalVenuesAdded,
        exhibitions_found: totalExhibitionsFound,
        venues: addedVenues,
        failed_venues: failedVenues
    };
}

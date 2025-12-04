-- Museums and Galleries
CREATE TABLE IF NOT EXISTS venues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(50) NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    website_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exhibitions
CREATE TABLE IF NOT EXISTS exhibitions (
    id SERIAL PRIMARY KEY,
    venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    artist VARCHAR(255),
    description TEXT,
    start_date DATE,
    end_date DATE,
    exhibition_url TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_scraped_at TIMESTAMP
);

-- Scraping Sources (URLs to index)
CREATE TABLE IF NOT EXISTS scraping_sources (
    id SERIAL PRIMARY KEY,
    venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    source_type VARCHAR(50) DEFAULT 'website', -- 'website', 'api', 'rss'
    is_active BOOLEAN DEFAULT true,
    last_scraped_at TIMESTAMP,
    scrape_frequency_hours INTEGER DEFAULT 24,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scraping Logs
CREATE TABLE IF NOT EXISTS scraping_logs (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES scraping_sources(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'partial'
    exhibitions_found INTEGER DEFAULT 0,
    error_message TEXT,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exhibitions_venue ON exhibitions(venue_id);
CREATE INDEX IF NOT EXISTS idx_exhibitions_dates ON exhibitions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_venues_location ON venues(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(city);
CREATE INDEX IF NOT EXISTS idx_venues_country ON venues(country);

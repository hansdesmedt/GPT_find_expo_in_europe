import fetch from 'node-fetch';

/**
 * Geocode an address using Google Maps Geocoding API
 * Falls back to OpenStreetMap Nominatim if Google API key is not set
 */
export async function geocodeAddress(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (apiKey && apiKey.trim() !== '') {
    return geocodeWithGoogle(address, apiKey);
  } else {
    console.warn('⚠️ Google Maps API key not set, using OpenStreetMap Nominatim');
    return geocodeWithOSM(address);
  }
}

async function geocodeWithGoogle(address, apiKey) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
        formatted_address: data.results[0].formatted_address
      };
    } else {
      console.error(`Geocoding failed for "${address}": ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error('Google Geocoding error:', error);
    return null;
  }
}

async function geocodeWithOSM(address) {
  try {
    // OpenStreetMap Nominatim - free but rate limited (1 req/sec)
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ExpoFinderEurope/1.0'
      }
    });
    const data = await response.json();

    if (data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        formatted_address: data[0].display_name
      };
    } else {
      console.error(`OSM Geocoding failed for "${address}"`);
      return null;
    }
  } catch (error) {
    console.error('OSM Geocoding error:', error);
    return null;
  }
}

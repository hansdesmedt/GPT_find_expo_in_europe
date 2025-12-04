import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

/**
 * Fetch and parse a museum/gallery website using GPT
 * to extract exhibition information
 */
export async function scrapeExhibitionsWithGPT(url) {
  try {
    console.log(`🔍 Scraping ${url}...`);

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ExpoFinderBot/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Parse with jsdom to get clean HTML
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Remove script, style, and navigation elements
    document.querySelectorAll('script, style, nav, header, footer').forEach(el => el.remove());

    // Get the main content (prioritize main, article, or body)
    const mainContent = document.querySelector('main, article, .content, #content, body');
    const cleanHtml = mainContent ? mainContent.innerHTML : document.body.innerHTML;

    // Truncate to avoid token limits (roughly 8000 tokens = 32000 chars)
    const truncatedHtml = cleanHtml.substring(0, 32000);

    // Use GPT to parse exhibitions
    const exhibitions = await parseWithGPT(truncatedHtml, url);

    return exhibitions;
  } catch (error) {
    console.error(`❌ Scraping failed for ${url}:`, error.message);
    throw error;
  }
}

async function parseWithGPT(htmlText, sourceUrl) {
  const apiKey = process.env.CHATITP_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL;

  if (!apiKey || !baseUrl) {
    throw new Error('OpenAI API credentials not configured');
  }

  const prompt = `You are an expert at extracting art exhibition information from museum and gallery websites.

Analyze the following webpage content and extract ALL current and upcoming exhibitions.

For each exhibition, extract:
- title: The exhibition title
- artist: Artist name(s) if mentioned
- start_date: Start date in YYYY-MM-DD format (or null if not found)
- end_date: End date in YYYY-MM-DD format (or null if not found)
- description: Brief description (max 200 chars)
- image_url: URL of the main exhibition image (full URL, or null if not found)
- exhibition_url: Direct link to the exhibition page (use the source URL if no specific link found)

Return ONLY a valid JSON array of exhibitions. If no exhibitions found, return an empty array [].

Example format:
[
  {
    "title": "Impressionism Today",
    "artist": "Claude Monet",
    "start_date": "2024-01-15",
    "end_date": "2024-04-30",
    "description": "A retrospective of Monet's water lilies series",
    "image_url": "https://example.com/images/monet-exhibition.jpg",
    "exhibition_url": "https://example.com/exhibitions/monet"
  }
]

Website content:
${htmlText}

Source URL: ${sourceUrl}

Return only the JSON array, no other text.`;

  try {
    const response = await fetch(`${baseUrl}v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts structured data from text. You always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GPT API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();

    // Strip markdown code blocks if present (```json ... ```)
    if (content.startsWith('```')) {
      // Remove opening ```json or ```
      content = content.replace(/^```(?:json)?\n?/, '');
      // Remove closing ```
      content = content.replace(/\n?```$/, '');
      content = content.trim();
    }

    // Parse JSON response
    const exhibitions = JSON.parse(content);

    console.log(`✅ Found ${exhibitions.length} exhibitions`);
    return exhibitions;
  } catch (error) {
    console.error('❌ GPT parsing error:', error.message);
    return [];
  }
}

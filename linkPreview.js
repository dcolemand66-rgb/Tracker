// Fetches a URL's raw HTML and pulls preview data out of its <title> and
// standard <meta> tags (Open Graph first, falling back to the plain
// description meta). Same "fetch as text + regex" approach as
// recipeImport.js — React Native has no DOM to query, and unlike a
// browser's fetch, RN's isn't subject to CORS, so this can hit most
// sites directly without a proxy.

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeHtmlEntities(str) {
  return String(str)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name) => NAMED_ENTITIES[name]);
}

function metaContent(html, attr, key) {
  // Handles both attribute orders: <meta property="x" content="y"> and
  // <meta content="y" property="x">.
  const re1 = new RegExp(`<meta[^>]*${attr}=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decodeHtmlEntities(m[1]).trim() : '';
}

function resolveUrl(maybeRelative, baseUrl) {
  if (!maybeRelative) return '';
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch (e) {
    return maybeRelative;
  }
}

// Returns { title, description, image } — any field can come back empty
// if the page doesn't provide it. Throws if the page itself can't be
// fetched at all (network error, non-2xx status).
export async function fetchLinkPreview(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    },
  });
  if (!res.ok) {
    throw new Error(`Couldn't load that page (${res.status})`);
  }
  const html = await res.text();

  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleTagMatch ? decodeHtmlEntities(titleTagMatch[1]).trim() : '';

  const title = metaContent(html, 'property', 'og:title') || rawTitle;
  const description =
    metaContent(html, 'property', 'og:description') || metaContent(html, 'name', 'description');
  const rawImage = metaContent(html, 'property', 'og:image') || metaContent(html, 'name', 'twitter:image');
  const image = resolveUrl(rawImage, url);

  return { title, description, image };
}

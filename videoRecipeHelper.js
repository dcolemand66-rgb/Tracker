// Helpers for "recipes that live in a video, not text" - most recipes
// people actually save come from a YouTube video or a Facebook Reel, and
// retyping every step by hand from a video is exactly what this avoids.
// A recipe can now be just a title + a video link: no ingredients, no
// notes required. The video itself IS the instructions.

// Pulls a YouTube video id out of any of the URL shapes people actually
// paste: watch?v=, youtu.be/, /shorts/, /embed/, with or without extra
// query params (playlist position, timestamp, etc).
export function extractYouTubeId(url) {
  const u = (url || '').trim();
  if (!u) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([A-Za-z0-9_-]{6,})/,
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const re of patterns) {
    const m = u.match(re);
    if (m) return m[1];
  }
  return null;
}

export function isYouTubeUrl(url) {
  return /youtube\.com|youtu\.be/i.test(url || '');
}

export function isFacebookUrl(url) {
  return /facebook\.com|fb\.watch/i.test(url || '');
}

export function isTikTokUrl(url) {
  return /tiktok\.com/i.test(url || '');
}

export function isInstagramUrl(url) {
  return /instagram\.com/i.test(url || '');
}

// What kind of link this is, for picking how to show it in the detail
// screen (embedded player vs. a plain "open" button).
export function videoPlatform(url) {
  if (isYouTubeUrl(url)) return 'youtube';
  if (isFacebookUrl(url)) return 'facebook';
  if (isTikTokUrl(url)) return 'tiktok';
  if (isInstagramUrl(url)) return 'instagram';
  return url ? 'other' : null;
}

// YouTube's oEmbed endpoint needs no API key and no auth - it's the
// quickest way to pull a real title + thumbnail just from the link, so
// adding a video recipe can be "paste link, done" instead of typing a
// title by hand. Facebook/TikTok/Instagram don't offer an equivalent
// unauthenticated endpoint, so those just keep whatever title/photo the
// person types - the function returns null and the caller falls back
// to manual entry.
export async function fetchVideoOEmbed(url) {
  const clean = (url || '').trim();
  if (!clean) return null;
  if (!isYouTubeUrl(clean)) return null;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(clean)}&format=json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const id = extractYouTubeId(clean);
    return {
      title: data.title || '',
      // thumbnail_url from oEmbed is often a low-res default (120x90);
      // the maxres/hq thumbnail from the standard img path looks much
      // better in the recipe list/detail hero image.
      image: id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : data.thumbnail_url || null,
    };
  } catch (e) {
    return null;
  }
}

export function videoPlatformLabel(platform) {
  switch (platform) {
    case 'youtube':
      return 'YouTube';
    case 'facebook':
      return 'Facebook';
    case 'tiktok':
      return 'TikTok';
    case 'instagram':
      return 'Instagram';
    default:
      return 'Video';
  }
}

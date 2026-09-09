// Idleon Efficiency mirrors a public player's account save to a JSON file
// at a predictable CDN URL, keyed by the username in their profile
// subdomain (the same subdomain the AutoReviewBot and Idleon Efficiency
// site itself read from). That's a plain, unauthenticated GET - no
// scraping or private API involved - so it's the one piece of real
// account data we can safely pull in from here, versus the fully
// client-rendered dashboard pages which need their own JS engine to
// render and aren't fetchable at all.
//
// The full save format is a sprawling, versioned internal game-variable
// dump (thousands of keys) that only a dedicated calculation engine like
// idleonefficiency.com's own can meaningfully interpret. What we extract
// here is deliberately narrow and stable: each character's name, class,
// and combat level - the same handful of fields every 3rd-party Idleon
// tool agrees on the meaning of.

// classes_dict from the game's own ClassNames table (index -> display
// name), trimmed to the 41 real class slots (the rest of ClassNames is
// skill names and internal filler entries).
const CLASS_NAMES = {
  0: '—',
  1: 'Beginner',
  2: 'Journeyman',
  3: 'Maestro',
  4: 'Voidwalker',
  5: 'Infinilyte',
  6: 'Rage Basics',
  7: 'Warrior',
  8: 'Barbarian',
  9: 'Squire',
  10: 'Blood Berserker',
  11: 'Divine Knight',
  12: 'Divine Knight',
  13: 'Death Bringer',
  14: 'Death Bringer',
  15: 'Filler',
  16: 'Royal Guardian',
  17: 'Filler',
  18: 'Calm Basics',
  19: 'Archer',
  20: 'Bowman',
  21: 'Hunter',
  22: 'Siege Breaker',
  23: 'Siege Breaker',
  24: 'Siege Breaker',
  25: 'Beast Master',
  26: 'Filler',
  27: 'Filler',
  28: 'Filler',
  29: 'Wind Walker',
  30: 'Savvy Basics',
  31: 'Mage',
  32: 'Wizard',
  33: 'Shaman',
  34: 'Elemental Sorcerer',
  35: 'Spiritual Monk',
  36: 'Bubonic Conjuror',
  37: 'Bubonic Conjuror',
  38: 'Filler',
  39: 'Filler',
  40: 'Arcane Cultist',
};

function safeLoads(v) {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch (e) {
    return v;
  }
}

// Pulls the profile subdomain (e.g. "demarcus1234") out of any
// idleonefficiency.com URL, so a saved account link can drive the sync
// without the user having to type their username separately.
export function usernameFromProfileUrl(url) {
  const m = (url || '').match(/^https?:\/\/([a-z0-9-]+)\.idleonefficiency\.com/i);
  if (!m) return '';
  const sub = m[1].toLowerCase();
  return sub === 'www' ? '' : sub;
}

function extractCharacterNames(json) {
  if (Array.isArray(json.playerNames)) return json.playerNames;
  if (Array.isArray(json.charNames)) return json.charNames;
  if (Array.isArray(json.PlayerNames)) return json.PlayerNames;
  const cog = safeLoads(json.CogO);
  if (Array.isArray(cog)) {
    return cog.filter((x) => typeof x === 'string' && x.startsWith('Player_')).map((x) => x.slice(7));
  }
  return [];
}

// Returns { characters: [{ name, className, level }], fetchedAt }.
// Throws with a readable message on any failure (network, 404 for a
// profile that isn't public, or a shape we don't recognize).
export async function fetchIdleonProfile(username) {
  const clean = (username || '').trim().toLowerCase();
  if (!clean) throw new Error('No Idleon Efficiency username to sync from.');
  const res = await fetch(`https://cdn2.idleonefficiency.com/profiles/${clean}.json`);
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? `No public profile found for "${clean}" - make sure the account is set to public on Idleon Efficiency.`
        : `Couldn't load that profile (${res.status}).`
    );
  }
  const json = await res.json();
  const names = extractCharacterNames(json);
  if (!names.length) {
    throw new Error("That profile didn't include a character list - it may be in an unexpected format.");
  }
  const characters = names.map((name, i) => {
    const classNum = Number(safeLoads(json[`CharacterClass_${i}`]));
    const className = CLASS_NAMES[classNum] || 'Unknown';
    const lv0 = safeLoads(json[`Lv0_${i}`]);
    const level = Array.isArray(lv0) && lv0.length ? Number(lv0[0]) || 0 : null;
    return { name, className, level };
  });
  return { characters, fetchedAt: Date.now() };
}

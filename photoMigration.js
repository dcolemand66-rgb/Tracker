import { Directory, File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { base64ToUint8Array } from './base64Decode';

// One-time cleanup for photos saved before pickCompressedImage started
// writing to disk instead of embedding base64. Those old photos are
// still sitting in the loaded data as multi-hundred-KB
// `data:image/...;base64,...` strings - exactly what was driving the
// app's OutOfMemoryError crashes - so this walks the whole loaded
// payload once, converts every one it finds into a real file, and
// replaces the string with that file's short file:// URI in place.
//
// Runs once (gated by MIGRATION_FLAG_KEY below) since re-walking the
// entire data tree on every launch would cost time for no benefit once
// nothing base64 is left to find.

const MIGRATION_FLAG_KEY = 'tracker_photo_migration_v1_done';
const PHOTOS_DIR = new Directory(Paths.document, 'photos');

function ensurePhotosDir() {
  if (!PHOTOS_DIR.exists) {
    PHOTOS_DIR.create({ intermediates: true });
  }
}

function extForMime(mime) {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

const DATA_URI_RE = /^data:image\/([a-zA-Z0-9.+-]+);base64,([\s\S]*)$/;

// Converts one string if it's a base64 image data URI; anything else is
// returned unchanged. A single photo that fails to convert is left as
// base64 (rather than losing it or aborting the whole migration) - it
// will simply be tried again on the next launch.
async function migrateOneValue(value) {
  const match = value.match(DATA_URI_RE);
  if (!match) return value;
  const [, mime, base64] = match;
  try {
    ensurePhotosDir();
    const bytes = base64ToUint8Array(base64);
    const filename = `migrated_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extForMime(mime)}`;
    const file = new File(PHOTOS_DIR, filename);
    file.create();
    await file.write(bytes);
    return file.uri;
  } catch (e) {
    return value;
  }
}

// Walks the tree in place (no full clone, to keep the migration itself
// memory-light) converting every embedded base64 photo it finds.
async function walk(node) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const v = node[i];
      if (typeof v === 'string') {
        if (v.startsWith('data:image/')) node[i] = await migrateOneValue(v);
      } else if (v && typeof v === 'object') {
        await walk(v);
      }
    }
  } else if (node && typeof node === 'object') {
    for (const key in node) {
      const v = node[key];
      if (typeof v === 'string') {
        if (v.startsWith('data:image/')) node[key] = await migrateOneValue(v);
      } else if (v && typeof v === 'object') {
        await walk(v);
      }
    }
  }
}

// Mutates `payload` in place, converting any base64 photos found
// anywhere in it to files. Safe to call every launch - it no-ops
// quickly once the one-time migration flag is set.
export async function migrateBase64PhotosToFiles(payload) {
  if (!payload || typeof payload !== 'object') return;
  const already = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
  if (already === '1') return;

  await walk(payload);

  await AsyncStorage.setItem(MIGRATION_FLAG_KEY, '1');
}


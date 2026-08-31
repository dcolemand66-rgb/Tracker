import { File } from 'expo-file-system';

// Photos are saved locally as real files (see imagePicker.js), with
// only the short file:// path held in app state and pushed to the
// cloud backup. That's fine for autosaving locally, but it means the
// cloud backup never actually contained the picture - only a path
// that happens to resolve on the device that saved it. Reset the app,
// restore on a different device, or reinstall, and every one of those
// paths points at a folder that no longer exists: the cover art (or
// recipe photo, or anything else picked as an image) just doesn't
// load, even though the backup "restored successfully."
//
// This walks a payload right before it's pushed to the cloud and
// inlines every local photo as a base64 data URI instead - the actual
// picture travels with the backup this time. The existing chunked
// Firestore backup (firebaseSync.js) already splits arbitrarily large
// JSON across many small documents specifically so it isn't capped by
// a single 1MB doc, so this doesn't reintroduce the size problem that
// base64 photos caused before that chunking existed.
//
// Non-mutating on purpose: this returns a NEW payload for the cloud
// push. The original `payload` (and the file:// paths inside it) is
// left completely untouched, since it's also what's used for the
// local save on this same call.

function extFromUri(uri) {
  const m = /\.([a-zA-Z0-9]+)(\?.*)?$/.exec(uri);
  return (m && m[1].toLowerCase()) || 'jpg';
}

function mimeForExt(ext) {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

async function inlineOneValue(uri) {
  try {
    const file = new File(uri);
    if (!file.exists) return uri; // nothing to read - leave the path as-is
    const base64 = await file.base64();
    const mime = mimeForExt(extFromUri(uri));
    return `data:${mime};base64,${base64}`;
  } catch (e) {
    // Best-effort - this one photo stays as a local path for this
    // backup rather than failing the whole push.
    return uri;
  }
}

function isLocalPhotoPath(v) {
  return typeof v === 'string' && v.startsWith('file://') && v.includes('/photos/');
}

async function walk(node) {
  if (Array.isArray(node)) {
    return Promise.all(node.map(walk));
  }
  if (node && typeof node === 'object') {
    const keys = Object.keys(node);
    const resolved = await Promise.all(keys.map((k) => walk(node[k])));
    const out = {};
    keys.forEach((k, i) => {
      out[k] = resolved[i];
    });
    return out;
  }
  if (isLocalPhotoPath(node)) {
    return inlineOneValue(node);
  }
  return node;
}

// Returns a new payload with every local photo path replaced by its
// base64 data URI. Anything that isn't a local photo path (already a
// remote URL, plain text, numbers, etc.) is returned unchanged.
export async function inlinePhotosForCloud(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  return walk(payload);
}

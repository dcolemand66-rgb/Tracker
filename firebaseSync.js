import { getAuth, GoogleAuthProvider, signInWithCredential, signOut } from '@react-native-firebase/auth';
import { toFirestoreFields, parseFirestoreDoc } from './firestoreSync';

// Migrated to the modular API (React Native Firebase v22+). The old
// namespaced style this used before - `auth.GoogleAuthProvider`,
// `auth().signInWithCredential(...)`, `firestore().collection(...)` -
// is what caused "Cannot read property GoogleAuthProvider of
// undefined": at v22+, GoogleAuthProvider is its own top-level export,
// not a property attached to the default `auth` import, and the two
// API styles can't be mixed - auth and firestore both had to move
// together, not one at a time.

// Exchanges the Google tokens (already obtained via
// @react-native-google-signin/google-signin) for a real Firebase Auth
// session, so Firestore's security rules can recognize this user via
// request.auth.uid. Firebase's *native* Android auth module (unlike the
// plain web SDK) requires both idToken and accessToken together, even
// though Firebase's own docs list accessToken as optional.
export async function signInToFirebaseWithGoogle(idToken, accessToken) {
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  const result = await signInWithCredential(getAuth(), credential);
  return result.user.uid;
}

export async function signOutOfFirebase() {
  try {
    await signOut(getAuth());
  } catch (e) {
    // ignore — local state gets cleared regardless
  }
}

export function currentFirebaseUid() {
  return getAuth().currentUser?.uid || null;
}

// --- Cloud backup ---
//
// This used to go through the native Firestore SDK (getFirestore(),
// writeBatch(), etc.), but that SDK keeps every pending write in a
// local SQLite-backed mutation queue, and has to decode that queue
// back into memory - potentially several pending batches at once -
// whenever writes get acknowledged. That decode step is what was
// crashing the app with OutOfMemoryError, even after chunking the
// payload and grouping chunks into small batches: writeBatch.commit()
// only guarantees *local* queuing order, not network pacing, so on a
// slow connection several batches could still pile up in that queue
// before any of them were acknowledged.
//
// Talking to Firestore's plain REST API instead sidesteps that local
// queue entirely - each request is just an ordinary awaited fetch()
// with nothing persisted or replayed by a native SDK afterward, so
// there is no mutation queue for Firestore to ever have to decode in
// bulk.
const PROJECT_ID = 'tracker-c4aad';

function firestoreDocUrl(path) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
}

async function getIdToken() {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not signed in.');
  return user.getIdToken();
}

// One authenticated Firestore REST call. `fields`/`updateMaskFields`
// are only used for PATCH (write) requests. A 404/NOT_FOUND is treated
// as a normal "doesn't exist yet" result rather than an error, since
// that's expected the first time a user backs up or for chunk indices
// that were never written.
async function firestoreRequest(path, { method = 'GET', fields, updateMaskFields } = {}) {
  const idToken = await getIdToken();
  let url = firestoreDocUrl(path);
  if (updateMaskFields && updateMaskFields.length) {
    url += `?${updateMaskFields.map((f) => `updateMask.fieldPaths=${f}`).join('&')}`;
  }
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: fields ? JSON.stringify({ fields: toFirestoreFields(fields) }) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (json && json.error) {
    if (json.error.status === 'NOT_FOUND') return null;
    throw new Error(json.error.message || 'Firestore request failed');
  }
  return json;
}

// Firestore caps a single document at ~1MB, and (on Android) the local
// SQLite CursorWindow used by Firestore's own offline cache can crash
// natively even before that if one document/row gets too large. Rather
// than uploading photos to Cloud Storage (which Google now requires a
// paid Blaze plan to use), the backup is instead split across many
// small documents in a `chunks` subcollection - each one safely under
// the limit - which stays entirely on Firestore's free Spark plan.
const CHUNK_SIZE = 350 * 1024; // characters per chunk document, comfortably under the 1MB doc cap
const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // sanity ceiling so a runaway payload fails loudly instead of writing hundreds of docs

function chunkDocPath(uid, i) {
  return `trackerBackups/${uid}/chunks/${i}`;
}
function manifestDocPath(uid) {
  return `trackerBackups/${uid}`;
}

// Pushes the full app data payload to this user's backup, overwriting
// whatever was there before. The payload is JSON-stringified once and
// sliced into fixed-size chunks, each written with its own independent
// REST request - one at a time, awaited in sequence, so at most one
// chunk's worth of data is ever in flight. The manifest is only
// updated - pointing readers at the new chunk count - after every
// chunk has been written successfully, so a failure partway through
// never leaves the manifest referencing an incomplete backup. Any
// leftover chunks from a previously LARGER backup are deleted last,
// once the new manifest is safely in place.
export async function pushBackupToCloud(payload) {
  const uid = currentFirebaseUid();
  if (!uid) throw new Error('Not signed in.');

  const json = JSON.stringify(payload);
  if (json.length > MAX_TOTAL_BYTES) {
    const err = new Error(
      `Backup too large to sync to the cloud (${(json.length / 1024 / 1024).toFixed(1)}MB, limit ~${(MAX_TOTAL_BYTES / 1024 / 1024).toFixed(0)}MB). Everything is still saved locally - it just can't sync until the data is smaller (usually means removing some photos).`
    );
    err.isPayloadTooLarge = true;
    throw err;
  }

  const chunkCount = Math.max(1, Math.ceil(json.length / CHUNK_SIZE));

  // Need the previous chunk count so a backup that SHRANK (e.g. photos
  // removed) doesn't leave stale trailing chunk documents behind.
  const prevManifest = await firestoreRequest(manifestDocPath(uid));
  const prevChunkCount = prevManifest?.fields ? parseFirestoreDoc(prevManifest.fields).chunkCount || 0 : 0;

  for (let i = 0; i < chunkCount; i++) {
    const chunkData = json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await firestoreRequest(chunkDocPath(uid, i), {
      method: 'PATCH',
      fields: { data: chunkData },
      updateMaskFields: ['data'],
    });
  }

  await firestoreRequest(manifestDocPath(uid), {
    method: 'PATCH',
    fields: { chunkCount, updatedAt: new Date().toISOString() },
    updateMaskFields: ['chunkCount', 'updatedAt'],
  });

  for (let i = chunkCount; i < prevChunkCount; i++) {
    await firestoreRequest(chunkDocPath(uid, i), { method: 'DELETE' });
  }
}

// Pulls this user's backup, reassembling it from its chunk documents.
// Returns null if nothing's been synced yet. Chunks are fetched one at
// a time in sequence (not Promise.all) so at most one chunk's response
// is being parsed and held in memory at once, rather than every chunk
// of a large backup arriving and being decoded together.
export async function pullBackupFromCloud() {
  const uid = currentFirebaseUid();
  if (!uid) throw new Error('Not signed in.');

  const manifestRaw = await firestoreRequest(manifestDocPath(uid));
  if (!manifestRaw || !manifestRaw.fields) return null;
  const manifestData = parseFirestoreDoc(manifestRaw.fields);
  const chunkCount = manifestData?.chunkCount || 0;

  if (chunkCount === 0) {
    // Backwards compatibility: backups written before the chunked-
    // storage migration stored the full payload directly under a
    // `data` field on this same manifest document, with no
    // chunkCount at all. Treating that as "no backup" would silently
    // throw away a perfectly good pre-migration backup - read it the
    // old way instead.
    if (manifestData && manifestData.data) {
      return manifestData.data;
    }
    return null;
  }

  let json = '';
  for (let i = 0; i < chunkCount; i++) {
    const chunkRaw = await firestoreRequest(chunkDocPath(uid, i));
    const chunkData = chunkRaw && chunkRaw.fields ? parseFirestoreDoc(chunkRaw.fields).data : '';
    json += chunkData || '';
  }

  try {
    return JSON.parse(json);
  } catch (e) {
    throw new Error('Cloud backup is corrupted or incomplete - try syncing again from a device with the full data.');
  }
}


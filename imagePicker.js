import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';

// Photos used to come back as full base64 data URIs, which meant every
// photo lived on as a multi-hundred-KB text blob sitting directly inside
// the app's JSON state - re-stringified on every autosave, re-uploaded
// whole on every cloud backup, and held in memory for as long as the
// screen using it stayed mounted. That's what was driving the app's
// OutOfMemoryError crashes: both inside Firestore's own backup-write
// code, and in plain unrelated network calls that failed simply because
// the heap was already nearly full from everything else.
//
// Photos are now saved to a real file on disk instead, and only the
// short file:// path - never the image data itself - is what gets held
// in state, written to AsyncStorage, or pushed to the cloud backup.
// React Native's <Image> component renders a file:// URI exactly the
// same way it rendered a data: URI, so nothing else has to change for
// every screen that already stores `image` as a plain string to benefit.
//
// Note: this only affects photos picked from now on. Photos already
// saved as base64 stay as base64 until something separately migrates
// them - this stops the bleeding going forward rather than shrinking
// what's already stored.
const PHOTOS_DIR = new Directory(Paths.document, 'photos');

function ensurePhotosDir() {
  if (!PHOTOS_DIR.exists) {
    PHOTOS_DIR.create({ intermediates: true });
  }
}

// Picks a photo, resizes it to a sane max dimension, and saves the result
// as a permanent file under the app's documents directory - returning a
// file:// URI rather than a base64 data URI.
export async function pickCompressedImage(maxDim = 900, quality = 0.72) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    return { error: 'permission' };
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
  });
  if (result.canceled || !result.assets || !result.assets[0]) {
    return { canceled: true };
  }
  const manipulated = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: maxDim } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );

  ensurePhotosDir();
  const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const destFile = new File(PHOTOS_DIR, filename);
  new File(manipulated.uri).copy(destFile);

  return { uri: destFile.uri };
}



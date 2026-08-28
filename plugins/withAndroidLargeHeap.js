const { withAndroidManifest } = require('expo/config-plugins');

// The app has been hitting OutOfMemoryError crashes against Android's
// default 256MB per-app heap growth limit - both inside Firestore's
// native SDK (decoding a backup write) and in plain OkHttp network
// calls, which only happen because the heap is already nearly full at
// that point. The single biggest thing pushing memory usage up is
// photos: the Settings screen's own storage breakdown shows they're
// kept as raw image data in the JS bundle/state rather than as links
// (Restaurants and its menu items especially), so decoded bitmaps and
// base64 strings for many photos can be resident in memory at once
// during normal use.
//
// `android:largeHeap="true"` asks Android for a bigger per-app heap
// (device-dependent, but commonly 2-4x the default). It doesn't fix
// the underlying memory usage, but it gives the app meaningfully more
// room before hitting the same wall again, and is the standard flag
// Android itself recommends for photo-heavy apps like this one.
module.exports = function withAndroidLargeHeap(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:largeHeap'] = 'true';
    }
    return config;
  });
};


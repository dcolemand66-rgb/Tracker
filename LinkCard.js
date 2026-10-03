import React, { useRef, useState } from 'react';
import { Animated, View, Text, TouchableOpacity, Image, StyleSheet, Linking, Alert, ActivityIndicator } from 'react-native';
import { GOLD, INK, DIM, CARD, BORDER, ROSE } from './theme';

// A saved link shown as a real 3D flip card. The front is JUST the
// photo (or a fallback icon) - no title, no url, nothing else - so it
// reads as a picture, not a list row. Tapping the card anywhere flips
// it to the back, which holds everything: title, url (tap to open),
// description, notes, and the Edit/Delete/Preview actions. No separate
// flip button or long-press needed on either face - a plain tap always
// flips, since opening the link now lives on the back as its own row.
//
// Driven by rotateY + perspective for a real 3D turn rather than a
// scaleX squish. Both faces stay mounted and opacity-crossfade at the
// 90-degree midpoint (when the card is edge-on) instead of relying on
// backfaceVisibility, which is unreliable on Android.
export default function LinkCard({ link, onEdit, onDelete, onBackfillPreview, backfilling }) {
  const rotation = useRef(new Animated.Value(0)).current; // 0 = front, 1 = back
  const [flipped, setFlipped] = useState(false);

  function toggleFlip() {
    Animated.timing(rotation, {
      toValue: flipped ? 0 : 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    setFlipped((f) => !f);
  }

  function openLink() {
    Linking.openURL(link.url).catch(() => Alert.alert("Couldn't open that link"));
  }

  const frontRotateY = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotateY = rotation.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  // Each face crossfades out/in right as it goes edge-on (around the
  // 90-degree midpoint), so neither face is visibly readable while
  // sideways, without depending on backfaceVisibility to hide it.
  const frontOpacity = rotation.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity = rotation.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [0, 0, 1, 1] });

  return (
    <View style={styles.cardWrap}>
      <Animated.View
        style={[
          styles.face,
          styles.frontFace,
          { opacity: frontOpacity, transform: [{ perspective: 1000 }, { rotateY: frontRotateY }] },
        ]}
        pointerEvents={flipped ? 'none' : 'auto'}
      >
        <TouchableOpacity activeOpacity={0.85} onPress={toggleFlip} style={styles.photoTouchable}>
          {link.image ? (
            <Image source={{ uri: link.image }} style={styles.photo} />
          ) : (
            <View style={styles.photoFallback}>
              <Text style={{ fontSize: 34 }}>🌐</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[
          styles.face,
          styles.backFace,
          { opacity: backOpacity, transform: [{ perspective: 1000 }, { rotateY: backRotateY }] },
        ]}
        pointerEvents={flipped ? 'auto' : 'none'}
      >
        <TouchableOpacity activeOpacity={1} onPress={toggleFlip} style={styles.back}>
          <Text style={styles.backTitle} numberOfLines={1}>{link.title}</Text>
          <TouchableOpacity onPress={openLink} style={styles.urlRow}>
            <Text style={styles.url} numberOfLines={1}>{link.url}</Text>
            <Text style={styles.urlOpenHint}>Open ↗</Text>
          </TouchableOpacity>
          {link.description ? (
            <Text style={styles.description} numberOfLines={3}>{link.description}</Text>
          ) : null}
          {link.notes ? <Text style={styles.notes} numberOfLines={2}>{link.notes}</Text> : null}
          <View style={styles.backActions}>
            {!link.image && onBackfillPreview ? (
              backfilling ? (
                <ActivityIndicator color={GOLD} size="small" style={{ marginRight: 16 }} />
              ) : (
                <TouchableOpacity onPress={() => onBackfillPreview(link)} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>Get Preview</Text>
                </TouchableOpacity>
              )
            ) : null}
            {onEdit ? (
              <TouchableOpacity onPress={() => onEdit(link)} style={styles.backBtn}>
                <Text style={styles.backBtnText}>Edit</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => onDelete(link.id)} style={styles.backBtn}>
              <Text style={[styles.backBtnText, { color: ROSE }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: { marginBottom: 12, minHeight: 140 },
  face: {
    minHeight: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    overflow: 'hidden',
  },
  frontFace: {},
  backFace: { position: 'absolute', top: 0, left: 0, right: 0 },
  photoTouchable: { flex: 1 },
  photo: { width: '100%', height: '100%', minHeight: 140, backgroundColor: '#1f1a15' },
  photoFallback: {
    width: '100%',
    height: '100%',
    minHeight: 140,
    backgroundColor: '#1f1a15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { padding: 14 },
  backTitle: { color: INK, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  url: { color: GOLD, fontSize: 12, flex: 1, marginRight: 8 },
  urlOpenHint: { color: GOLD, fontSize: 11, fontWeight: '700' },
  description: { color: DIM, fontSize: 12, marginTop: 3, lineHeight: 16 },
  notes: { color: DIM, fontSize: 12, marginTop: 3, fontStyle: 'italic' },
  backActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  backBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  backBtnText: { color: INK, fontSize: 13, fontWeight: '700' },
});

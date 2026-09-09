import React, { useRef, useState } from 'react';
import { Animated, View, Text, TouchableOpacity, Image, StyleSheet, Linking, Alert, ActivityIndicator } from 'react-native';
import { GOLD, INK, DIM, CARD, BORDER, ROSE } from './theme';

// A saved link shown as a card: tap opens the URL, long-press flips it
// over to reveal Edit/Delete/Preview actions on the back - same idea as
// a flashcard, so the front stays purely a preview and never gets
// crowded with action buttons.
//
// The flip is done as a scaleX squish-and-release (1 -> 0 -> 1), with
// the front/back content swapped at the exact midpoint when the card is
// edge-on and invisible - not a 3D rotateY. rotateY + backfaceVisibility
// looks right on iOS but backfaceVisibility is unreliable on Android, so
// both faces stay visible and overlap instead of hiding - this way works
// the same on both platforms since nothing depends on backface hiding.
export default function LinkCard({ link, onEdit, onDelete, onBackfillPreview, backfilling }) {
  const scaleX = useRef(new Animated.Value(1)).current;
  const [flipped, setFlipped] = useState(false);

  function toggleFlip() {
    Animated.sequence([
      Animated.timing(scaleX, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(scaleX, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
    // Swap the visible face right as the card goes edge-on, so the
    // change happens while it's invisible instead of as a visible pop.
    setTimeout(() => setFlipped((f) => !f), 140);
  }

  function handleFrontPress() {
    Linking.openURL(link.url).catch(() => Alert.alert("Couldn't open that link"));
  }

  return (
    <Animated.View style={[styles.face, { transform: [{ scaleX }] }]}>
      {!flipped ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleFrontPress}
          onLongPress={toggleFlip}
          style={styles.cardTouchable}
        >
          {link.image ? (
            <Image source={{ uri: link.image }} style={styles.thumb} />
          ) : (
            <View style={styles.thumbFallback}>
              <Text style={{ fontSize: 22 }}>🌐</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title} numberOfLines={1}>{link.title}</Text>
            <Text style={styles.url} numberOfLines={1}>{link.url}</Text>
            {link.description ? (
              <Text style={styles.description} numberOfLines={2}>{link.description}</Text>
            ) : null}
            {link.notes ? <Text style={styles.notes} numberOfLines={2}>{link.notes}</Text> : null}
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.back}>
          <Text style={styles.backTitle} numberOfLines={1}>{link.title}</Text>
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
          <TouchableOpacity onPress={toggleFlip} style={{ marginTop: 12 }}>
            <Text style={styles.flipBackHint}>Tap here to flip back</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  face: {
    marginBottom: 12,
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    padding: 12,
    justifyContent: 'center',
  },
  cardTouchable: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#1f1a15' },
  thumbFallback: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#1f1a15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: INK, fontSize: 15, fontWeight: '700' },
  url: { color: GOLD, fontSize: 12, marginTop: 2 },
  description: { color: DIM, fontSize: 12, marginTop: 3, lineHeight: 16 },
  notes: { color: DIM, fontSize: 12, marginTop: 3, fontStyle: 'italic' },
  back: { alignItems: 'center' },
  backTitle: { color: INK, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  backActions: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  backBtnText: { color: INK, fontSize: 13, fontWeight: '700' },
  flipBackHint: { color: DIM, fontSize: 11 },
});

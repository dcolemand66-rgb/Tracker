import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GOLD, INK, DIM, CARD, BORDER } from './theme';
import { MOODS } from './consistencyEngine';

// Shown right before a difficulty-enabled habit's session starts. Picking
// a mood doesn't just get logged - it's passed straight into
// getSessionDifficulty() so the session that's about to open already
// knows today's effective level.
export default function MoodCheckIn({ visible, habitText, onSelect, onCancel }) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <LinearGradient
            colors={['#1a1512', '#0c0a0a']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.title}>How's this one feeling?</Text>
          <Text style={styles.subtitle}>{habitText ? `Before you start ${habitText}` : 'Before you start'}</Text>
          <View style={styles.grid}>
            {MOODS.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={styles.moodBtn}
                activeOpacity={0.8}
                onPress={() => onSelect(m.key)}
              >
                <Text style={styles.emoji}>{m.emoji}</Text>
                <Text style={styles.moodLabel}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  sheet: {
    width: '84%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    overflow: 'hidden',
  },
  title: { color: INK, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: DIM, fontSize: 12.5, textAlign: 'center', marginTop: 4, marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  moodBtn: {
    width: '47%',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  emoji: { fontSize: 26, marginBottom: 6 },
  moodLabel: { color: INK, fontSize: 12.5, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  cancelText: { color: DIM, fontSize: 13, fontWeight: '600' },
});

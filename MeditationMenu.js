import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import MeditationBackdrop from './MeditationBackdrop';
import { MEDITATION_STYLES, meditationStyleById, styleLevelLabel } from './meditationStyles';
import { MEDITATION_BACKGROUNDS, meditationBackgroundById } from './meditationBackgrounds';
import { AMBIENT_SOUNDS } from './meditationSounds';

// "Rather than jumping to [one method], I have a menu where I can select
// the meditation type, style, background and sounds" — the whole point
// being you're not locked into one form regardless of mood. Picked once
// here, fresh every time a session starts (not a fixed per-habit
// setting), with whatever was picked last pre-selected as a convenience
// default via `initial`.
export default function MeditationMenu({ levelIndex, initial, onBegin, onClose }) {
  const [styleId, setStyleId] = useState(initial?.styleId || 'breathing');
  const [backgroundId, setBackgroundId] = useState(initial?.backgroundId || 'shoreline');
  const [soundId, setSoundId] = useState(initial?.soundId || 'ocean');
  const [voiceOn, setVoiceOn] = useState(initial?.voiceOn !== false);

  const theme = meditationBackgroundById(backgroundId);
  const style = meditationStyleById(styleId);

  return (
    <MeditationBackdrop theme={theme}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Meditation</Text>
        <Text style={styles.subtitle}>However you're feeling right now, pick what fits.</Text>

        <Text style={styles.sectionLabel}>STYLE</Text>
        <View style={styles.styleGrid}>
          {MEDITATION_STYLES.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.styleCard, styleId === s.id && styles.styleCardSel]}
              onPress={() => setStyleId(s.id)}
            >
              <Text style={styles.styleIcon}>{s.icon}</Text>
              <Text style={styles.styleLabel}>{s.label}</Text>
              <Text style={styles.styleTagline}>{s.tagline}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.styleDescription}>{style.description}</Text>
        <Text style={styles.levelNote}>Today: {styleLevelLabel(styleId, levelIndex)}</Text>

        <Text style={styles.sectionLabel}>BACKGROUND</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bgRow}
        >
          {MEDITATION_BACKGROUNDS.map((b) => (
            <TouchableOpacity
              key={b.id}
              style={[
                styles.bgSwatch,
                { borderColor: b.glowColor },
                backgroundId === b.id && { backgroundColor: b.glowColor + '33' },
              ]}
              onPress={() => setBackgroundId(b.id)}
            >
              <Text style={styles.bgIcon}>{b.icon}</Text>
              <Text style={styles.bgLabel}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.bgVibe}>{theme.vibe}</Text>

        <Text style={styles.sectionLabel}>SOUND</Text>
        <View style={styles.soundRow}>
          {AMBIENT_SOUNDS.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.soundChip, soundId === s.id && styles.soundChipSel]}
              onPress={() => setSoundId(s.id)}
            >
              <Text style={[styles.soundChipText, soundId === s.id && styles.soundChipTextSel]}>
                {s.icon} {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.voiceToggle, voiceOn && styles.voiceToggleOn]}
          onPress={() => setVoiceOn((v) => !v)}
        >
          <View style={[styles.voiceDot, voiceOn && styles.voiceDotOn]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.voiceToggleText}>Guided voice</Text>
            <Text style={styles.voiceToggleSub}>Spoken cues through the session, on-device</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.beginBtn}
          onPress={() => onBegin({ styleId, backgroundId, soundId, voiceOn })}
        >
          <Text style={styles.beginBtnText}>Begin</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Not now</Text>
        </TouchableOpacity>
      </ScrollView>
    </MeditationBackdrop>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: {
    color: '#e5edf3',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 22,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 4,
  },
  styleGrid: { flexDirection: 'row', gap: 10 },
  styleCard: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1.3,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  styleCardSel: { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.14)' },
  styleIcon: { fontSize: 26, marginBottom: 6 },
  styleLabel: { color: '#fff', fontSize: 12.5, fontWeight: '800', textAlign: 'center' },
  styleTagline: { color: '#cfd7de', fontSize: 9.5, textAlign: 'center', marginTop: 3, lineHeight: 12.5 },
  styleDescription: {
    color: '#dbe3ea',
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 14,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  levelNote: { color: 'rgba(255,255,255,0.65)', fontSize: 11.5, marginTop: 6, marginBottom: 6, fontWeight: '700' },
  bgRow: { paddingVertical: 4, gap: 10 },
  bgSwatch: {
    width: 86,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.3,
    marginRight: 2,
  },
  bgIcon: { fontSize: 22, marginBottom: 5 },
  bgLabel: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  bgVibe: {
    color: '#cfd7de',
    fontSize: 11.5,
    fontStyle: 'italic',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  soundRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  soundChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1.3,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  soundChipSel: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: '#fff' },
  soundChipText: { color: '#dbe3ea', fontSize: 12.5, fontWeight: '700' },
  soundChipTextSel: { color: '#fff' },
  voiceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1.3,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    padding: 12,
  },
  voiceToggleOn: { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.14)' },
  voiceDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.3,
    borderColor: 'rgba(255,255,255,0.4)',
    marginRight: 12,
  },
  voiceDotOn: { backgroundColor: '#fff', borderColor: '#fff' },
  voiceToggleText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  voiceToggleSub: { color: '#cfd7de', fontSize: 10.5, marginTop: 2 },
  beginBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 26,
  },
  beginBtnText: { color: '#1a1512', fontSize: 16, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
});

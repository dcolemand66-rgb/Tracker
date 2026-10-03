import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Animated, Easing, TouchableOpacity, StyleSheet } from 'react-native';
import MeditationBackdrop from './MeditationBackdrop';
import AmbientSoundPlayer from './AmbientSoundPlayer';
import { ambientSoundById } from './meditationSounds';
import { bodyScanLevelSpec, BODY_SCAN_REGIONS } from './meditationStyles';
import {
  speak,
  stopSpeaking,
  BODY_SCAN_LINES,
  BODY_SCAN_INTRO_CUE,
  BODY_SCAN_DONE_CUE,
} from './meditationVoice';

const SETTLE_SECONDS = 6;

// Body scan: a slow guided pass of attention through the body, one
// region at a time — "minimal pacing, mostly about listening and
// noticing, not breath counting" (meditationStyles.js), so unlike the
// other two styles there's no breathing animation to sync to. The
// earned level decides total minutes, split evenly across the 9
// regions; a settle moment up front before the first region.
// Phases: intro -> settle -> active -> done
export default function BodyScanSession({ settings, levelIndex = 0, background, soundId, voiceOn, onComplete }) {
  const spec = bodyScanLevelSpec(levelIndex);
  const totalSeconds = spec.minutes * 60;
  const regionCount = BODY_SCAN_REGIONS.length;
  const perRegionSeconds = Math.max(6, Math.round(totalSeconds / regionCount));
  const soundOn = settings?.soundOn !== false;
  const sound = ambientSoundById(soundId);

  const [phase, setPhase] = useState('intro');
  const [regionIndex, setRegionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(perRegionSeconds);

  const breathe = useRef(new Animated.Value(0)).current;
  const tickRef = useRef(null);
  const stepTimeoutRef = useRef(null);

  // A gentle, slow pulse independent of any breathing pace — just
  // enough movement that the scene doesn't feel frozen while attention
  // rests on one region for a while.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (phase !== 'settle') return;
    if (voiceOn) speak(BODY_SCAN_INTRO_CUE);
    setSecondsLeft(SETTLE_SECONDS);
    tickRef.current = setInterval(() => setSecondsLeft((s) => (s > 1 ? s - 1 : 1)), 1000);
    stepTimeoutRef.current = setTimeout(() => {
      clearInterval(tickRef.current);
      setRegionIndex(0);
      setPhase('active');
    }, SETTLE_SECONDS * 1000);
    return () => {
      clearInterval(tickRef.current);
      clearTimeout(stepTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== 'active') return;
    let cancelled = false;

    function runRegion(i) {
      if (cancelled) return;
      if (i >= regionCount) {
        if (voiceOn) speak(BODY_SCAN_DONE_CUE);
        setPhase('done');
        return;
      }
      setRegionIndex(i);
      setSecondsLeft(perRegionSeconds);
      if (voiceOn) speak(BODY_SCAN_LINES[i]);

      clearInterval(tickRef.current);
      tickRef.current = setInterval(() => {
        setSecondsLeft((s) => (s > 1 ? s - 1 : 1));
      }, 1000);

      stepTimeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        clearInterval(tickRef.current);
        runRegion(i + 1);
      }, perRegionSeconds * 1000);
    }

    runRegion(0);
    return () => {
      cancelled = true;
      clearInterval(tickRef.current);
      clearTimeout(stepTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === 'done') onComplete(totalSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => stopSpeaking, []);

  const glowScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.08] });
  const isSessionPhase = phase === 'settle' || phase === 'active';

  return (
    <MeditationBackdrop theme={background}>
      <AmbientSoundPlayer asset={sound.asset} playing={soundOn && isSessionPhase} />

      {phase === 'intro' && (
        <View style={styles.center}>
          <Text style={styles.introTitle}>Body Scan</Text>
          <Text style={styles.introText}>
            {spec.minutes} minutes, guided attention moving slowly through {regionCount}{' '}
            regions of the body. No pacing to keep up with — just listen and notice.
          </Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeLabel}>LEVEL {spec.level + 1}</Text>
            <Text style={styles.levelBadgeSpec}>{spec.minutes} min</Text>
          </View>
          <TouchableOpacity style={styles.bigBtn} onPress={() => setPhase('settle')}>
            <Text style={styles.bigBtnText}>Begin</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'settle' && (
        <View style={styles.center}>
          <Animated.View style={[styles.settleOrb, { transform: [{ scale: glowScale }] }]} />
          <Text style={styles.introText}>Get comfortable, and close your eyes if that feels right.</Text>
          <Text style={styles.holdTimer}>{secondsLeft}</Text>
        </View>
      )}

      {phase === 'active' && (
        <View style={styles.center}>
          <Text style={styles.phaseLabel}>
            Region {regionIndex + 1} of {regionCount}
          </Text>
          <Animated.View style={[styles.settleOrb, { transform: [{ scale: glowScale }] }]} />
          <Text style={styles.regionTitle}>{BODY_SCAN_REGIONS[regionIndex]}</Text>
          <Text style={styles.regionLine}>{BODY_SCAN_LINES[regionIndex]}</Text>
          <Text style={styles.holdTimer}>{secondsLeft}</Text>
          <View style={styles.dotsRow}>
            {BODY_SCAN_REGIONS.map((_, i) => (
              <View key={i} style={[styles.dot, i <= regionIndex && styles.dotFilled]} />
            ))}
          </View>
        </View>
      )}

      {phase === 'done' && (
        <View style={styles.center}>
          <Text style={styles.introTitle}>Nice work 🧘</Text>
          <Text style={styles.introText}>{spec.minutes} minutes complete. Slowly bring your attention back to the room.</Text>
        </View>
      )}
    </MeditationBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  introTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  introText: {
    color: '#e5edf3',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  levelBadge: {
    backgroundColor: 'rgba(90,180,230,0.18)',
    borderWidth: 1,
    borderColor: '#5ab4e6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 18,
  },
  levelBadgeLabel: { color: '#dff3ff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  levelBadgeSpec: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 4 },
  bigBtn: { backgroundColor: '#d9a441', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, marginTop: 10, alignSelf: 'center' },
  bigBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  phaseLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 18,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
    textAlign: 'center',
  },
  settleOrb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: 20,
  },
  regionTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  regionLine: {
    color: '#e5edf3',
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  holdTimer: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 10, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  dotsRow: { flexDirection: 'row', gap: 7, marginTop: 20 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotFilled: { backgroundColor: '#fff' },
});

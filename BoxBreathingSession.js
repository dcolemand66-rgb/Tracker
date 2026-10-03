import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Animated, Easing, TouchableOpacity, StyleSheet } from 'react-native';
import MeditationBackdrop from './MeditationBackdrop';
import AmbientSoundPlayer from './AmbientSoundPlayer';
import { ambientSoundById } from './meditationSounds';
import { boxLevelSpec } from './meditationStyles';
import { speak, stopSpeaking, BOX_PHASE_CUE, BOX_DONE_CUE } from './meditationVoice';

const PHASES = ['inhale', 'holdIn', 'exhale', 'holdOut'];
const PHASE_LABEL = { inhale: 'Inhale', holdIn: 'Hold', exhale: 'Exhale', holdOut: 'Hold' };
const SQUARE = 200;
const HALF = SQUARE / 2;

// Box breathing: four equal sides — inhale, hold, exhale, hold — with a
// dot tracing the square so the eye has something steady to follow.
// Slower and steadier than circular breathing, repeated for `cycles`
// cycles (earned level decides how many, same unified leveling as the
// other styles — see meditationStyles.js).
// Phases: intro -> active -> done
export default function BoxBreathingSession({ settings, levelIndex = 0, background, soundId, voiceOn, onComplete }) {
  const spec = boxLevelSpec(levelIndex);
  const totalCycles = spec.cycles;
  const stepSeconds = spec.secondsPerSide;
  const soundOn = settings?.soundOn !== false;
  const sound = ambientSoundById(soundId);

  const [phase, setPhase] = useState('intro');
  const [cycle, setCycle] = useState(1);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(stepSeconds);

  const dot = useRef(new Animated.Value(0)).current;
  const tickRef = useRef(null);
  const stepTimeoutRef = useRef(null);

  useEffect(() => {
    if (phase !== 'active') return;
    let cancelled = false;

    function runStep(c, pIdx) {
      if (cancelled) return;
      if (c > totalCycles) {
        if (voiceOn) speak(BOX_DONE_CUE);
        setPhase('done');
        return;
      }
      setCycle(c);
      setPhaseIndex(pIdx);
      setSecondsLeft(stepSeconds);
      const phaseName = PHASES[pIdx];
      if (voiceOn) speak(BOX_PHASE_CUE[phaseName]);

      dot.setValue(0);
      Animated.timing(dot, {
        toValue: 1,
        duration: stepSeconds * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();

      clearInterval(tickRef.current);
      tickRef.current = setInterval(() => {
        setSecondsLeft((s) => (s > 1 ? s - 1 : 1));
      }, 1000);

      stepTimeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        clearInterval(tickRef.current);
        const nextPIdx = (pIdx + 1) % PHASES.length;
        const nextCycle = nextPIdx === 0 ? c + 1 : c;
        runStep(nextCycle, nextPIdx);
      }, stepSeconds * 1000);
    }

    runStep(1, 0);
    return () => {
      cancelled = true;
      clearInterval(tickRef.current);
      clearTimeout(stepTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === 'done') onComplete(totalCycles * stepSeconds * 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => stopSpeaking, []);

  const phaseName = PHASES[phaseIndex];
  let dotStyle;
  if (phaseName === 'inhale') {
    dotStyle = {
      transform: [
        { translateX: dot.interpolate({ inputRange: [0, 1], outputRange: [-HALF, HALF] }) },
        { translateY: -HALF },
      ],
    };
  } else if (phaseName === 'holdIn') {
    dotStyle = {
      transform: [
        { translateX: HALF },
        { translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [-HALF, HALF] }) },
      ],
    };
  } else if (phaseName === 'exhale') {
    dotStyle = {
      transform: [
        { translateX: dot.interpolate({ inputRange: [0, 1], outputRange: [HALF, -HALF] }) },
        { translateY: HALF },
      ],
    };
  } else {
    dotStyle = {
      transform: [
        { translateX: -HALF },
        { translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [HALF, -HALF] }) },
      ],
    };
  }

  const isSessionPhase = phase === 'active';

  return (
    <MeditationBackdrop theme={background}>
      <AmbientSoundPlayer asset={sound.asset} playing={soundOn && isSessionPhase} />

      {phase === 'intro' && (
        <View style={styles.center}>
          <Text style={styles.introTitle}>Box Breathing</Text>
          <Text style={styles.introText}>
            {totalCycles} cycles of {stepSeconds}-second inhale, hold, exhale, hold. Slow
            and steady — good for settling nerves or refocusing before something
            stressful.
          </Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeLabel}>LEVEL {spec.level + 1}</Text>
            <Text style={styles.levelBadgeSpec}>{totalCycles} cycles</Text>
          </View>
          <TouchableOpacity
            style={styles.bigBtn}
            onPress={() => {
              setCycle(1);
              setPhaseIndex(0);
              setPhase('active');
            }}
          >
            <Text style={styles.bigBtnText}>Begin</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'active' && (
        <View style={styles.center}>
          <Text style={styles.phaseLabel}>
            Cycle {cycle} of {totalCycles}
          </Text>
          <View style={styles.squareWrap}>
            <View style={styles.square} />
            <Animated.View style={[styles.dot, dotStyle]} />
          </View>
          <Text style={styles.breathWord}>{PHASE_LABEL[phaseName]}</Text>
          <Text style={styles.holdTimer}>{secondsLeft}</Text>
        </View>
      )}

      {phase === 'done' && (
        <View style={styles.center}>
          <Text style={styles.introTitle}>Nice work 🧘</Text>
          <Text style={styles.introText}>{totalCycles} cycles complete. Notice how you feel.</Text>
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
    marginBottom: 24,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
    textAlign: 'center',
  },
  squareWrap: { width: SQUARE, height: SQUARE, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  square: {
    position: 'absolute',
    width: SQUARE,
    height: SQUARE,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 10,
  },
  dot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
  breathWord: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 6, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  holdTimer: { color: '#fff', fontSize: 40, fontWeight: '800', marginTop: 8, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
});

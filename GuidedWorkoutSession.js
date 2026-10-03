import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { GOLD, INK, DIM, CARD, BORDER } from './theme';

// Bodyweight-only + dumbbell programs. Each block is either rep-based
// (you tap when you finish the set) or time-based (counts itself down),
// followed by a rest period. Names match the seeded exercise library so
// completed sessions log against real exercises.
//
// Built from workoutTracks.js: real progressions (cross-referenced
// across multiple beginner push-up/squat guides, not just one source),
// one exercise at a time - start at 1 rep, grow by 1 every session,
// 100 cumulative reps unlocks the next variation or the next exercise.
import {
  defaultUnlockedPatterns,
  normalizeExerciseState,
  exerciseBlock,
  growAllExercises,
  currentStage,
} from './workoutTracks';

// overrides: { [exerciseName]: number } - a custom target for any block
// by name, for the rare case the default number doesn't fit.
//
// Builds today's session from whatever's actually unlocked so far - see
// workoutTracks.js: one exercise at a time, each growing by 1 rep every
// session, unlocking the next variation (or next pattern) once its
// cumulative total hits 100. Nothing here decides WHICH exercises show
// up; it just renders whatever habit.unlockedPatterns says, always 1 set.
export function buildWorkoutTemplate(habit) {
  const stateMap = normalizeExerciseState(habit.exerciseState);
  const overrides = habit.exerciseOverrides || {};
  const unlocked = habit.unlockedPatterns && habit.unlockedPatterns.length ? habit.unlockedPatterns : defaultUnlockedPatterns();

  function applyOverride(b) {
    const ov = overrides[b.name];
    if (ov == null || Number.isNaN(Number(ov))) return b;
    return b.mode === 'time' ? { ...b, seconds: Number(ov) } : { ...b, target: Number(ov) };
  }

  const blocks = unlocked.map((key) => applyOverride(exerciseBlock(key, stateMap[key])));

  return {
    template: {
      id: 'daily_session',
      name: "Today's Session",
      rounds: 1,
      restBetweenRounds: 20,
      blocks,
    },
  };
}

// Applies growth + the 100-rep unlock rule to every currently-unlocked
// exercise after a completed session. entries: the raw entries from
// GuidedWorkoutSession's onComplete result (one per exercise, since
// rounds is always 1 here).
export function evaluateAllTracks(habit, entries) {
  const unlocked = habit.unlockedPatterns && habit.unlockedPatterns.length ? habit.unlockedPatterns : defaultUnlockedPatterns();
  const valuesByKey = {};
  unlocked.forEach((key) => {
    const stateMap = normalizeExerciseState(habit.exerciseState);
    const stage = currentStage(key, stateMap[key].stageIndex);
    const entry = entries.find((e) => e.name === stage.name);
    valuesByKey[key] = entry ? entry.value : 0;
  });

  const { exerciseState, unlockedPatterns, events, patternToUnlock } = growAllExercises(habit, valuesByKey);
  return { exerciseState, unlockedPatterns, events, patternToUnlock };
}

const READY_SECONDS = 5;

function fmt(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}`;
}

// Phases: intro -> ready -> work -> rest -> roundRest -> done
// sessionDifficulty (optional): { effectiveLevel: 1-10, tier, trend, mood, moodLabel, ... }
// from consistencyEngine.getSessionDifficulty(), already folding in both
// this habit's rolling consistency AND the mood picked right before this
// session opened. Currently unused here on purpose - the workout content
// itself is still the fixed `template` passed in. TODO (content phase):
// once there's an actual pool of workouts/exercises to pick from, use
// sessionDifficulty.effectiveLevel to choose a harder or easier variant,
// or to unlock a new exercise, instead of always running `template`.
export default function GuidedWorkoutSession({ template, onComplete, onExit, sessionDifficulty }) {
  const [phase, setPhase] = useState('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [blockIndex, setBlockIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [repsDone, setRepsDone] = useState(0);
  const entriesRef = useRef([]);
  const tickRef = useRef(null);

  const blocks = template.blocks;
  const block = blocks[blockIndex];
  const isLastBlock = blockIndex >= blocks.length - 1;
  const isLastRound = roundIndex >= template.rounds - 1;

  const isTimedPhase =
    phase === 'ready' ||
    phase === 'rest' ||
    phase === 'roundRest' ||
    (phase === 'work' && block && block.mode === 'time');

  // One shared countdown driver for every timed phase, so there is only
  // ever a single interval alive and no chance of two timers racing.
  useEffect(() => {
    if (!isTimedPhase) return;
    tickRef.current = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(tickRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, blockIndex, roundIndex, isTimedPhase]);

  // Advancing lives in its own effect rather than inside the setTimeLeft
  // updater above: calling a phase transition from within a state
  // updater is the same anti-pattern that crashed the video player, so
  // the clock only ever decrements and this reacts to it hitting zero.
  useEffect(() => {
    if (!isTimedPhase || timeLeft !== 0) return;
    advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, isTimedPhase]);

  function startSession() {
    entriesRef.current = [];
    setRoundIndex(0);
    setBlockIndex(0);
    setTimeLeft(READY_SECONDS);
    setPhase('ready');
  }

  function beginBlock(bi) {
    const b = blocks[bi];
    setBlockIndex(bi);
    setRepsDone(b.mode === 'reps' ? b.target : 0);
    setTimeLeft(b.mode === 'time' ? b.seconds : 0);
    setPhase('work');
  }

  // Called when the current phase's clock runs out.
  function advance() {
    if (phase === 'ready') {
      beginBlock(0);
      return;
    }
    if (phase === 'work') {
      recordBlock(block.mode === 'time' ? block.seconds : repsDone);
      setTimeLeft(block.rest);
      setPhase('rest');
      return;
    }
    if (phase === 'rest') {
      if (!isLastBlock) {
        beginBlock(blockIndex + 1);
      } else if (!isLastRound) {
        setTimeLeft(template.restBetweenRounds);
        setPhase('roundRest');
      } else {
        setPhase('done');
      }
      return;
    }
    if (phase === 'roundRest') {
      setRoundIndex((r) => r + 1);
      beginBlock(0);
    }
  }

  function recordBlock(value) {
    entriesRef.current = [
      ...entriesRef.current,
      {
        name: block.name,
        mode: block.mode,
        value,
        round: roundIndex + 1,
      },
    ];
  }

  // Rep sets finish on your tap rather than a timer.
  function finishRepSet() {
    clearInterval(tickRef.current);
    recordBlock(repsDone);
    setTimeLeft(block.rest);
    setPhase('rest');
  }

  function skipRest() {
    clearInterval(tickRef.current);
    if (phase === 'rest') {
      if (!isLastBlock) beginBlock(blockIndex + 1);
      else if (!isLastRound) {
        setTimeLeft(template.restBetweenRounds);
        setPhase('roundRest');
      } else setPhase('done');
    } else if (phase === 'roundRest') {
      setRoundIndex((r) => r + 1);
      beginBlock(0);
    }
  }

  useEffect(() => {
    if (phase === 'done') {
      onComplete({
        templateName: template.name,
        rounds: template.rounds,
        entries: entriesRef.current,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const nextUp =
    phase === 'rest'
      ? isLastBlock
        ? isLastRound
          ? 'Finish'
          : `Set ${roundIndex + 2}`
        : blocks[blockIndex + 1].name
      : null;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.exitBtn} onPress={onExit}>
        <Text style={styles.exitBtnText}>✕</Text>
      </TouchableOpacity>

      {phase === 'intro' && (
        <ScrollView contentContainerStyle={styles.introScroll}>
          <Text style={styles.title}>{template.name}</Text>
          <Text style={styles.subtitle}>
            {blocks.length} exercise{blocks.length === 1 ? '' : 's'} • bodyweight + dumbbells
          </Text>
          {blocks.map((b, i) => (
            <View key={i} style={styles.previewRow}>
              <Text style={styles.previewName}>{b.name}</Text>
              <Text style={styles.previewTarget}>
                {b.mode === 'time' ? `${b.seconds}s` : `${b.target} reps`}
              </Text>
            </View>
          ))}
          <TouchableOpacity style={styles.bigBtn} onPress={startSession}>
            <Text style={styles.bigBtnText}>Start</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {phase === 'ready' && (
        <View style={styles.center}>
          <Text style={styles.phaseLabel}>Get ready</Text>
          <Text style={styles.bigTimer}>{timeLeft}</Text>
          <Text style={styles.upNext}>First up: {blocks[0].name}</Text>
        </View>
      )}

      {phase === 'work' && (
        <View style={styles.center}>
          <Text style={styles.phaseLabel}>
            Exercise {blockIndex + 1} of {blocks.length}
          </Text>
          <Text style={styles.exerciseName}>{block.name}</Text>

          {block.mode === 'time' ? (
            <Text style={styles.bigTimer}>{fmt(timeLeft)}</Text>
          ) : (
            <>
              <Text style={styles.bigTimer}>{repsDone}</Text>
              <View style={styles.repRow}>
                <TouchableOpacity
                  style={styles.repBtn}
                  onPress={() => setRepsDone((r) => Math.max(0, r - 1))}
                >
                  <Text style={styles.repBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.repTarget}>target {block.target}</Text>
                <TouchableOpacity style={styles.repBtn} onPress={() => setRepsDone((r) => r + 1)}>
                  <Text style={styles.repBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <Text style={styles.cue}>{block.cue}</Text>

          {block.mode === 'reps' ? (
            <TouchableOpacity style={styles.bigBtn} onPress={finishRepSet}>
              <Text style={styles.bigBtnText}>Set Done</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {(phase === 'rest' || phase === 'roundRest') && (
        <View style={styles.center}>
          <Text style={styles.phaseLabel}>
            {phase === 'roundRest' ? 'Set complete — rest' : 'Rest'}
          </Text>
          <Text style={styles.bigTimer}>{fmt(timeLeft)}</Text>
          {nextUp ? <Text style={styles.upNext}>Next: {nextUp}</Text> : null}
          {phase === 'roundRest' ? (
            <Text style={styles.upNext}>Next: Set {roundIndex + 2}</Text>
          ) : null}
          <TouchableOpacity style={[styles.bigBtn, styles.bigBtnAlt]} onPress={skipRest}>
            <Text style={[styles.bigBtnText, styles.bigBtnTextAlt]}>Skip Rest</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'done' && (
        <ScrollView contentContainerStyle={styles.introScroll}>
          <Text style={styles.title}>Session complete 💪</Text>
          <Text style={styles.subtitle}>Today's exercise logged.</Text>
          <Text style={[styles.previewName, { marginBottom: 10 }]}>Completion</Text>
          {entriesRef.current.map((e, i) => {
            const b = blocks.find((bl) => bl.name === e.name);
            const target = b ? (b.mode === 'time' ? b.seconds : b.target) : null;
            const hit = target != null && e.value >= target;
            return (
              <View key={i} style={styles.previewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewName}>{e.name}</Text>
                  <Text style={styles.completionSub}>
                    {e.mode === 'time' ? `${e.value}s held` : `${e.value} reps`}
                    {target != null ? ` (target ${target}${e.mode === 'time' ? 's' : ''})` : ''}
                  </Text>
                </View>
                <Text style={hit ? styles.completionHit : styles.completionMiss}>
                  {target == null ? '—' : hit ? '✓ Hit' : '↓ Under'}
                </Text>
              </View>
            );
          })}
          <TouchableOpacity style={[styles.bigBtn, { marginTop: 20 }]} onPress={onExit}>
            <Text style={styles.bigBtnText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0d141c' },
  exitBtn: {
    position: 'absolute',
    top: 44,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitBtnText: { color: '#fff', fontSize: 18 },
  introScroll: { padding: 24, paddingTop: 90 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: DIM, fontSize: 14, textAlign: 'center', marginBottom: 20 },
  rampNote: { color: GOLD, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: -12, marginBottom: 20 },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  previewName: { color: INK, fontSize: 15, fontWeight: '600', flex: 1 },
  previewTarget: { color: GOLD, fontSize: 14, fontWeight: '700' },
  completionSub: { color: DIM, fontSize: 12, marginTop: 2 },
  completionHit: { color: '#5fd57a', fontSize: 13, fontWeight: '800', marginLeft: 10 },
  completionMiss: { color: '#e0a940', fontSize: 13, fontWeight: '800', marginLeft: 10 },
  completionMid: { color: DIM, fontSize: 13, fontWeight: '700', marginLeft: 10 },
  phaseLabel: {
    color: DIM,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 14,
  },
  exerciseName: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  bigTimer: { color: '#fff', fontSize: 76, fontWeight: '800', marginBottom: 8 },
  repRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 6 },
  repBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repBtnText: { color: INK, fontSize: 26, fontWeight: '700' },
  repTarget: { color: DIM, fontSize: 13, fontWeight: '600', minWidth: 80, textAlign: 'center' },
  cue: { color: '#c9d0d8', fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 12 },
  upNext: { color: GOLD, fontSize: 15, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  bigBtn: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 36,
    marginTop: 24,
    alignSelf: 'center',
  },
  bigBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  bigBtnAlt: { backgroundColor: 'transparent', borderWidth: 1, borderColor: GOLD },
  bigBtnTextAlt: { color: GOLD },
});


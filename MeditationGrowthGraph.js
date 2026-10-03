import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { GOLD, CARD, INK, DIM, BORDER } from './theme';
import { habitDoneOn, habitStreak, habitTotalCompletions, localDateKey } from './habitUtils';

const DAYS_BACK = 28;
const GRID_COLS = 7;

function formatMetric(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m <= 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// "For now my growth" — one combined view rather than separate graphs
// per style, since a session logged under any of the three styles still
// counts toward the same streak and history. Two parts: a 28-day
// activity grid (did I show up, day by day) and a bar sparkline of
// recent session lengths (am I doing more each time), both built from
// plain Views since there's no charting library in this app yet.
export default function MeditationGrowthGraph({ habit }) {
  // Explicit pixel sizing, not percent width + aspectRatio together —
  // in a flexWrap row those two combined resolve to height 0 (a real
  // Yoga layout bug hit and fixed the same way in TrackerCard.js).
  const { width: winWidth } = useWindowDimensions();
  // 20px each side from the detail sheet itself, 16px each side from
  // this card's own padding — both subtracted so cells actually fit.
  const OUTER_H_PADDING = 20 + 20;
  const CARD_H_PADDING = 16 + 16;
  const GRID_GAP = 5;
  const cellSize =
    (winWidth - OUTER_H_PADDING - CARD_H_PADDING - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

  if (!habit) return null;

  const streak = habitStreak(habit);
  const total = habitTotalCompletions(habit);
  const level = (habit.meditationLevel || 0) + 1;

  const days = [];
  const cursor = new Date();
  for (let i = DAYS_BACK - 1; i >= 0; i--) {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() - i);
    const key = localDateKey(d);
    days.push({ key, done: habitDoneOn(habit, key), isToday: i === 0 });
  }

  const history = (habit.breathHoldHistory || []).slice(0, 10).slice().reverse();
  const maxMetric = history.length ? Math.max(...history.map((h) => h.seconds), 1) : 1;

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Growth</Text>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>Day streak</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{level}</Text>
          <Text style={styles.statLabel}>Level</Text>
        </View>
      </View>

      <Text style={styles.subheading}>Last 28 days</Text>
      <View style={styles.grid}>
        {days.map((d) => (
          <View
            key={d.key}
            style={[
              styles.cell,
              { width: cellSize, height: cellSize },
              d.done && styles.cellDone,
              d.isToday && styles.cellToday,
            ]}
          />
        ))}
      </View>

      {history.length > 0 ? (
        <>
          <Text style={styles.subheading}>Recent sessions</Text>
          <View style={styles.sparkRow}>
            {history.map((h, i) => {
              const heightPct = Math.max(10, Math.round((h.seconds / maxMetric) * 100));
              return (
                <View key={i} style={styles.sparkBarWrap}>
                  <View style={styles.sparkTrack}>
                    <View style={[styles.sparkBar, { height: `${heightPct}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={styles.sparkCaption}>
            Longest recently: {formatMetric(Math.max(...history.map((h) => h.seconds)))}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
  },
  heading: { color: INK, fontSize: 15, fontWeight: '800', marginBottom: 12 },
  subheading: { color: DIM, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8, marginTop: 14 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(217,164,65,0.08)',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 10,
  },
  statValue: { color: GOLD, fontSize: 20, fontWeight: '800' },
  statLabel: { color: DIM, fontSize: 10, fontWeight: '600', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  cell: {
    borderRadius: 4,
    backgroundColor: 'rgba(163,154,134,0.14)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellDone: { backgroundColor: GOLD },
  cellToday: { borderColor: INK },
  sparkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 60 },
  sparkBarWrap: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  sparkTrack: { height: '100%', justifyContent: 'flex-end' },
  sparkBar: { backgroundColor: GOLD, borderRadius: 3, minHeight: 4 },
  sparkCaption: { color: DIM, fontSize: 10.5, marginTop: 8 },
});

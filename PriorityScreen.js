import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { shared, GOLD, INK, DIM, BORDER } from './theme';
import { currentGrowthTarget, completionsUntilNextStep, completionsSinceStart } from './growthMath';
import { estimateCompletion, catLabel } from './trackerMath';

// One place for "what should I focus on" - pulling together the two
// systems that already rank things on their own (habit growth targets,
// tracker fastest-to-finish) instead of making the user check two
// separate screens to answer the same question.
export default function PriorityScreen({ habits, items, categories, onOpenHabit, onOpenTrackerItem }) {
  const growthHabits = (habits || [])
    .filter((h) => h.growth && h.growth.enabled)
    .map((h) => {
      const completions = completionsSinceStart(h, h.growth);
      return {
        habit: h,
        target: currentGrowthTarget(h.growth, completions),
        nextIn: completionsUntilNextStep(h.growth, completions),
        unit: h.growth.unit,
      };
    })
    .sort((a, b) => (a.nextIn || 0) - (b.nextIn || 0));

  const finishItems = (items || [])
    .map((it) => ({ item: it, completion: estimateCompletion(it, categories || []) }))
    .filter((x) => x.completion)
    .sort((a, b) => a.completion.remainingPercent - b.completion.remainingPercent);

  return (
    <ScrollView contentContainerStyle={shared.container}>
      <Text style={shared.h1}>🎯 Priority</Text>
      <Text style={shared.tagline}>
        Habit growth and Fastest to Finish, side by side - everything already ranking
        itself, gathered in one spot.
      </Text>

      <View style={shared.block}>
        <View style={shared.blockHead}>
          <Text style={shared.blockTitle}>Habits — Growing Targets</Text>
        </View>
        {growthHabits.length === 0 ? (
          <Text style={shared.tagline}>
            No habits have a growing target on yet. Turn one on from a habit's detail page or
            from Settings → Habit Growth.
          </Text>
        ) : (
          growthHabits.map(({ habit, target, nextIn, unit }) => (
            <TouchableOpacity
              key={habit.id}
              style={styles.row}
              onPress={() => onOpenHabit && onOpenHabit(habit.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{habit.text}</Text>
                <Text style={styles.rowSub}>
                  {target} {unit} today
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {nextIn === 0 ? 'Steps up now' : `+${nextIn} to next step`}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={shared.block}>
        <View style={shared.blockHead}>
          <Text style={shared.blockTitle}>Tracker — Fastest to Finish</Text>
        </View>
        {finishItems.length === 0 ? (
          <Text style={shared.tagline}>
            Nothing with a Current/Total set yet. Add progress on something in the Tracker and
            it'll rank itself here automatically.
          </Text>
        ) : (
          finishItems.map(({ item, completion }) => (
            <TouchableOpacity
              key={item.id}
              style={styles.row}
              onPress={() => onOpenTrackerItem && onOpenTrackerItem(item.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowSub}>{catLabel(categories || [], item.category)}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {completion.remainingPercent}% left
                  {completion.days ? ` · ~${completion.days}d` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowTitle: { color: INK, fontSize: 15, fontWeight: '700' },
  rowSub: { color: DIM, fontSize: 12, marginTop: 2 },
  badge: {
    backgroundColor: '#1f1a15',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 10,
  },
  badgeText: { color: GOLD, fontSize: 12, fontWeight: '700' },
});

import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { shared, GOLD, INK, DIM, BORDER } from './theme';
import { estimateCompletion, catLabel } from './trackerMath';

function formatCompletedDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// What should I focus on next, pulled from what's already ranking
// itself in the Tracker (fastest to finish) rather than a separate
// system you have to opt into per habit.
export default function PriorityScreen({ habits, items, categories, setItems, onOpenHabit, onOpenTrackerItem }) {
  const finishItems = (items || [])
    .filter((it) => !it.archived) // Finished/archived items have their own screen now.
    .map((it) => ({ item: it, completion: estimateCompletion(it, categories || []) }))
    .filter((x) => x.completion)
    .sort((a, b) => a.completion.remainingPercent - b.completion.remainingPercent);

  const finishedItems = (items || [])
    .filter((it) => it.archived)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  function restoreItem(item) {
    if (!setItems) return;
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, archived: false, completedAt: null } : it))
    );
  }

  function deleteArchivedItem(item) {
    if (!setItems) return;
    setItems((prev) => prev.filter((it) => it.id !== item.id));
  }

  function onLongPressFinished(item) {
    Alert.alert(item.title, 'What would you like to do?', [
      { text: 'Restore', onPress: () => restoreItem(item) },
      { text: 'Delete', style: 'destructive', onPress: () => deleteArchivedItem(item) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={shared.container}>
      <Text style={shared.h1}>🎯 Priority</Text>
      <Text style={shared.tagline}>What's closest to done, ranked automatically.</Text>

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
              <View style={styles.thumb}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.thumbImg} resizeMode="cover" />
                ) : (
                  <Text style={styles.thumbLetter}>{(item.title || '?').charAt(0).toUpperCase()}</Text>
                )}
              </View>
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

      <View style={shared.block}>
        <View style={shared.blockHead}>
          <Text style={shared.blockTitle}>🏁 Finished</Text>
        </View>
        {finishedItems.length === 0 ? (
          <Text style={shared.tagline}>
            Nothing finished yet. Mark something done on the Tracker and it'll land here.
          </Text>
        ) : (
          <>
            <Text style={[shared.tagline, { marginBottom: 6 }]}>
              Press and hold a title for Restore or Delete.
            </Text>
            {finishedItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.row}
                onPress={() => onOpenTrackerItem && onOpenTrackerItem(item.id)}
                onLongPress={() => onLongPressFinished(item)}
                delayLongPress={350}
              >
                <View style={styles.thumb}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.thumbImg} resizeMode="cover" />
                  ) : (
                    <Text style={styles.thumbLetter}>{(item.title || '?').charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowSub}>{catLabel(categories || [], item.category)}</Text>
                </View>
                <Text style={styles.finishedDate}>{formatCompletedDate(item.completedAt)}</Text>
              </TouchableOpacity>
            ))}
          </>
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
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1f1a15',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbLetter: { color: GOLD, fontSize: 16, fontWeight: '800' },
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
  finishedDate: { color: '#4fb894', fontSize: 11.5, fontWeight: '700', marginLeft: 10 },
});

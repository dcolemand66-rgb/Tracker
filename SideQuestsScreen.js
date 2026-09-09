import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { shared, GOLD, INK, DIM, CARD, BORDER } from './theme';

function makeId() {
  return 'sq' + Date.now() + Math.random().toString(36).slice(2, 8);
}

// Trackers are Side Quests entries that open their own dedicated page
// (categories + items) instead of just toggling done/not-done. Idleon is
// the first one; more can be added here later the same way.
const TRACKERS = {
  idleon: { label: 'Idleon', icon: '🎮', subtitle: 'Account tracker' },
};

export default function SideQuestsScreen({ sideQuests, setSideQuests, onBack, onOpenTracker }) {
  const [draft, setDraft] = useState('');

  function addQuest() {
    const text = draft.trim();
    if (!text) return;
    setSideQuests((prev) => [...prev, { id: makeId(), text, done: false, addedAt: Date.now() }]);
    setDraft('');
  }

  function toggleDone(id) {
    setSideQuests((prev) => prev.map((q) => (q.id === id ? { ...q, done: !q.done } : q)));
  }

  function removeQuest(id) {
    setSideQuests((prev) => prev.filter((q) => q.id !== id));
  }

  return (
    <ScrollView style={shared.safe} contentContainerStyle={shared.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>‹ Calendar</Text>
      </TouchableOpacity>
      <Text style={shared.h1}>🗺️ Side Quests</Text>
      <Text style={shared.tagline}>
        Whatever you're into right now — no goal cards, no lessons, just a list.
      </Text>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Learn to whittle, try that new trail..."
          placeholderTextColor={DIM}
          onSubmitEditing={addQuest}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={addQuest}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {sideQuests.length === 0 ? (
        <Text style={styles.empty}>Nothing here yet - add a passion, hobby, or itch you want to scratch.</Text>
      ) : (
        <View style={shared.block}>
          {sideQuests.map((q, i) => {
            const tracker = q.type === 'tracker' ? TRACKERS[q.trackerId] : null;
            return (
              <TouchableOpacity
                key={q.id}
                style={[styles.row, i === sideQuests.length - 1 && { borderBottomWidth: 0 }]}
                activeOpacity={tracker ? 0.6 : 1}
                onPress={tracker ? () => onOpenTracker(q.trackerId) : undefined}
              >
                {tracker ? (
                  <Text style={styles.trackerIcon}>{tracker.icon}</Text>
                ) : (
                  <TouchableOpacity onPress={() => toggleDone(q.id)} style={styles.checkbox}>
                    <Text style={{ color: q.done ? GOLD : DIM, fontSize: 16 }}>{q.done ? '✓' : '○'}</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text
                    style={[
                      styles.rowText,
                      !tracker && q.done && { color: DIM, textDecorationLine: 'line-through' },
                    ]}
                  >
                    {q.text}
                  </Text>
                  {tracker ? <Text style={styles.trackerSubtitle}>{tracker.subtitle} — tap to open</Text> : null}
                </View>
                {tracker ? (
                  <Text style={{ color: DIM, fontSize: 18 }}>›</Text>
                ) : (
                  <TouchableOpacity onPress={() => removeQuest(q.id)} style={{ padding: 6 }}>
                    <Text style={{ color: DIM, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backLink: { color: GOLD, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  addRow: { flexDirection: 'row', marginBottom: 16 },
  input: {
    flex: 1,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: INK,
    marginRight: 8,
  },
  addBtn: {
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addBtnText: { color: '#1c1206', fontWeight: '700' },
  empty: { color: DIM, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  checkbox: { width: 22, alignItems: 'center' },
  trackerIcon: { fontSize: 20, width: 22, textAlign: 'center' },
  rowText: { color: INK, fontSize: 15 },
  trackerSubtitle: { color: DIM, fontSize: 12, marginTop: 2 },
});

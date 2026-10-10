// RoadmapRealm - the game screen behind the Roadmaps tab.
//
// This replaces the old idle-combat system (RoadmapIdleWorld.js: manual
// attacks, ability cooldowns, quiz-gated minions, weapon/armor gear
// tiers). That system never actually used the `habits` prop it was
// given, and its fights were driven by generic minions + course quiz
// questions rather than anything the person was actually doing in the
// app - so "winning" the game and making real progress were two
// unrelated activities.
//
// This version is built entirely from real data instead:
//   - Realm: a map of territories that unlock as real Roadmap goals get
//     completed, plus a live Honor count (lifetime habit completions)
//     and longest active streak.
//   - Quests: every Roadmap (card) and its goals/tasks, the actual
//     source of truth - tapping a task completes it for real.
//   - Trials: every still-open task across every Roadmap, reskinned as
//     something to "defeat" - defeating one *is* completing it
//     (onToggleTask), there's no separate pretend-fight layered on top.
//   - Relics: a trophy case that fills in on its own as real goals and
//     whole Roadmaps are completed, each relic carrying the real title
//     of the thing that earned it.
//
// Deliberately no new persisted currency/resource state: everything
// above is *derived* from cards/habits each render, so there is nothing
// to desync, nothing new to add to App.js's save/load/backup plumbing,
// and the numbers can never drift from what Quests/Habits actually show.
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { GOLD, GOLD_LIGHT, ROSE, JADE, INK, DIM, CARD, BORDER, BORDER_STRONG, shared, glowGold } from './theme';
import { habitStreak, habitTotalCompletions, goalTaskProgress, cardIsFullyComplete, statIdsForCard } from './habitUtils';

const TERRITORIES = [
  { name: 'Shirakawa Fields', icon: '🌾' },
  { name: 'Kurogane Pass', icon: '⛰️' },
  { name: 'Hazakura Vale', icon: '🌸' },
  { name: 'Obsidian Reach', icon: '🗻' },
  { name: 'Tenran Heights', icon: '🏯' },
  { name: 'Silver Delta', icon: '🌊' },
  { name: 'Crimson Spire', icon: '🔥' },
  { name: 'Moonlit Shrine', icon: '⛩️' },
];

const TABS = [
  { key: 'realm', label: 'Realm', icon: '⛩️' },
  { key: 'quests', label: 'Quests', icon: '📜' },
  { key: 'trials', label: 'Trials', icon: '⚔️' },
  { key: 'relics', label: 'Relics', icon: '🏆' },
];

export default function RoadmapRealm({
  level,
  cards,
  habits,
  stats,
  rewardPoints,
  onToggleTask,
  onOpenGuide,
  guides,
  onOpenStats,
  onManageCards,
  onExit,
}) {
  const [tab, setTab] = useState('realm');
  const safeCards = cards || [];
  const safeHabits = habits || [];

  const completedGoals = useMemo(() => {
    const out = [];
    safeCards.forEach((card) => {
      (card.goals || []).forEach((goal) => {
        if ((goal.tasks || []).length && goalTaskProgress(goal).complete) {
          out.push({ card, goal });
        }
      });
    });
    return out;
  }, [safeCards]);

  const completedCards = useMemo(
    () => safeCards.filter((c) => cardIsFullyComplete(c)),
    [safeCards]
  );

  const honor = useMemo(
    () => safeHabits.reduce((sum, h) => sum + habitTotalCompletions(h), 0),
    [safeHabits]
  );

  const longestStreak = useMemo(
    () => safeHabits.reduce((max, h) => Math.max(max, habitStreak(h)), 0),
    [safeHabits]
  );

  const pendingTrials = useMemo(() => {
    const out = [];
    safeCards.forEach((card) => {
      (card.goals || []).forEach((goal) => {
        (goal.tasks || []).forEach((task) => {
          if (!task.done) out.push({ card, goal, task });
        });
      });
    });
    return out;
  }, [safeCards]);

  const relics = useMemo(() => {
    const goalRelics = completedGoals.map(({ card, goal }) => ({
      id: `g-${goal.id}`,
      title: goal.title || goal.text || 'Goal',
      cardTitle: card.title || 'Roadmap',
      color: card.color || GOLD,
      grand: false,
      at: card.updatedAt || 0,
    }));
    const cardRelics = completedCards.map((card) => ({
      id: `c-${card.id}`,
      title: card.title || 'Roadmap',
      cardTitle: 'Roadmap complete',
      color: card.color || GOLD,
      grand: true,
      at: card.updatedAt || 0,
    }));
    return [...cardRelics, ...goalRelics].sort((a, b) => (b.at || 0) - (a.at || 0));
  }, [completedGoals, completedCards]);

  const territoriesUnlocked = Math.min(TERRITORIES.length, completedGoals.length + 1);
  const nextTrial = pendingTrials[0];

  return (
    <View style={{ flex: 1, backgroundColor: '#0d0a08' }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onExit}>
          <Text style={styles.topLink}>← Exit</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>The Realm</Text>
        <TouchableOpacity onPress={onManageCards}>
          <Text style={styles.topLink}>Manage</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={shared.container}>
        {tab === 'realm' && (
          <RealmTab
            level={level}
            honor={honor}
            longestStreak={longestStreak}
            territoriesUnlocked={territoriesUnlocked}
            nextTrial={nextTrial}
            onJumpTrials={() => setTab('trials')}
            guides={guides}
            onOpenGuide={onOpenGuide}
            onOpenStats={onOpenStats}
            rewardPoints={rewardPoints}
          />
        )}
        {tab === 'quests' && (
          <QuestsTab cards={safeCards} onToggleTask={onToggleTask} onManageCards={onManageCards} />
        )}
        {tab === 'trials' && (
          <TrialsTab trials={pendingTrials} onToggleTask={onToggleTask} longestStreak={longestStreak} />
        )}
        {tab === 'relics' && <RelicsTab relics={relics} />}
      </ScrollView>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={styles.tabIcon}>{t.icon}</Text>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function RealmTab({
  level,
  honor,
  longestStreak,
  territoriesUnlocked,
  nextTrial,
  onJumpTrials,
  guides,
  onOpenGuide,
  onOpenStats,
  rewardPoints,
}) {
  return (
    <>
      <View style={styles.statGrid}>
        <StatTile icon="🎖️" label="RANK" value={String(level && level.level ? level.level : 1)} />
        <StatTile icon="✨" label="HONOR" value={String(honor)} color={JADE} />
        <StatTile icon="🔥" label="STREAK" value={`${longestStreak}d`} color={ROSE} />
        <StatTile icon="🗺️" label="TERRITORIES" value={`${territoriesUnlocked}/${TERRITORIES.length}`} />
      </View>

      {nextTrial ? (
        <TouchableOpacity style={[shared.blockAccent, glowGold]} onPress={onJumpTrials}>
          <Text style={shared.catHead}>Up Next</Text>
          <Text style={styles.nextTrialText}>⚔️ {nextTrial.task.text}</Text>
          <Text style={styles.nextTrialMeta}>
            {nextTrial.card.title || 'Roadmap'} › {nextTrial.goal.title || nextTrial.goal.text}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={shared.block}>
          <Text style={shared.catHead}>Up Next</Text>
          <Text style={styles.emptyText}>No open trials - every quest is clear. 🎉</Text>
        </View>
      )}

      <Text style={[shared.catHead, { marginTop: 4 }]}>Territories</Text>
      <View style={styles.territoryGrid}>
        {TERRITORIES.map((t, i) => {
          const unlocked = i < territoriesUnlocked;
          return (
            <View
              key={t.name}
              style={[styles.territoryTile, unlocked ? styles.territoryUnlocked : styles.territoryLocked]}
            >
              <Text style={styles.territoryIcon}>{unlocked ? t.icon : '🔒'}</Text>
              <Text style={[styles.territoryName, !unlocked && styles.territoryNameLocked]} numberOfLines={1}>
                {unlocked ? t.name : '???'}
              </Text>
              {!unlocked && (
                <Text style={styles.territoryHint}>{i} quest{i === 1 ? '' : 's'} to unlock</Text>
              )}
            </View>
          );
        })}
      </View>

      {!!(guides && guides.length) && (
        <View style={shared.block}>
          <View style={shared.blockHead}>
            <Text style={shared.blockTitle}>📖 Lessons</Text>
          </View>
          {guides.map((g) => (
            <TouchableOpacity key={g.id} style={shared.row} onPress={() => onOpenGuide && onOpenGuide(g.id)}>
              <Text style={{ fontSize: 18 }}>{g.icon}</Text>
              <Text style={shared.rowName}>{g.name}</Text>
              <Text style={shared.rowRight}>{g.pct}%</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.footerLinks}>
        <TouchableOpacity onPress={onOpenStats}>
          <Text style={styles.topLink}>Edit Stats · {rewardPoints || 0} pts</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function StatTile({ icon, label, value, color }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
    </View>
  );
}

function QuestsTab({ cards, onToggleTask, onManageCards }) {
  if (!cards.length) {
    return (
      <View style={shared.block}>
        <Text style={styles.emptyText}>No roadmaps yet.</Text>
        <TouchableOpacity onPress={onManageCards} style={{ marginTop: 10 }}>
          <Text style={styles.topLink}>+ Create a Roadmap</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return cards.map((card) => {
    const goals = card.goals || [];
    const doneGoals = goals.filter((g) => goalTaskProgress(g).complete).length;
    return (
      <View key={card.id} style={[shared.block, { borderLeftWidth: 4, borderLeftColor: card.color || GOLD }]}>
        <View style={shared.blockHead}>
          <Text style={shared.blockTitle}>{card.title}</Text>
          <Text style={styles.questProgress}>{doneGoals}/{goals.length} goals</Text>
        </View>
        {goals.length === 0 ? (
          <Text style={styles.emptyText}>No goals yet.</Text>
        ) : (
          goals.map((goal) => {
            const prog = goalTaskProgress(goal);
            return (
              <View key={goal.id} style={styles.goalBlock}>
                <Text style={[styles.goalTitle, prog.complete && styles.goalTitleDone]}>
                  {prog.complete ? '✓ ' : ''}{goal.title || goal.text}
                </Text>
                {(goal.tasks || []).map((task) => (
                  <TouchableOpacity
                    key={task.id}
                    style={styles.taskRow}
                    onPress={() => onToggleTask && onToggleTask(card.id, goal.id, task)}
                  >
                    <Text style={styles.taskBullet}>{task.done ? '●' : '○'}</Text>
                    <Text style={[styles.taskText, task.done && styles.taskTextDone]}>{task.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })
        )}
      </View>
    );
  });
}

function TrialsTab({ trials, onToggleTask, longestStreak }) {
  if (!trials.length) {
    return (
      <View style={shared.block}>
        <Text style={styles.emptyText}>No open trials. Clear a quest task to spawn one. 🗡️</Text>
      </View>
    );
  }
  return (
    <>
      <Text style={styles.tagline}>
        Every open task is a trial. Defeating one marks it complete for real.
      </Text>
      {trials.map(({ card, goal, task }) => (
        <View key={task.id} style={[shared.block, styles.trialCard]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.trialName}>⚔️ {task.text}</Text>
            <Text style={styles.trialMeta}>
              {card.title || 'Roadmap'} › {goal.title || goal.text}
            </Text>
            {longestStreak > 0 && (
              <Text style={styles.trialPower}>Power bonus: +{longestStreak} (streak)</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.defeatBtn}
            onPress={() => onToggleTask && onToggleTask(card.id, goal.id, task)}
          >
            <Text style={styles.defeatBtnText}>Defeat</Text>
          </TouchableOpacity>
        </View>
      ))}
    </>
  );
}

function RelicsTab({ relics }) {
  if (!relics.length) {
    return (
      <View style={shared.block}>
        <Text style={styles.emptyText}>
          Complete a goal or a whole roadmap to earn your first relic.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.relicGrid}>
      {relics.map((r) => (
        <View
          key={r.id}
          style={[styles.relicTile, { borderColor: r.grand ? GOLD : BORDER_STRONG }]}
        >
          <Text style={styles.relicIcon}>{r.grand ? '🏆' : '🎖️'}</Text>
          <Text style={styles.relicTitle} numberOfLines={2}>{r.title}</Text>
          <Text style={styles.relicMeta} numberOfLines={1}>{r.cardTitle}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  topTitle: { color: GOLD, fontSize: 18, fontWeight: '800', fontFamily: 'serif' },
  topLink: { color: GOLD_LIGHT, fontSize: 13, fontWeight: '600' },
  tagline: { color: DIM, marginBottom: 12 },
  emptyText: { color: DIM, fontSize: 13 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, marginBottom: 16 },
  statTile: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  statIcon: { fontSize: 18 },
  statLabel: { color: DIM, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  statValue: { color: GOLD, fontSize: 20, fontWeight: '800', marginTop: 2 },

  nextTrialText: { color: INK, fontSize: 16, fontWeight: '700', marginTop: 4 },
  nextTrialMeta: { color: DIM, fontSize: 12, marginTop: 2 },

  territoryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: 16 },
  territoryTile: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  territoryUnlocked: { backgroundColor: CARD, borderColor: BORDER_STRONG },
  territoryLocked: { backgroundColor: '#13100d', borderColor: BORDER },
  territoryIcon: { fontSize: 24, marginBottom: 4 },
  territoryName: { color: INK, fontSize: 13, fontWeight: '700' },
  territoryNameLocked: { color: DIM },
  territoryHint: { color: DIM, fontSize: 10, marginTop: 2, textAlign: 'center' },

  footerLinks: { alignItems: 'center', marginTop: 4, marginBottom: 20 },

  questProgress: { color: DIM, fontSize: 12, fontWeight: '600' },
  goalBlock: { marginTop: 10 },
  goalTitle: { color: INK, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  goalTitleDone: { color: JADE },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingLeft: 8 },
  taskBullet: { color: GOLD, fontSize: 12, marginRight: 8 },
  taskText: { color: INK, fontSize: 13, flex: 1 },
  taskTextDone: { color: DIM, textDecorationLine: 'line-through' },

  trialCard: { flexDirection: 'row', alignItems: 'center' },
  trialName: { color: INK, fontSize: 15, fontWeight: '700' },
  trialMeta: { color: DIM, fontSize: 12, marginTop: 2 },
  trialPower: { color: ROSE, fontSize: 11, marginTop: 4, fontWeight: '600' },
  defeatBtn: {
    backgroundColor: ROSE,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginLeft: 10,
  },
  defeatBtnText: { color: '#1c0606', fontWeight: '800', fontSize: 13 },

  relicGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  relicTile: {
    width: '31.33%',
    marginHorizontal: '1%',
    marginBottom: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
  },
  relicIcon: { fontSize: 26, marginBottom: 4 },
  relicTitle: { color: INK, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  relicMeta: { color: DIM, fontSize: 10, textAlign: 'center', marginTop: 2 },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: '#0d0a08',
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabBtnActive: { borderTopWidth: 2, borderTopColor: GOLD, marginTop: -6, paddingTop: 8 },
  tabIcon: { fontSize: 18 },
  tabLabel: { color: DIM, fontSize: 11, marginTop: 2, fontWeight: '600' },
  tabLabelActive: { color: GOLD },
});

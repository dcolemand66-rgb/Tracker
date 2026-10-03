export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const HABIT_POINTS = 3;

export function habitDaysLabel(habit) {
  const days = (habit.days || []).slice().sort();
  if (!days.length || days.length === 7) return 'Daily';
  const set = days.join(',');
  if (set === '1,2,3,4,5') return 'Weekdays';
  if (set === '0,6') return 'Weekends';
  return days.map((d) => DAY_LETTERS[d]).join('');
}

export function habitScheduledOn(habit, dow) {
  return !habit.days || !habit.days.length || habit.days.includes(dow);
}

export function habitDoneOn(habit, dateKey) {
  return !!(habit.doneDates && habit.doneDates[dateKey]);
}

// Local calendar date as YYYY-MM-DD. Deliberately NOT toISOString(),
// which converts to UTC first: anywhere behind UTC that rolls the date
// over during the evening, so habits completed at night were recorded
// against tomorrow and today never showed as done.
export function localDateKey(d) {
  const dt = d || new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayDateKey() {
  return localDateKey();
}

export function habitStreak(habit) {
  let streak = 0;
  let cursor = new Date();
  let dow = cursor.getDay();
  let key = localDateKey(cursor);
  if (habitScheduledOn(habit, dow) && !habitDoneOn(habit, key)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (let i = 0; i < 1000; i++) {
    dow = cursor.getDay();
    key = localDateKey(cursor);
    if (habitScheduledOn(habit, dow)) {
      if (habitDoneOn(habit, key)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    } else {
      cursor.setDate(cursor.getDate() - 1);
    }
  }
  return streak;
}

export function habitTotalCompletions(habit) {
  return Object.keys(habit.doneDates || {}).length;
}

// Converts a stored "HH:MM" (24-hour) time string into a 12-hour
// AM/PM display string, e.g. "19:00" -> "7:00 PM". Shared so every
// screen that shows a habit's time displays it the same way.
export function formatTimeDisplay(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// Shared completion logic used by both the Calendar and To Do screens, so
// points/XP/energy/notification effects stay identical no matter where a
// habit gets checked off. Returns the new `newDone` value so callers can
// react (e.g. cancel a pending notification) without re-deriving it.
//
// cards/setStats (both optional, only passed by screens that have them):
// if this habit is linked to a Roadmap goal (goal.habits includes its id),
// completing it now also grants that goal's card's linked stats the same
// XP a manual task checkbox would - previously goal.habits was stored but
// never actually read anywhere, so a linked habit did nothing for its
// roadmap.
// Roadmap goal-task helpers, shared between RoadmapsScreen (where tasks
// are managed) and Calendar's Quests section (where the first pending
// task per goal now shows up so real roadmap progress is visible without
// opening Roadmaps at all) - see toggleGoalTask below.
export const TASK_POINTS = { TASK: 5, GOAL_BONUS: 20, CARD_BONUS: 100 };

export function goalTaskProgress(goal) {
  const tasks = goal.tasks || [];
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const complete = total > 0 && done === total;
  return { total, done, complete };
}

export function cardIsFullyComplete(card) {
  const goals = card.goals || [];
  if (!goals.length) return false;
  return goals.every((g) => goalTaskProgress(g).complete);
}

export function statIdsForCard(card) {
  return card.statIds || (card.statId ? [card.statId] : []);
}

// One "quest" per ROADMAP (card), not per goal - just its single next
// step, so this stays a short, step-by-step list instead of one entry
// per goal piling up in parallel. Walks a card's goals in order and
// stops at the first one with something pending: its first pending
// task, or its first not-done-today linked habit if it has no tasks -
// otherwise a goal tracked purely through a linked habit would never
// surface here at all. cardId/goalId ride along so a tap can round-trip
// back to toggleGoalTask (tasks) or toggleHabitCompletion (habits) as
// appropriate - see `kind` on each entry.
export function firstStepPerRoadmap(cards, habits) {
  const out = [];
  (cards || []).forEach((c) => {
    const goals = c.goals || [];
    for (const g of goals) {
      const nextTask = (g.tasks || []).find((t) => !t.done);
      if (nextTask) {
        out.push({
          kind: 'task',
          id: nextTask.id,
          text: nextTask.text,
          done: nextTask.done,
          cardId: c.id,
          goalId: g.id,
          cardTitle: c.title,
          goalTitle: g.title || g.text,
        });
        return;
      }
      const linkedHabitIds = g.habits || [];
      if (linkedHabitIds.length) {
        const habit = (habits || []).find(
          (h) => linkedHabitIds.includes(h.id) && !habitDoneOn(h, todayDateKey())
        );
        if (habit) {
          out.push({
            kind: 'habit',
            id: habit.id,
            text: habit.text,
            cardId: c.id,
            goalId: g.id,
            cardTitle: c.title,
            goalTitle: g.title || g.text,
            habit,
          });
          return;
        }
      }
    }
  });
  return out;
}

// Shared goal-task completion logic. Grants the same points/XP/energy a
// task checkbox inside Roadmaps would, including stat XP for the card's
// linked stats - so checking a quest off from the Calendar has exactly
// the same effect as doing it from Roadmaps itself.
export function toggleGoalTask(cardId, goalId, task, setters) {
  const { cards, setCards, setRewardPoints, setHero, setLevel, setStats, applyXPDelta, MAX_ENERGY, ENERGY_PER_TASK } = setters;
  const card = cards.find((c) => c.id === cardId);
  const goal = card && card.goals && card.goals.find((g) => g.id === goalId);
  if (!card || !goal) return null;
  const wasGoalComplete = goalTaskProgress(goal).complete;
  const wasCardComplete = cardIsFullyComplete(card);
  const newDone = !task.done;

  let delta = newDone ? TASK_POINTS.TASK : -TASK_POINTS.TASK;

  const updatedGoal = {
    ...goal,
    tasks: goal.tasks.map((t) => (t.id === task.id ? { ...t, done: newDone } : t)),
  };
  const isGoalComplete = goalTaskProgress(updatedGoal).complete;
  if (!wasGoalComplete && isGoalComplete) delta += TASK_POINTS.GOAL_BONUS;
  if (wasGoalComplete && !isGoalComplete) delta -= TASK_POINTS.GOAL_BONUS;

  const updatedCard = {
    ...card,
    goals: card.goals.map((g) => (g.id === goal.id ? updatedGoal : g)),
  };
  const isCardComplete = cardIsFullyComplete(updatedCard);
  if (!wasCardComplete && isCardComplete) delta += TASK_POINTS.CARD_BONUS;
  if (wasCardComplete && !isCardComplete) delta -= TASK_POINTS.CARD_BONUS;

  setCards((prev) => prev.map((c) => (c.id === card.id ? { ...updatedCard, updatedAt: Date.now() } : c)));
  setRewardPoints((p) => Math.max(0, p + delta));
  if (newDone && setHero) {
    setHero((h) => ({ ...h, energy: Math.min(MAX_ENERGY, h.energy + ENERGY_PER_TASK) }));
  }
  setLevel((prev) => {
    const next = applyXPDelta(prev, delta);
    if (next.levelsGained > 0) {
      setRewardPoints((p) => Math.max(0, p + next.level * 20 * next.levelsGained));
    }
    return { level: next.level, xp: next.xp };
  });
  if (setStats) {
    const statIds = statIdsForCard(card);
    if (statIds.length) {
      setStats((prev) =>
        prev.map((s) => {
          if (!statIds.includes(s.id)) return s;
          const next = applyXPDelta(s, delta);
          return { ...s, level: next.level, xp: next.xp };
        })
      );
    }
  }
  return newDone;
}

export function toggleHabitCompletion(habit, setters) {
  const { setHabits, setLevel, setRewardPoints, setHero, applyXPDelta, HABIT_POINTS, cards, setStats } = setters;
  const todayKey = todayDateKey();
  const newDone = !habitDoneOn(habit, todayKey);
  const delta = newDone ? HABIT_POINTS : -HABIT_POINTS;

  setHabits((prev) =>
    prev.map((h) => {
      if (h.id !== habit.id) return h;
      const doneDates = { ...(h.doneDates || {}) };
      if (newDone) doneDates[todayKey] = true;
      else delete doneDates[todayKey];
      return { ...h, doneDates };
    })
  );
  setRewardPoints((p) => Math.max(0, p + delta));
  if (newDone && setHero) {
    setHero((h) => ({ ...h, energy: Math.min(100, h.energy + 15) }));
  }
  setLevel((prev) => {
    const next = applyXPDelta(prev, delta);
    return { level: next.level, xp: next.xp };
  });
  if (cards && setStats) {
    const linkedStatIds = new Set();
    cards.forEach((card) => {
      (card.goals || []).forEach((goal) => {
        if ((goal.habits || []).includes(habit.id)) {
          (card.statIds || (card.statId ? [card.statId] : [])).forEach((id) => linkedStatIds.add(id));
        }
      });
    });
    if (linkedStatIds.size) {
      setStats((prev) =>
        prev.map((s) => {
          if (!linkedStatIds.has(s.id)) return s;
          const next = applyXPDelta(s, delta);
          return { ...s, level: next.level, xp: next.xp };
        })
      );
    }
  }
  return newDone;
}

// Clears today's completion for every habit — un-checks today's date on
// each habit, and removes today's breath-hold entry for Meditation-style
// habits, without touching any other day's history or streak data.
export function resetTodayHabits(habits, setHabits) {
  const todayKey = todayDateKey();
  setHabits((prev) =>
    prev.map((h) => {
      const doneDates = { ...(h.doneDates || {}) };
      delete doneDates[todayKey];
      const breathHoldHistory = (h.breathHoldHistory || []).filter(
        (entry) => entry.date !== todayKey
      );
      return { ...h, doneDates, breathHoldHistory };
    })
  );
}


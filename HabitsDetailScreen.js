import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { shared, GOLD, ROSE, INK, DIM, CARD, BORDER } from './theme';
import { HABITS_THEME } from './pageThemes';
import PageHeader from './PageHeader';
import DateTimePicker from '@react-native-community/datetimepicker';
import { applyXPDelta } from './leveling';
import { HABIT_POINTS } from './habitUtils';
import {
  habitDaysLabel,
  habitScheduledOn,
  habitDoneOn,
  todayDateKey,
  habitStreak,
  habitTotalCompletions,
  toggleHabitCompletion,
  formatTimeDisplay,
} from './habitUtils';
import { fetchPlaylistVideos } from './youtubePlaylist';
import { cancelTodayForHabit, scheduleHabitNotifications, cancelAllForHabit } from './notifications';
import HabitVideoPlayer from './HabitVideoPlayer';
import MeditationSession, {
  meditationLevelSpec,
  meditationLevelLabel,
  MEDITATION_MAX_LEVEL,
  DAYS_PER_LEVEL,
} from './MeditationSession';
import BoxBreathingSession from './BoxBreathingSession';
import BodyScanSession from './BodyScanSession';
import MeditationMenu from './MeditationMenu';
import MeditationGrowthGraph from './MeditationGrowthGraph';
import { meditationBackgroundById } from './meditationBackgrounds';
import { setPhoneAlarmForHabit, openPhoneClock, canSetPhoneAlarm } from './phoneAlarm';
import { defaultGrowth, currentGrowthTarget, completionsUntilNextStep, completionsSinceStart, logGrowthFeel, hasLoggedFeelToday } from './growthMath';
import SelfCareSession from './SelfCareSession';
import BookShelf from './BookShelf';
import { bookProgressPct } from './bookUtils';
import ChessBoard from './ChessBoard';
import ChessLessonSession from './ChessLessonSession';
import { CHESS_LESSONS, chessLessonProgress, nextChessLesson } from './chessLessons';
import LessonVideo from './LessonVideo';
import CardistryPracticeSession from './CardistryPracticeSession';
import { pickCompressedImage } from './imagePicker';
import {
  CARDISTRY_RANKS,
  rankProgress,
  currentRankIndex,
  isRankUnlocked,
  chapterForPage,
} from './cardistryRanks';
import GuidedWorkoutSession, {
  buildWorkoutTemplate,
  evaluateAllTracks,
} from './GuidedWorkoutSession';
import {
  TRACKS,
  CORE_TRACKS,
  BASIC_ORDER,
  OPTIONAL_KEYS,
  REP_UNLOCK_THRESHOLD,
  currentStage,
  defaultUnlockedPatterns,
  normalizeExerciseState,
} from './workoutTracks';

const BASIC_LABELS = { push: 'Push', squat: 'Squat', antiExtension: 'Core', extension: 'Core (extension)', pull: 'Pull', hinge: 'Hinge', row: 'Row' };
import { defaultDifficulty, computeConsistency, getSessionDifficulty } from './consistencyEngine';
import MoodCheckIn from './MoodCheckIn';

function makeId(prefix = 'h') {
  return prefix + Date.now() + Math.random().toString(36).slice(2, 8);
}

// A stored habit time is always a clean "HH:MM" (24-hour) string,
// produced only by the native time picker — never free-typed — so it
// can never fail to parse for notification scheduling.
function timeStringToDate(timeStr) {
  const d = new Date();
  if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

function dateToTimeString(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function HabitsDetailScreen({ habits, setHabits, level, setLevel, rewardPoints, setRewardPoints, hero, setHero, cards, setCards, stats, setStats, meditationSettings, bodyWorkouts, setBodyWorkouts, bodyExercises, pendingHabitId, onPendingHandled,
  bodyRoutines, setBodyRoutines }) {
  const [detailId, setDetailId] = useState(null);
  // Separate from detailId on purpose: detailId controls the detail
  // Modal, activeHabitId controls the video/meditation Modal. Both used
  // to be driven by the same state, which meant tapping a habit to
  // watch its video ALSO left the detail Modal's visible={true}
  // condition satisfied underneath it — two real native Modal layers
  // simultaneously visible, fighting for stacking order. That's what
  // caused the detail view to intermittently surface over the video,
  // especially around the fullscreen transition.
  const [activeHabitId, setActiveHabitId] = useState(null);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');

  const [videoOpen, setVideoOpen] = useState(false);
  const [meditationOpen, setMeditationOpen] = useState(false);
  // "Menu" first (style/background/sound/voice, fresh pick every time
  // per the user's "depending on my mood im not stuck to one form") then
  // "session" once Begin is tapped. Reset to 'menu' every time the
  // meditation Modal opens, whatever stage it was left on last close.
  const [meditationStage, setMeditationStage] = useState('menu');
  const [meditationChoice, setMeditationChoice] = useState(null);
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [selfCareOpen, setSelfCareOpen] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const [chessOpen, setChessOpen] = useState(false);
  const [chessLessonId, setChessLessonId] = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendingAdvance, setPendingAdvance] = useState(null);
  const [openRankId, setOpenRankId] = useState(null);
  const [growthFormOpen, setGrowthFormOpen] = useState(false);
  const [growthDraft, setGrowthDraft] = useState({ startValue: '10', amount: '2', everyDays: '3', unit: 'reps' });
  const [openTechId, setOpenTechId] = useState(null);
  const [practiceTech, setPracticeTech] = useState(null); // { habit, technique } or null

  // Difficulty/consistency: gate a session behind a quick mood pick when
  // the habit has it turned on, then hand the resulting effective level
  // to whichever session screen opens. sessionDifficulty is keyed by
  // habit id so switching between habits never bleeds one's level into
  // another's.
  const [moodGate, setMoodGate] = useState(null); // { habit, open: () => void } or null
  const [sessionDifficulty, setSessionDifficulty] = useState({}); // { [habitId]: difficultyResult }

  function openSession(habit, openFn) {
    setActiveHabitId(habit.id);
    if (habit.difficulty && habit.difficulty.enabled) {
      setMoodGate({ habit, open: openFn });
    } else {
      openFn();
    }
  }

  function openMeditationMenu() {
    setMeditationStage('menu');
    setMeditationOpen(true);
  }

  function resolveMood(moodKey) {
    if (!moodGate) return;
    const { habit, open } = moodGate;
    if (habit.difficulty && habit.difficulty.enabled) {
      setSessionDifficulty((prev) => ({ ...prev, [habit.id]: getSessionDifficulty(habit, moodKey) }));
    }
    setMoodGate(null);
    open();
  }

  function skipMood() {
    if (!moodGate) return;
    moodGate.open();
    setMoodGate(null);
  }

  function toggleDifficulty(habit) {
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id
          ? { ...h, difficulty: { ...defaultDifficulty(), ...(h.difficulty || {}), enabled: !(h.difficulty && h.difficulty.enabled) } }
          : h
      )
    );
  }

  const detailHabit = habits.find((h) => h.id === detailId);
  const activeHabit = habits.find((h) => h.id === activeHabitId);

  // Land directly on the technique to actually practice, not a
  // collapsed list you have to drill into twice (rank, then technique) -
  // "do the habit on the screen" means the video/mark-mastered UI should
  // already be open when you get here.
  useEffect(() => {
    if (detailHabit && detailHabit.sessionType === 'cardistry') {
      const mastered = detailHabit.mastered || {};
      const rank = CARDISTRY_RANKS[currentRankIndex(mastered)];
      if (rank) {
        setOpenRankId(rank.id);
        const nextTech = rank.techniques.find((t) => !mastered[t.id]);
        setOpenTechId(nextTech ? nextTech.id : null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId]);

  // Arriving from a Calendar tap: open that habit's session straight away.
  useEffect(() => {
    if (!pendingHabitId) return;
    const h = habits.find((x) => x.id === pendingHabitId);
    if (!h) return;
    setActiveHabitId(h.id);
    if (h.linkedContent && h.text !== 'Chess') setVideoOpen(true);
    else if (h.sessionType === 'workout') openSession(h, () => setWorkoutOpen(true));
    else if (h.sessionType === 'reading') setReadingOpen(true);
    else if (h.sessionType === 'selfcare') setSelfCareOpen(true);
    else if (h.sessionType === 'breathing') openSession(h, openMeditationMenu);
    else setDetailId(h.id);
    if (onPendingHandled) onPendingHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHabitId, habits]);

  const CHESS_PLAYLIST_URL = 'https://youtube.com/playlist?list=PLQKBpQZcRycrvUUxLdVmlfMChJS0S5Zw0';

  // Purpose-built habits get set up here in code, one at a time, rather
  // than through a generic add form — Chess is the first. It no longer
  // auto-links a video playlist; the lesson sequence replaced that.
  useEffect(() => {
    const alreadyExists = habits.some((h) => h.text === 'Chess');
    if (alreadyExists) return;
    setHabits((prev) => [
      ...prev,
      {
        id: makeId(),
        text: 'Chess',
        days: [],
        time: '',
        doneDates: {},
        addedAt: Date.now(),
        linkedContent: null,
        sessionType: 'chess',
        scheduledNotifications: [],
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Migration: Chess was originally seeded without sessionType, which is
  // what the Calendar screen uses to decide between a plain checkbox and
  // the "tap to start" session treatment every other purpose-built habit
  // gets. Any Chess habit created before this fix gets it filled in here.
  useEffect(() => {
    const stale = habits.find((h) => h.text === 'Chess' && h.sessionType !== 'chess');
    if (!stale) return;
    setHabits((prev) =>
      prev.map((h) => (h.id === stale.id ? { ...h, sessionType: 'chess' } : h))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits]);

  // Migration: earlier versions of this habit auto-linked a YouTube
  // playlist. If that already happened before this update, clear it so
  // the old video path can never be reached again, even indirectly.
  useEffect(() => {
    const stale = habits.find((h) => h.text === 'Chess' && h.linkedContent);
    if (!stale) return;
    setHabits((prev) =>
      prev.map((h) => (h.id === stale.id ? { ...h, linkedContent: null } : h))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits]);

  // Self-care routines used to live in their own Body tab. They are
  // habits in every meaningful sense — scheduled, done daily, tracked —
  // so they get migrated across once and the Body tab retired.
  useEffect(() => {
    if (!bodyRoutines || !bodyRoutines.length) return;
    const existing = new Set(habits.map((h) => (h.text || '').toLowerCase()));
    const toAdd = bodyRoutines
      .filter((r) => r.name && !existing.has(r.name.toLowerCase()))
      .map((r) => ({
        id: makeId(),
        text: r.name,
        days: r.days || [],
        time: r.time || '',
        doneDates: r.doneDates || {},
        addedAt: r.addedAt || Date.now(),
        linkedContent: null,
        sessionType: 'selfcare',
        steps: r.steps || [],
        notes: r.notes || '',
        scheduledNotifications: [],
      }));
    if (toAdd.length) setHabits((prev) => [...prev, ...toAdd]);
    // Clear the old list so the migration cannot run twice.
    if (setBodyRoutines) setBodyRoutines([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Self care, Reading, and Cardistry. Self care only arrived before by
  // migrating routines out of the old Body tab — if you never made any
  // there, nothing appeared, so it gets seeded here like the others.
  useEffect(() => {
    const existing = new Set(habits.map((h) => (h.text || '').toLowerCase()));
    const additions = [];

    if (!existing.has('self care')) {
      additions.push({
        id: makeId(),
        text: 'Self Care',
        days: [],
        time: '',
        doneDates: {},
        addedAt: Date.now(),
        linkedContent: null,
        sessionType: 'selfcare',
        steps: [
          { id: makeId('st'), text: 'Wash face', minutes: '' },
          { id: makeId('st'), text: 'Moisturise', minutes: '' },
          { id: makeId('st'), text: 'Brush and floss', minutes: '2' },
        ],
        notes: '',
        scheduledNotifications: [],
      });
    }

    if (!existing.has('reading')) {
      additions.push({
        id: makeId(),
        text: 'Reading',
        days: [],
        time: '',
        doneDates: {},
        addedAt: Date.now(),
        linkedContent: null,
        sessionType: 'reading',
        pagesPerSession: 10,
        readingLog: [],
        scheduledNotifications: [],
      });
    }

    if (!existing.has('cardistry')) {
      additions.push({
        id: makeId(),
        text: 'Cardistry',
        days: [],
        time: '',
        doneDates: {},
        addedAt: Date.now(),
        linkedContent: null,
        sessionType: 'cardistry',
        scheduledNotifications: [],
      });
    }

    if (additions.length) setHabits((prev) => [...prev, ...additions]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Workout: third purpose-built habit. Cycles through the three
  // bodyweight programs the same way Chess advances through its
  // playlist, so you always know what today's session is without
  // having to choose.
  useEffect(() => {
    if (habits.some((h) => h.text === 'Workout')) return;
    setHabits((prev) => [
      ...prev,
      {
        id: makeId(),
        text: 'Workout',
        days: [],
        time: '',
        doneDates: {},
        addedAt: Date.now(),
        linkedContent: null,
        sessionType: 'workout',
        exerciseState: {},
        unlockedPatterns: defaultUnlockedPatterns(),
        scheduledNotifications: [],
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Meditation: second purpose-built habit, a guided breathing session
  // instead of video content — its own dedicated flow entirely.
  useEffect(() => {
    const alreadyExists = habits.some((h) => h.text === 'Meditation');
    if (alreadyExists) return;
    setHabits((prev) => [
      ...prev,
      {
        id: makeId(),
        text: 'Meditation',
        days: [],
        time: '',
        doneDates: {},
        addedAt: Date.now(),
        linkedContent: null,
        sessionType: 'breathing',
        breathHoldHistory: [],
        scheduledNotifications: [],
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function doToggleToday(habit) {
    try {
      return doToggleTodayInner(habit);
    } catch (e) {
      // Completion was failing with no visible symptom, which made it
      // impossible to tell whether the session, the state update, or the
      // reward wiring was at fault. Any error now surfaces.
      Alert.alert('Could not mark this habit done', (e && e.message) || String(e));
      return false;
    }
  }

  function doToggleTodayInner(habit) {
    if (!habit) throw new Error('No habit was passed to the completion handler.');
    const newDone = toggleHabitCompletion(habit, {
      setHabits,
      setLevel,
      setRewardPoints,
      setHero,
      applyXPDelta,
      HABIT_POINTS,
      cards,
      setStats,
    });
    if (newDone) {
      cancelTodayForHabit(habit, todayDateKey()).then((remaining) => {
        setHabits((prev) =>
          prev.map((h) => (h.id === habit.id ? { ...h, scheduledNotifications: remaining } : h))
        );
      });
    }
  }

  function toggleTechnique(habit, techId) {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habit.id) return h;
        const mastered = { ...(h.mastered || {}) };
        if (mastered[techId]) delete mastered[techId];
        else mastered[techId] = true;
        return { ...h, mastered };
      })
    );
  }

  // Used by the practice session — only ever sets mastered, never toggles
  // it off, since finishing a 5-minute practice block is a one-way step.
  function markTechniqueMastered(habit, techId) {
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id
          ? { ...h, mastered: { ...(h.mastered || {}), [techId]: true } }
          : h
      )
    );
  }

  // Photos come from your own copies of the books — the app supplies the
  // slot, you supply the reference shot.
  async function attachTechniquePhoto(habit, techId) {
    const result = await pickCompressedImage();
    if (result.error === 'permission') {
      Alert.alert('Photo access needed', 'Allow photo library access to add a photo.');
      return;
    }
    if (result.canceled || !result.uri) return;
    const uri = result.uri;
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id
          ? { ...h, techniquePhotos: { ...(h.techniquePhotos || {}), [techId]: uri } }
          : h
      )
    );
  }

  function removeTechniquePhoto(habit, techId) {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habit.id) return h;
        const photos = { ...(h.techniquePhotos || {}) };
        delete photos[techId];
        return { ...h, techniquePhotos: photos };
      })
    );
  }

  async function setHabitTime(habit, newTime) {
    const updated = { ...habit, time: newTime };
    // Setting the time is the whole action — the system alarm is created
    // here rather than behind a separate button. This used to fire
    // silent:true without checking the result at all, so a failure (a
    // rejected intent, a device that doesn't support it, etc.) gave zero
    // feedback - it just looked like nothing happened. Now actually
    // awaited, and a failure surfaces a real alert instead of being
    // swallowed silently. Success still stays quiet, since the "alarm
    // hint" text that appears once a time is set already confirms it.
    if (newTime) {
      const result = await setPhoneAlarmForHabit(updated, { silent: true });
      if (!result.success) {
        Alert.alert(
          "Couldn't create the phone alarm",
          `The reminder time is saved, but a system alarm for ${formatTimeDisplay(newTime)} could not be created automatically. You can set one yourself in your Clock app.\n\nDetails: ${result.errorMessage}`
        );
      }
    }
    const scheduledNotifications = newTime
      ? await scheduleHabitNotifications(updated)
      : (await cancelAllForHabit(habit), []);
    setHabits((prev) =>
      prev.map((h) => (h.id === habit.id ? { ...h, time: newTime, scheduledNotifications } : h))
    );
  }

  function openLinkPlaylist() {
    setLinkUrl('');
    setLinkError('');
    setLinkOpen(true);
  }

  // Growing target - a numeric target (reps, minutes, pages...) that
  // climbs as the habit actually gets completed (its own real doneDates,
  // the same data the streak is built from), with the pace adjustable
  // by how it actually felt. Available on any habit, not just
  // workout-type ones, and each habit gets its own suggested starting
  // shape based on what it's called.
  function setHabitGrowth(habit, updater) {
    setHabits((prev) =>
      prev.map((h) => (h.id === habit.id ? { ...h, growth: updater(h.growth || defaultGrowth(h.text)) } : h))
    );
  }

  function toggleGrowth(habit) {
    setHabitGrowth(habit, (g) =>
      g.enabled
        ? { ...g, enabled: false }
        : { ...defaultGrowth(habit.text), ...g, enabled: true, startedAt: g.startedAt || Date.now() }
    );
  }

  function openGrowthForm(habit) {
    const g = habit.growth && habit.growth.startValue != null ? habit.growth : defaultGrowth(habit.text);
    setGrowthDraft({
      startValue: String(g.startValue),
      amount: String(g.amount),
      everyDays: String(g.everyDays),
      unit: g.unit,
    });
    setGrowthFormOpen(true);
  }

  function saveGrowthSettings(habit) {
    const startValue = Math.max(0, Number(growthDraft.startValue) || 0);
    const amount = Math.max(0, Number(growthDraft.amount) || 0);
    const everyDays = Math.max(1, Number(growthDraft.everyDays) || 1);
    const unit = growthDraft.unit.trim() || 'reps';
    setHabitGrowth(habit, (g) => ({
      ...g,
      enabled: true,
      startValue,
      amount,
      everyDays,
      unit,
      startedAt: g.startedAt || Date.now(),
    }));
    setGrowthFormOpen(false);
  }

  function logFeel(habit, feel) {
    const completions = completionsSinceStart(habit, habit.growth);
    setHabitGrowth(habit, (g) => logGrowthFeel(g, feel, todayDateKey(), completions));
  }

  // Editing today's workout blocks: custom rep/hold targets by exercise
  // name, and which unlocked bonus exercises to leave out entirely (e.g.
  // pull-ups with no bar available). This is the "customize the actual
  // exercises" layer that Growing Target doesn't cover - that one only
  // ever adjusts a single number, not the workout's exercise list.
  const [exerciseEditOpen, setExerciseEditOpen] = useState(false);
  const [exerciseDraft, setExerciseDraft] = useState({}); // { [name]: '12' }
  const [exerciseBlocksDraft, setExerciseBlocksDraft] = useState([]); // [{ name, mode, min, max }] for rendering the form

  function openExerciseEdit(habit) {
    const { template: spec } = buildWorkoutTemplate({ ...habit, exerciseOverrides: {} });
    const overrides = habit.exerciseOverrides || {};
    const draft = {};
    spec.blocks.forEach((b) => {
      const fallback = b.mode === 'time' ? b.seconds : b.target;
      draft[b.name] = String(overrides[b.name] != null ? overrides[b.name] : fallback);
    });
    setExerciseDraft(draft);
    setExerciseBlocksDraft(spec.blocks.map((b) => ({ name: b.name, mode: b.mode })));
    setExerciseEditOpen(true);
  }

  function saveExerciseEdits(habit) {
    const overrides = {};
    Object.keys(exerciseDraft).forEach((name) => {
      const n = Number(exerciseDraft[name]);
      if (!Number.isNaN(n) && n > 0) overrides[name] = n;
    });
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, exerciseOverrides: overrides } : h)));
    setExerciseEditOpen(false);
  }

  function resetExerciseEdits(habit) {
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, exerciseOverrides: {} } : h)));
    setExerciseEditOpen(false);
  }

  // Pull/Hinge/Row are opt-in, manual, never auto-added - see
  // workoutTracks.js OPTIONAL_KEYS for why they're kept out of the
  // mood-gated basic path.
  function toggleOptionalPattern(habit, key) {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habit.id) return h;
        const current = h.unlockedPatterns || [];
        const on = current.includes(key);
        return { ...h, unlockedPatterns: on ? current.filter((k) => k !== key) : [...current, key] };
      })
    );
  }

  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);

  async function fetchAndLink() {
    if (!linkUrl.trim()) {
      setLinkError('Paste a playlist link first.');
      return;
    }
    setLinkLoading(true);
    setLinkError('');
    try {
      const videos = await fetchPlaylistVideos(linkUrl.trim());
      setHabits((prev) =>
        prev.map((h) =>
          h.id === detailId
            ? {
                ...h,
                linkedContent: {
                  playlistUrl: linkUrl.trim(),
                  items: videos,
                  progressIndex: 0,
                },
              }
            : h
        )
      );
      setLinkOpen(false);
    } catch (e) {
      setLinkError(e.message || 'Something went wrong.');
    } finally {
      setLinkLoading(false);
    }
  }

  // Completing marks the habit done, but the playlist does NOT advance
  // yet. Advancing here changed the player's key mid-watch, remounting
  // it onto the next video and throwing away where you were. The
  // advance is deferred to when the video is actually closed.
  function handleVideoComplete() {
    try {
      return handleVideoCompleteInner();
    } catch (e) {
      Alert.alert("Session did not register", (e && e.message) || String(e));
    }
  }

  function handleVideoCompleteInner() {
    const habit = activeHabit;
    if (!habit || !habit.linkedContent) return;
    setPendingAdvance(habit.id);
    if (!habitDoneOn(habit, todayDateKey())) doToggleToday(habit);
  }

  // Runs on closing the video: banks the finished video and moves the
  // playlist on, so reopening tomorrow starts on the next one.
  function closeVideo() {
    const habitId = pendingAdvance;
    setVideoOpen(false);
    if (!habitId) return;
    setPendingAdvance(null);
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habitId && h.linkedContent
          ? {
              ...h,
              linkedContent: {
                ...h.linkedContent,
                progressIndex: Math.min(
                  h.linkedContent.items.length - 1,
                  h.linkedContent.progressIndex + 1
                ),
                watchedSeconds: 0,
                watchedDate: null,
              },
            }
          : h
      )
    );
  }

  function handleWorkoutComplete(result) {
    try {
      return handleWorkoutCompleteInner(result);
    } catch (e) {
      Alert.alert("Session did not register", (e && e.message) || String(e));
    }
  }

  function handleWorkoutCompleteInner(result) {
    const habit = activeHabit;
    if (!habit) return;
    const byName = {};
    result.entries.forEach((e) => {
      if (!byName[e.name]) byName[e.name] = [];
      byName[e.name].push({
        weight: '',
        reps: e.mode === 'time' ? `${e.value}s` : String(e.value),
      });
    });
    const exercises = Object.keys(byName).map((name) => {
      const known = (bodyExercises || []).find(
        (ex) => ex.name.toLowerCase() === name.toLowerCase()
      );
      return { exerciseId: known ? known.id : makeId('bex'), name, sets: byName[name] };
    });
    if (setBodyWorkouts) {
      setBodyWorkouts((prev) => [
        {
          id: makeId('bw'),
          title: `${result.templateName} (Guided)`,
          date: todayDateKey(),
          exercises,
          notes: `${result.rounds} rounds completed.`,
        },
        ...prev,
      ]);
    }
    const alreadyDoneToday = habitDoneOn(habit, todayDateKey());
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habit.id) return h;
        const { exerciseState, unlockedPatterns, events, patternToUnlock } = evaluateAllTracks(h, result.entries);

        const parts = [];
        events.forEach((ev) => {
          parts.push(`Moving up to: ${ev.graduated}`);
        });
        if (patternToUnlock) {
          const label = BASIC_LABELS[patternToUnlock] || patternToUnlock;
          parts.push(`New exercise added: ${label}`);
        }
        if (parts.length) {
          // Fire after this update settles rather than mid-render.
          setTimeout(() => {
            Alert.alert('Nice work', parts.join('\n\n'));
          }, 300);
        }

        return { ...h, exerciseState, unlockedPatterns };
      })
    );
    if (!alreadyDoneToday) doToggleToday(habit);
  }

  function handleMeditationComplete(holdSeconds) {
    try {
      return handleMeditationCompleteInner(holdSeconds);
    } catch (e) {
      Alert.alert("Session did not register", (e && e.message) || String(e));
    }
  }

  function handleMeditationCompleteInner(holdSeconds) {
    const habit = activeHabit;
    if (!habit) return;
    const alreadyDoneToday = habitDoneOn(habit, todayDateKey());

    // Streak counted including today, since this session is what makes
    // today count. Level up every 7 consecutive days.
    const withToday = {
      ...habit,
      doneDates: { ...(habit.doneDates || {}), [todayDateKey()]: true },
    };
    const streak = habitStreak(withToday);
    let level = habit.meditationLevel || 0;
    let base = habit.levelStreakBase || 0;
    // A broken streak never demotes you — it just restarts the count
    // toward the next level from wherever the streak now stands.
    if (streak < base) base = 0;
    if (streak - base >= DAYS_PER_LEVEL && level < MEDITATION_MAX_LEVEL) {
      level += 1;
      base = streak;
    }

    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id
          ? {
              ...h,
              meditationLevel: level,
              levelStreakBase: base,
              breathHoldHistory: [
                { date: todayDateKey(), seconds: holdSeconds },
                ...(h.breathHoldHistory || []),
              ].slice(0, 50),
            }
          : h
      )
    );
    if (!alreadyDoneToday) {
      doToggleToday(habit);
    }
  }

  const todayDow = new Date().getDay();
  const sorted = [...habits].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={shared.container}>
        <PageHeader theme={HABITS_THEME} title="Habits" />
        <Text style={shared.tagline}>
          Streaks, schedules, and content-linked habits in one place
        </Text>

        {sorted.length === 0 ? (
          <View style={shared.block}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: INK, marginBottom: 4 }}>
              No habits yet
            </Text>
            <Text style={shared.tagline}>Habits get added here one at a time as we build them.</Text>
          </View>
        ) : (
          sorted.map((h) => {
            const streak = habitStreak(h);
            const total = habitTotalCompletions(h);
            const doneToday = habitDoneOn(h, todayDateKey());
            const scheduledToday = habitScheduledOn(h, todayDow);
            return (
              <TouchableOpacity
                key={h.id}
                style={[styles.row, doneToday && styles.rowDone]}
                onPress={() => {
                  if (h.linkedContent && h.text !== 'Chess') {
                    setActiveHabitId(h.id);
                    setVideoOpen(true);
                  } else if (h.sessionType === 'workout') {
                    openSession(h, () => setWorkoutOpen(true));
                  } else if (h.sessionType === 'reading') {
                    setActiveHabitId(h.id);
                    setReadingOpen(true);
                  } else if (h.sessionType === 'cardistry') {
                    setDetailId(h.id);
                  } else if (h.sessionType === 'selfcare') {
                    setActiveHabitId(h.id);
                    setSelfCareOpen(true);
                  } else if (h.sessionType === 'breathing') {
                    openSession(h, openMeditationMenu);
                  } else {
                    setDetailId(h.id);
                  }
                }}
                onLongPress={videoOpen || meditationOpen ? undefined : () => setDetailId(h.id)}
                delayLongPress={400}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowText, doneToday && styles.rowTextDone]}>
                    {doneToday ? '✓ ' : ''}{h.text}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {habitDaysLabel(h)}
                    {h.time ? ` • ⏰ ${formatTimeDisplay(h.time)}` : ''}
                    {h.linkedContent ? ' • 🔗 linked' : ''}
                  </Text>
                  {!h.time ? (
                    <Text style={styles.noReminder}>
                      No reminder — long-press to set one
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.streakText}>
                    {streak > 0 ? `🔥 ${streak}` : `${total} logged`}
                  </Text>
                  {scheduledToday ? (
                    <Text style={[styles.todayBadge, doneToday && styles.todayBadgeDone]}>
                      {doneToday ? 'Done today' : 'Due today'}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Habit detail */}
      <Modal
        visible={!!detailHabit}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailId(null)}
      >
        {detailHabit ? (
          <View style={styles.modalOverlay}>
            <View style={styles.sheet}>
              <ScrollView>
                <Text style={styles.sheetTitle}>{detailHabit.text}</Text>
                <Text style={[shared.tagline, { marginTop: -8 }]}>
                  {habitDaysLabel(detailHabit)}
                  {detailHabit.time ? ` • ${formatTimeDisplay(detailHabit.time)}` : ''}
                </Text>

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statNum}>{habitStreak(detailHabit)}</Text>
                    <Text style={styles.statLabel}>day streak</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNum}>{habitTotalCompletions(detailHabit)}</Text>
                    <Text style={styles.statLabel}>total logged</Text>
                  </View>
                </View>

                <Text style={styles.label}>Reminder</Text>
                <TouchableOpacity style={styles.timeBtn} onPress={() => setShowTimePicker(true)}>
                  <Text style={styles.timeBtnText}>
                    {detailHabit.time ? formatTimeDisplay(detailHabit.time) : 'Set a reminder time'}
                  </Text>
                </TouchableOpacity>
                {detailHabit.time ? (
                  <TouchableOpacity
                    style={styles.clearTimeBtn}
                    onPress={() => setHabitTime(detailHabit, '')}
                  >
                    <Text style={styles.clearTimeBtnText}>Clear reminder</Text>
                  </TouchableOpacity>
                ) : null}
                {detailHabit.time && canSetPhoneAlarm() ? (
                  <>
                    <Text style={styles.alarmHint}>
                      A real alarm is set on your phone automatically for this
                      time - it rings properly rather than just pinging.
                    </Text>
                    <TouchableOpacity style={styles.clockLink} onPress={openPhoneClock}>
                      <Text style={styles.clockLinkText}>Manage alarms in Clock</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
                {showTimePicker ? (
                  <DateTimePicker
                    value={timeStringToDate(detailHabit.time)}
                    mode="time"
                    is24Hour={false}
                    onChange={(event, selectedDate) => {
                      setShowTimePicker(false);
                      if (event.type !== 'dismissed' && selectedDate) {
                        setHabitTime(detailHabit, dateToTimeString(selectedDate));
                      }
                    }}
                  />
                ) : null}

                {detailHabit.sessionType !== 'workout' ? (
                  <>
                <Text style={[styles.label, { marginTop: 20 }]}>Growing Target</Text>
                {(() => {
                  const growth = detailHabit.growth;
                  const isOn = growth && growth.enabled;
                  if (!isOn) {
                    return (
                      <>
                        <Text style={shared.tagline}>
                          Instead of a fixed goal, let the target climb as you actually complete
                          this habit — e.g. pushups starting at 10, +2 every 3 times you do it —
                          and nudge the pace up or down by how it actually felt.
                        </Text>
                        <TouchableOpacity style={styles.watchBtn} onPress={() => toggleGrowth(detailHabit)}>
                          <Text style={styles.watchBtnText}>⚡ Turn On (Auto)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openGrowthForm(detailHabit)} style={{ alignItems: 'center', paddingVertical: 10 }}>
                          <Text style={{ color: DIM, fontSize: 12 }}>Customize first</Text>
                        </TouchableOpacity>
                      </>
                    );
                  }
                  const completions = completionsSinceStart(detailHabit, growth);
                  const target = currentGrowthTarget(growth, completions);
                  const nextIn = completionsUntilNextStep(growth, completions);
                  const loggedToday = hasLoggedFeelToday(growth, todayDateKey());
                  return (
                    <>
                      <View style={styles.currentVideoCard}>
                        <Text style={styles.currentVideoLabel}>TODAY'S TARGET</Text>
                        <Text style={styles.currentVideoTitle}>
                          {target} {growth.unit}
                        </Text>
                        <Text style={styles.rankBlurb}>
                          +{growth.amount} every {growth.everyDays} completion{growth.everyDays === 1 ? '' : 's'} —
                          next step after {nextIn} more
                        </Text>
                      </View>
                      {loggedToday ? (
                        <Text style={styles.readingLinkNote}>Logged how today felt — pace updates from here.</Text>
                      ) : (
                        <>
                          <Text style={[styles.label, { marginTop: 12 }]}>How did today feel?</Text>
                          <View style={{ flexDirection: 'row' }}>
                            <TouchableOpacity
                              style={styles.feelBtn}
                              onPress={() => logFeel(detailHabit, 'easy')}
                            >
                              <Text style={styles.feelBtnText}>Too Easy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.feelBtn}
                              onPress={() => logFeel(detailHabit, 'ok')}
                            >
                              <Text style={styles.feelBtnText}>Just Right</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.feelBtn}
                              onPress={() => logFeel(detailHabit, 'hard')}
                            >
                              <Text style={styles.feelBtnText}>Too Hard</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                      {(growth.log || []).length ? (
                        <>
                          <Text style={[styles.label, { marginTop: 16 }]}>Recent</Text>
                          {growth.log.slice(0, 5).map((e, i) => (
                            <View key={i} style={styles.historyRow}>
                              <Text style={styles.historyDate}>{e.date}</Text>
                              <Text style={styles.historySeconds}>
                                {e.target} {growth.unit} · {e.feel === 'easy' ? 'Too Easy' : e.feel === 'hard' ? 'Too Hard' : 'Just Right'}
                              </Text>
                            </View>
                          ))}
                        </>
                      ) : null}
                      <View style={{ flexDirection: 'row', marginTop: 12 }}>
                        <TouchableOpacity onPress={() => openGrowthForm(detailHabit)} style={{ marginRight: 20 }}>
                          <Text style={styles.clearTimeBtnText}>Edit growth settings</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => toggleGrowth(detailHabit)}>
                          <Text style={[styles.clearTimeBtnText, { color: ROSE }]}>Turn off</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  );
                })()}
                {growthFormOpen ? (
                  <View style={styles.growthFormCard}>
                    <Text style={styles.label}>Starting value</Text>
                    <TextInput
                      style={styles.growthInput}
                      value={growthDraft.startValue}
                      onChangeText={(v) => setGrowthDraft((d) => ({ ...d, startValue: v }))}
                      keyboardType="numeric"
                      placeholder="10"
                      placeholderTextColor={DIM}
                    />
                    <Text style={styles.label}>Grows by</Text>
                    <TextInput
                      style={styles.growthInput}
                      value={growthDraft.amount}
                      onChangeText={(v) => setGrowthDraft((d) => ({ ...d, amount: v }))}
                      keyboardType="numeric"
                      placeholder="2"
                      placeholderTextColor={DIM}
                    />
                    <Text style={styles.label}>Every X days</Text>
                    <TextInput
                      style={styles.growthInput}
                      value={growthDraft.everyDays}
                      onChangeText={(v) => setGrowthDraft((d) => ({ ...d, everyDays: v }))}
                      keyboardType="numeric"
                      placeholder="3"
                      placeholderTextColor={DIM}
                    />
                    <Text style={styles.label}>Unit</Text>
                    <TextInput
                      style={styles.growthInput}
                      value={growthDraft.unit}
                      onChangeText={(v) => setGrowthDraft((d) => ({ ...d, unit: v }))}
                      placeholder="reps, minutes, pages..."
                      placeholderTextColor={DIM}
                    />
                    <TouchableOpacity style={styles.watchBtn} onPress={() => saveGrowthSettings(detailHabit)}>
                      <Text style={styles.watchBtnText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={() => setGrowthFormOpen(false)}>
                      <Text style={{ color: DIM, fontSize: 13 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                  </>
                ) : null}

                {detailHabit.linkedContent || detailHabit.sessionType === 'breathing' || detailHabit.sessionType === 'workout' || detailHabit.sessionType === 'selfcare' || detailHabit.sessionType === 'reading' ? (
                  <Text style={styles.autoStatusText}>
                    {habitDoneOn(detailHabit, todayDateKey())
                      ? `✓ Done today — tracked automatically from ${
                          detailHabit.linkedContent ? 'watching' : 'your session'
                        }`
                      : `Not done yet today — ${
                          detailHabit.linkedContent
                            ? 'watch the video below to complete it'
                            : 'complete a session below to finish it'
                        }`}
                  </Text>
                ) : null}

                {detailHabit.sessionType === 'reading' ? (
                  <>
                    <Text style={[styles.label, { marginTop: 20 }]}>Your Shelf</Text>
                    {(detailHabit.books || []).length ? (
                      <View style={styles.currentVideoCard}>
                        <Text style={styles.currentVideoLabel}>
                          {detailHabit.books.length}{' '}
                          {detailHabit.books.length === 1 ? 'BOOK' : 'BOOKS'}
                        </Text>
                        <Text style={styles.currentVideoTitle} numberOfLines={2}>
                          {(() => {
                            const active = [...detailHabit.books].sort(
                              (a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0)
                            )[0];
                            return `Most recent: ${active.name} — ${bookProgressPct(active)}%`;
                          })()}
                        </Text>
                      </View>
                    ) : (
                      <Text style={shared.tagline}>
                        Nothing on the shelf yet — open it and add a book or audiobook.
                      </Text>
                    )}
                    <TouchableOpacity
                      style={styles.watchBtn}
                      onPress={() => {
                        setActiveHabitId(detailHabit.id);
                        setDetailId(null);
                        setReadingOpen(true);
                      }}
                    >
                      <Text style={styles.watchBtnText}>
                        {(detailHabit.books || []).length
                          ? '📚 Open Bookshelf'
                          : '📚 Add a Book'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : detailHabit.sessionType === 'cardistry' ? (
                  <>
                    {(() => {
                      const mastered = detailHabit.mastered || {};
                      const cardCollegeBook = (
                        habits.find((h) => h.sessionType === 'reading')?.books || []
                      ).find((b) => (b.name || '').toLowerCase().includes('card college'));
                      const readingChapter = cardCollegeBook
                        ? chapterForPage(cardCollegeBook.page)
                        : null;
                      const curIdx = currentRankIndex(mastered);
                      const cur = CARDISTRY_RANKS[curIdx];
                      const curP = rankProgress(cur, mastered);
                      const totalDone = CARDISTRY_RANKS.reduce(
                        (n, r) => n + rankProgress(r, mastered).done,
                        0
                      );
                      const totalAll = CARDISTRY_RANKS.reduce((n, r) => n + r.techniques.length, 0);
                      return (
                        <>
                          <Text style={[styles.label, { marginTop: 20 }]}>Current Rank</Text>
                          <View style={styles.currentVideoCard}>
                            <Text style={styles.currentVideoLabel}>
                              {cur.volume.toUpperCase()}
                            </Text>
                            <Text style={styles.currentVideoTitle}>{cur.name}</Text>
                            <Text style={styles.rankBlurb}>{cur.blurb}</Text>
                          </View>
                          {readingChapter ? (
                            <Text style={styles.readingLinkNote}>
                              📖 Your shelf has you at page {cardCollegeBook.page} —{' '}
                              {readingChapter.id === cur.id
                                ? "right in this chapter's material."
                                : `that's ${readingChapter.name} (Chapter ${readingChapter.volume.split('Chapter ')[1]}).`}
                            </Text>
                          ) : null}
                          <View style={styles.levelBarTrack}>
                            <View
                              style={[
                                styles.levelBarFill,
                                { width: `${Math.round((curP.done / curP.total) * 100)}%` },
                              ]}
                            />
                          </View>
                          <Text style={styles.levelBarMeta}>
                            {curP.done}/{curP.total} in this rank - {totalDone}/{totalAll} overall
                          </Text>

                          <Text style={[styles.label, { marginTop: 20 }]}>Techniques</Text>
                          {CARDISTRY_RANKS.map((rank, ri) => {
                            const unlocked = isRankUnlocked(ri, mastered);
                            const rp = rankProgress(rank, mastered);
                            const expanded = openRankId === rank.id;
                            return (
                              <View key={rank.id} style={styles.rankBlock}>
                                <TouchableOpacity
                                  style={styles.rankHead}
                                  onPress={() => setOpenRankId(expanded ? null : rank.id)}
                                >
                                  <Text style={styles.rankLock}>
                                    {unlocked ? (rp.complete ? '✅' : '▸') : '🔒'}
                                  </Text>
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.rankName, !unlocked && styles.rankLocked]}>
                                      {rank.name}
                                    </Text>
                                    <Text style={styles.rankVolume}>{rank.volume}</Text>
                                  </View>
                                  <Text style={styles.rankCount}>
                                    {rp.done}/{rp.total}
                                  </Text>
                                </TouchableOpacity>
                                {expanded ? (
                                  unlocked ? (
                                    rank.techniques.map((t, ti) => {
                                      const done = !!mastered[t.id];
                                      const techLocked =
                                        ti > 0 && !mastered[rank.techniques[ti - 1].id];
                                      const techOpen = openTechId === t.id;
                                      const photo = (detailHabit.techniquePhotos || {})[t.id];

                                      if (techLocked) {
                                        return (
                                          <View key={t.id} style={styles.techRow}>
                                            <Text style={styles.techLockIcon}>🔒</Text>
                                            <View style={{ flex: 1 }}>
                                              <Text style={styles.techNameLocked}>{t.name}</Text>
                                              <Text style={styles.techNote}>
                                                Master "{rank.techniques[ti - 1].name}" first
                                              </Text>
                                            </View>
                                          </View>
                                        );
                                      }

                                      return (
                                        <View key={t.id}>
                                          <View style={styles.techRow}>
                                            <View
                                              style={[styles.checkbox, done && styles.checkboxDone]}
                                            >
                                              {done ? <Text style={styles.checkMark}>✓</Text> : null}
                                            </View>
                                            <TouchableOpacity
                                              style={{ flex: 1 }}
                                              onPress={() => {
                                                if (done) {
                                                  setOpenTechId(techOpen ? null : t.id);
                                                } else {
                                                  setPracticeTech({ habit: detailHabit, technique: t });
                                                }
                                              }}
                                            >
                                              <Text style={[styles.techName, done && styles.techNameDone]}>
                                                {t.name}
                                              </Text>
                                              <Text style={styles.techNote}>
                                                {done
                                                  ? t.note || `p.${t.page}`
                                                  : 'Tap to start a 5-minute practice session'}
                                                {done && t.note ? ` · p.${t.page}` : ''}
                                              </Text>
                                            </TouchableOpacity>
                                          </View>

                                          {techOpen && done ? (
                                            <View style={styles.techBody}>
                                              {t.video ? (
                                                <LessonVideo
                                                  video={t.video}
                                                  watched={false}
                                                  onWatched={() => {}}
                                                />
                                              ) : null}
                                              {(t.steps || []).map((st, si) => (
                                                <View key={si} style={styles.stepRow}>
                                                  <Text style={styles.stepNum}>{si + 1}</Text>
                                                  <Text style={styles.stepText}>{st}</Text>
                                                </View>
                                              ))}

                                              {photo ? (
                                                <>
                                                  <Image
                                                    source={{ uri: photo }}
                                                    style={styles.techPhoto}
                                                    resizeMode="contain"
                                                  />
                                                  <TouchableOpacity
                                                    onPress={() =>
                                                      removeTechniquePhoto(detailHabit, t.id)
                                                    }
                                                  >
                                                    <Text style={styles.photoRemove}>
                                                      Remove photo
                                                    </Text>
                                                  </TouchableOpacity>
                                                </>
                                              ) : (
                                                <TouchableOpacity
                                                  style={styles.photoBtn}
                                                  onPress={() =>
                                                    attachTechniquePhoto(detailHabit, t.id)
                                                  }
                                                >
                                                  <Text style={styles.photoBtnText}>
                                                    📷 Add a reference photo
                                                  </Text>
                                                </TouchableOpacity>
                                              )}
                                            </View>
                                          ) : null}
                                        </View>
                                      );
                                    })
                                  ) : (
                                    <Text style={styles.rankLockedMsg}>
                                      Finish every technique in {CARDISTRY_RANKS[ri - 1].name} first
                                      - each rank assumes the handling from the one before.
                                    </Text>
                                  )
                                ) : null}
                              </View>
                            );
                          })}
                        </>
                      );
                    })()}
                  </>
                ) : detailHabit.sessionType === 'selfcare' ? (
                  <>
                    <Text style={[styles.label, { marginTop: 20 }]}>Steps</Text>
                    {(detailHabit.steps || []).length === 0 ? (
                      <Text style={shared.tagline}>No steps yet.</Text>
                    ) : (
                      detailHabit.steps.map((st, i) => (
                        <View key={st.id || i} style={styles.historyRow}>
                          <Text style={styles.historyDate}>
                            {i + 1}. {st.text}
                          </Text>
                          {st.minutes ? (
                            <Text style={styles.historySeconds}>{st.minutes}m</Text>
                          ) : null}
                        </View>
                      ))
                    )}
                    <TouchableOpacity
                      style={styles.watchBtn}
                      onPress={() => {
                        setActiveHabitId(detailHabit.id);
                        setDetailId(null);
                        setSelfCareOpen(true);
                      }}
                    >
                      <Text style={styles.watchBtnText}>✨ Begin Routine</Text>
                    </TouchableOpacity>

                    <Text style={[styles.label, { marginTop: 20 }]}>Tracker</Text>
                    {(() => {
                      const log = detailHabit.selfCareLog || [];
                      if (!log.length) {
                        return (
                          <Text style={shared.tagline}>
                            Run the routine and each session gets logged here with
                            how much of it you actually finished.
                          </Text>
                        );
                      }
                      const full = log.filter((e) => e.total && e.steps.length >= e.total).length;
                      return (
                        <>
                          <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                              <Text style={styles.statNum}>{log.length}</Text>
                              <Text style={styles.statLabel}>sessions</Text>
                            </View>
                            <View style={styles.statBox}>
                              <Text style={styles.statNum}>{full}</Text>
                              <Text style={styles.statLabel}>fully completed</Text>
                            </View>
                          </View>
                          {log.slice(0, 7).map((e, i) => (
                            <View key={i} style={styles.historyRow}>
                              <Text style={styles.historyDate}>{e.date}</Text>
                              <Text style={styles.historySeconds}>
                                {e.steps.length}/{e.total || '?'} steps
                              </Text>
                            </View>
                          ))}
                        </>
                      );
                    })()}
                  </>
                ) : detailHabit.sessionType === 'workout' ? (
                  <>
                    <View style={{ height: 1, backgroundColor: BORDER, marginVertical: 16 }} />
                    <Text style={[styles.label, { marginTop: 0 }]}>Today's Session</Text>
                    <Text style={styles.readingLinkNote}>
                      One exercise at a time - start at 1, grow by 1 each session. 100 total reps
                      earns the next variation (or the next exercise).
                    </Text>
                    {(() => {
                      const unlocked = detailHabit.unlockedPatterns && detailHabit.unlockedPatterns.length
                        ? detailHabit.unlockedPatterns
                        : defaultUnlockedPatterns();
                      const stateMap = normalizeExerciseState(detailHabit.exerciseState);
                      return unlocked.map((key) => {
                        const state = stateMap[key];
                        const stage = currentStage(key, state.stageIndex);
                        const unit = stage.mode === 'time' ? 's' : ' reps';
                        return (
                          <View key={key} style={styles.currentVideoCard}>
                            <Text style={styles.currentVideoLabel}>{(BASIC_LABELS[key] || key).toUpperCase()}</Text>
                            <Text style={styles.currentVideoTitle}>{stage.name}</Text>
                            <Text style={styles.rankBlurb}>
                              {state.target}{unit} today · {state.cumulative}/{REP_UNLOCK_THRESHOLD} toward next
                            </Text>
                          </View>
                        );
                      });
                    })()}

                    <TouchableOpacity
                      style={{ alignItems: 'center', paddingVertical: 10, marginTop: 10 }}
                      onPress={() => setRoadmapOpen((r) => !r)}
                    >
                      <Text style={styles.clearTimeBtnText}>
                        {roadmapOpen ? 'Hide full progression' : 'See every variation, per pattern'}
                      </Text>
                    </TouchableOpacity>
                    {roadmapOpen ? (
                      <View style={styles.growthFormCard}>
                        {(() => {
                          const stateMap = normalizeExerciseState(detailHabit.exerciseState);
                          const sections = [...BASIC_ORDER, ...OPTIONAL_KEYS].map((key) => ({
                            key,
                            list: TRACKS[key] || CORE_TRACKS[key],
                            state: stateMap[key],
                          }));
                          return sections.map(({ key, list, state }) => (
                            <View key={key} style={{ marginBottom: 14 }}>
                              <Text style={styles.label}>{BASIC_LABELS[key] || key}</Text>
                              {list.map((stg, i) => (
                                <View key={stg.id} style={styles.historyRow}>
                                  <Text style={styles.historyDate}>
                                    {i + 1}. {stg.name}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.historySeconds,
                                      i === state.stageIndex ? { color: GOLD } : null,
                                    ]}
                                  >
                                    {i === state.stageIndex
                                      ? `Current — ${state.target}${stg.mode === 'time' ? 's' : ' reps'}`
                                      : i < state.stageIndex
                                      ? 'Already past'
                                      : 'Not yet'}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ));
                        })()}
                      </View>
                    ) : null}

                    <View style={styles.statsRow}>
                      <View style={styles.statBox}>
                        <Text style={styles.statNum}>
                          {(bodyWorkouts || []).filter((w) => (w.title || '').includes('(Guided)')).length}
                        </Text>
                        <Text style={styles.statLabel}>sessions logged</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.watchBtn}
                      onPress={() => {
                        setActiveHabitId(detailHabit.id);
                        setDetailId(null);
                        setWorkoutOpen(true);
                      }}
                    >
                      <Text style={styles.watchBtnText}>🏋️ Begin Workout</Text>
                    </TouchableOpacity>

                    <View style={{ height: 1, backgroundColor: BORDER, marginVertical: 16 }} />

                    <Text style={styles.label}>Advanced</Text>
                    <TouchableOpacity
                      style={{ alignItems: 'center', paddingVertical: 8 }}
                      onPress={() => setOptionalOpen((o) => !o)}
                    >
                      <Text style={styles.clearTimeBtnText}>
                        {optionalOpen ? 'Hide optional exercises' : "Once you're ready (Pull, Hinge, Row)"}
                      </Text>
                    </TouchableOpacity>
                    {optionalOpen ? (
                      <View style={styles.growthFormCard}>
                        <Text style={styles.readingLinkNote}>
                          Real skills of their own - kept out of the automatic path since you're
                          after the basics for now. Turn on whenever you're ready.
                        </Text>
                        {OPTIONAL_KEYS.map((key) => {
                          const on = (detailHabit.unlockedPatterns || []).includes(key);
                          return (
                            <TouchableOpacity
                              key={key}
                              style={styles.optionalRow}
                              onPress={() => toggleOptionalPattern(detailHabit, key)}
                            >
                              <Text style={styles.optionalRowText}>{BASIC_LABELS[key]}</Text>
                              <Text style={[styles.optionalRowToggle, on && { color: GOLD }]}>
                                {on ? 'On' : 'Off'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={{ alignItems: 'center', paddingVertical: 8 }}
                      onPress={() => (exerciseEditOpen ? setExerciseEditOpen(false) : openExerciseEdit(detailHabit))}
                    >
                      <Text style={styles.clearTimeBtnText}>
                        {exerciseEditOpen ? 'Close exercise editor' : 'Edit exercise numbers'}
                      </Text>
                    </TouchableOpacity>
                    {exerciseEditOpen ? (
                      <View style={styles.growthFormCard}>
                        <Text style={styles.readingLinkNote}>
                          Override today's target for any exercise.
                        </Text>
                        {exerciseBlocksDraft.map((b) => (
                          <View key={b.name} style={{ marginTop: 14 }}>
                            <Text style={styles.label}>
                              {b.name} {b.mode === 'time' ? '(seconds)' : '(reps)'}
                            </Text>
                            <TextInput
                              style={styles.growthInput}
                              value={exerciseDraft[b.name] || ''}
                              onChangeText={(v) => setExerciseDraft((d) => ({ ...d, [b.name]: v }))}
                              keyboardType="numeric"
                              placeholderTextColor={DIM}
                            />
                          </View>
                        ))}
                        <TouchableOpacity
                          style={[styles.watchBtn, { marginTop: 16 }]}
                          onPress={() => saveExerciseEdits(detailHabit)}
                        >
                          <Text style={styles.watchBtnText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ alignItems: 'center', paddingVertical: 10 }}
                          onPress={() => resetExerciseEdits(detailHabit)}
                        >
                          <Text style={[styles.clearTimeBtnText, { color: ROSE }]}>Reset to defaults</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </>
                ) : detailHabit.sessionType === 'breathing' ? (
                  <>
                    <Text style={[styles.label, { marginTop: 20 }]}>Progression</Text>
                    {(() => {
                      const lvl = detailHabit.meditationLevel || 0;
                      const spec = meditationLevelSpec(lvl);
                      const streak = habitStreak(detailHabit);
                      const base = detailHabit.levelStreakBase || 0;
                      const into = Math.max(0, Math.min(DAYS_PER_LEVEL, streak - base));
                      const pct = Math.round((into / DAYS_PER_LEVEL) * 100);
                      return (
                        <>
                          <View style={styles.currentVideoCard}>
                            <Text style={styles.currentVideoLabel}>
                              LEVEL {lvl + 1} OF {MEDITATION_MAX_LEVEL + 1}
                            </Text>
                            <Text style={styles.currentVideoTitle}>
                              {meditationLevelLabel(lvl)}
                            </Text>
                          </View>
                          {spec.isMax ? (
                            <Text style={styles.autoStatusText}>
                              Top level - 30 breaths x 3 rounds
                            </Text>
                          ) : (
                            <>
                              <View style={styles.levelBarTrack}>
                                <View style={[styles.levelBarFill, { width: `${pct}%` }]} />
                              </View>
                              <Text style={styles.levelBarMeta}>
                                {into}/{DAYS_PER_LEVEL} days toward{' '}
                                {meditationLevelLabel(lvl + 1)}
                              </Text>
                            </>
                          )}
                        </>
                      );
                    })()}

                    <Text style={[styles.label, { marginTop: 20 }]}>Breath Hold Tracker</Text>
                    {(() => {
                      const history = detailHabit.breathHoldHistory || [];
                      const best = history.length
                        ? Math.max(...history.map((h) => h.seconds))
                        : 0;
                      return (
                        <>
                          <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                              <Text style={styles.statNum}>{best}s</Text>
                              <Text style={styles.statLabel}>personal best</Text>
                            </View>
                            <View style={styles.statBox}>
                              <Text style={styles.statNum}>{history.length}</Text>
                              <Text style={styles.statLabel}>sessions logged</Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            style={styles.watchBtn}
                            onPress={() => {
                              setActiveHabitId(detailHabit.id);
                              setDetailId(null);
                              openMeditationMenu();
                            }}
                          >
                            <Text style={styles.watchBtnText}>🧘 Begin Session</Text>
                          </TouchableOpacity>
                          {history.slice(0, 5).map((entry, i) => (
                            <View key={i} style={styles.historyRow}>
                              <Text style={styles.historyDate}>{entry.date}</Text>
                              <Text style={styles.historySeconds}>{entry.seconds}s</Text>
                            </View>
                          ))}
                        </>
                      );
                    })()}

                    <MeditationGrowthGraph habit={detailHabit} />
                  </>
                ) : detailHabit.text === 'Chess' ? (
                  <>
                    <Text style={[styles.label, { marginTop: 20 }]}>Lessons</Text>
                    {(() => {
                      const chessMastered = detailHabit.chessLessons || {};
                      const prog = chessLessonProgress(chessMastered);
                      const next = nextChessLesson(chessMastered);
                      return (
                        <>
                          <View style={styles.currentVideoCard}>
                            <Text style={styles.currentVideoLabel}>
                              {prog.done} OF {prog.total} LESSONS
                            </Text>
                            <Text style={styles.currentVideoTitle}>
                              {next ? `Next: ${next.title}` : 'All lessons complete'}
                            </Text>
                          </View>

                          {next ? (
                            <TouchableOpacity
                              style={styles.watchBtn}
                              onPress={() => {
                                setActiveHabitId(detailHabit.id);
                                setDetailId(null);
                                setChessLessonId(next.id);
                              }}
                            >
                              <Text style={styles.watchBtnText}>
                                {next.icon} Continue: {next.title}
                              </Text>
                            </TouchableOpacity>
                          ) : null}

                          <View style={styles.lessonListBox}>
                            {CHESS_LESSONS.map((l, li) => {
                              const done = !!chessMastered[l.id];
                              const locked = li > 0 && !chessMastered[CHESS_LESSONS[li - 1].id];
                              return (
                                <TouchableOpacity
                                  key={l.id}
                                  style={styles.lessonRow}
                                  disabled={locked}
                                  onPress={() => {
                                    setActiveHabitId(detailHabit.id);
                                    setDetailId(null);
                                    setChessLessonId(l.id);
                                  }}
                                >
                                  <Text style={styles.lessonMark}>
                                    {done ? '✓' : locked ? '🔒' : l.icon}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.lessonName,
                                      done && styles.lessonNameDone,
                                      locked && styles.lessonNameLocked,
                                    ]}
                                  >
                                    {l.title}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          <TouchableOpacity
                            style={[styles.watchBtn, styles.boardBtn]}
                            onPress={() => {
                              setActiveHabitId(detailHabit.id);
                              setDetailId(null);
                              setChessOpen(true);
                            }}
                          >
                            <Text style={[styles.watchBtnText, styles.boardBtnText]}>
                              ♟ Free Play (open board, no lesson)
                            </Text>
                          </TouchableOpacity>
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <Text style={[styles.label, { marginTop: 20 }]}>Linked Content</Text>
                    {detailHabit.linkedContent ? (
                      <>
                        <View style={styles.currentVideoCard}>
                          <Text style={styles.currentVideoLabel}>
                            Video {detailHabit.linkedContent.progressIndex + 1} of{' '}
                            {detailHabit.linkedContent.items.length}
                          </Text>
                          <Text style={styles.currentVideoTitle} numberOfLines={2}>
                            {detailHabit.linkedContent.items[detailHabit.linkedContent.progressIndex].title}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.watchBtn}
                          onPress={() => {
                            setActiveHabitId(detailHabit.id);
                            setDetailId(null);
                            setVideoOpen(true);
                          }}
                        >
                          <Text style={styles.watchBtnText}>
                            ▶ Watch Today's Video (5 min counts as done)
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity style={styles.linkBtn} onPress={openLinkPlaylist}>
                        <Text style={styles.linkBtnText}>🔗 Link a YouTube Playlist</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}

                <TouchableOpacity style={styles.cancelBtn} onPress={() => setDetailId(null)}>
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        ) : (
          <View />
        )}
      </Modal>

      {/* Link playlist */}
      <Modal
        visible={linkOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setLinkOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Link a Playlist</Text>
            <Text style={[shared.tagline, { marginTop: -8 }]}>
              Only the first video starts unlocked — each one unlocks the
              next once you've watched 5 real minutes of it.
            </Text>
            <TextInput
              style={styles.input}
              value={linkUrl}
              onChangeText={setLinkUrl}
              placeholder="https://youtube.com/playlist?list=..."
              placeholderTextColor="#9aa5b1"
              autoCapitalize="none"
            />
            {linkError ? <Text style={styles.linkError}>{linkError}</Text> : null}
            <TouchableOpacity style={styles.saveBtn} disabled={linkLoading} onPress={fetchAndLink}>
              <Text style={styles.saveBtnText}>
                {linkLoading ? 'Fetching...' : 'Fetch & Link'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setLinkOpen(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Video player */}
      <Modal
        visible={videoOpen}
        animationType="slide"
        onRequestClose={closeVideo}
      >
        <View style={styles.videoScreen}>
          {activeHabit?.linkedContent ? (
            <HabitVideoPlayer
              key={activeHabit.linkedContent.items[activeHabit.linkedContent.progressIndex].videoId}
              videoId={activeHabit.linkedContent.items[activeHabit.linkedContent.progressIndex].videoId}
              requiredSeconds={300}
              initialWatched={
                activeHabit.linkedContent.watchedDate === todayDateKey()
                  ? activeHabit.linkedContent.watchedSeconds || 0
                  : 0
              }
              onProgress={(seconds) => {
                setHabits((prev) =>
                  prev.map((h) =>
                    h.id === activeHabit.id
                      ? {
                          ...h,
                          linkedContent: {
                            ...h.linkedContent,
                            watchedSeconds: seconds,
                            watchedDate: todayDateKey(),
                          },
                        }
                      : h
                  )
                );
              }}
              onComplete={handleVideoComplete}
            />
          ) : null}
          <TouchableOpacity
            style={styles.videoFloatingClose}
            onPress={closeVideo}
          >
            <Text style={styles.videoCloseX}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Guided workout session */}
      <Modal
        visible={workoutOpen}
        animationType="slide"
        onRequestClose={() => setWorkoutOpen(false)}
      >
        {workoutOpen && activeHabit ? (
          <GuidedWorkoutSession
            key={`${activeHabitId}-${JSON.stringify(activeHabit.exerciseState)}-${JSON.stringify(activeHabit.unlockedPatterns)}`}
            template={buildWorkoutTemplate(activeHabit).template}
            onComplete={handleWorkoutComplete}
            onExit={() => setWorkoutOpen(false)}
            sessionDifficulty={sessionDifficulty[activeHabitId] || null}
          />
        ) : null}
      </Modal>

      {/* Chess board */}
      <Modal visible={chessOpen} animationType="slide" onRequestClose={() => setChessOpen(false)}>
        {chessOpen ? (
          <ChessBoard
            onSessionDone={() => {
              if (activeHabit && !habitDoneOn(activeHabit, todayDateKey())) {
                doToggleToday(activeHabit);
              }
            }}
            onExit={() => setChessOpen(false)}
          />
        ) : null}
      </Modal>

      {/* Reading */}
      <Modal
        visible={readingOpen}
        animationType="slide"
        onRequestClose={() => setReadingOpen(false)}
      >
        {readingOpen && activeHabit ? (
          <BookShelf
            key={activeHabitId}
            habit={activeHabit}
            onUpdateBooks={(books) =>
              setHabits((prev) =>
                prev.map((h) => (h.id === activeHabit.id ? { ...h, books } : h))
              )
            }
            onComplete={() => {
              if (!habitDoneOn(activeHabit, todayDateKey())) doToggleToday(activeHabit);
            }}
            onExit={() => setReadingOpen(false)}
          />
        ) : null}
      </Modal>

      {/* Cardistry practice session - 5 minutes forced, then mastered/exit */}
      <Modal
        visible={!!practiceTech}
        animationType="slide"
        onRequestClose={() => setPracticeTech(null)}
      >
        {practiceTech ? (
          <CardistryPracticeSession
            key={practiceTech.technique.id}
            technique={practiceTech.technique}
            onMastered={() => {
              markTechniqueMastered(practiceTech.habit, practiceTech.technique.id);
              if (!habitDoneOn(practiceTech.habit, todayDateKey())) {
                doToggleToday(practiceTech.habit);
              }
              setPracticeTech(null);
            }}
            onExit={() => {
              if (!habitDoneOn(practiceTech.habit, todayDateKey())) {
                doToggleToday(practiceTech.habit);
              }
              setPracticeTech(null);
            }}
          />
        ) : null}
      </Modal>

      {/* Chess lesson - reuses the real board, gated by a small move count */}
      <Modal
        visible={!!chessLessonId}
        animationType="slide"
        onRequestClose={() => setChessLessonId(null)}
      >
        {chessLessonId && activeHabit ? (
          <ChessLessonSession
            key={chessLessonId}
            lesson={CHESS_LESSONS.find((l) => l.id === chessLessonId)}
            onComplete={() => {
              setHabits((prev) =>
                prev.map((h) =>
                  h.id === activeHabit.id
                    ? { ...h, chessLessons: { ...(h.chessLessons || {}), [chessLessonId]: true } }
                    : h
                )
              );
              if (!habitDoneOn(activeHabit, todayDateKey())) doToggleToday(activeHabit);
              setChessLessonId(null);
            }}
            onExit={() => {
              if (!habitDoneOn(activeHabit, todayDateKey())) doToggleToday(activeHabit);
              setChessLessonId(null);
            }}
          />
        ) : null}
      </Modal>

      {/* Self care routine */}
      <Modal
        visible={selfCareOpen}
        animationType="slide"
        onRequestClose={() => setSelfCareOpen(false)}
      >
        {selfCareOpen && activeHabit ? (
          <SelfCareSession
            key={activeHabitId}
            routine={activeHabit}
            onComplete={(completedStepIds) => {
              setHabits((prev) =>
                prev.map((h) =>
                  h.id === activeHabit.id
                    ? {
                        ...h,
                        selfCareLog: [
                          {
                            date: todayDateKey(),
                            steps: completedStepIds || [],
                            total: (h.steps || []).length,
                          },
                          ...(h.selfCareLog || []).filter((e) => e.date !== todayDateKey()),
                        ].slice(0, 60),
                      }
                    : h
                )
              );
              if (!habitDoneOn(activeHabit, todayDateKey())) doToggleToday(activeHabit);
            }}
            onExit={() => setSelfCareOpen(false)}
          />
        ) : null}
      </Modal>

      {/* Meditation: menu (style/background/sound/voice) first, then the
          matching session. "Rather than jumping to [one method]... this
          way depending on my mood im not stuck to one form" - picked
          fresh each time, with the last choice pre-selected via
          activeHabit.meditationChoice as a convenience default. */}
      <Modal
        visible={meditationOpen}
        animationType="slide"
        onRequestClose={() => setMeditationOpen(false)}
      >
        <View style={styles.videoScreen}>
          {meditationStage === 'session' ? (
            <View style={styles.videoHeader}>
              <Text style={styles.videoHeaderTitle}>Meditation</Text>
              <TouchableOpacity onPress={() => setMeditationOpen(false)}>
                <Text style={styles.videoCloseX}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {meditationOpen && meditationStage === 'menu' ? (
            <MeditationMenu
              levelIndex={activeHabit ? activeHabit.meditationLevel || 0 : 0}
              initial={(activeHabit && activeHabit.meditationChoice) || meditationChoice}
              onBegin={(choice) => {
                setMeditationChoice(choice);
                if (activeHabit) {
                  setHabits((prev) =>
                    prev.map((h) => (h.id === activeHabit.id ? { ...h, meditationChoice: choice } : h))
                  );
                }
                setMeditationStage('session');
              }}
              onClose={() => setMeditationOpen(false)}
            />
          ) : null}

          {meditationOpen && meditationStage === 'session' && meditationChoice ? (
            (() => {
              const background = meditationBackgroundById(meditationChoice.backgroundId);
              const streakInfo = activeHabit
                ? {
                    daysToNext: Math.max(
                      1,
                      DAYS_PER_LEVEL -
                        (habitStreak(activeHabit) - (activeHabit.levelStreakBase || 0))
                    ),
                  }
                : null;
              const levelIndex = activeHabit ? activeHabit.meditationLevel || 0 : 0;
              const sharedProps = {
                settings: meditationSettings,
                levelIndex,
                background,
                soundId: meditationChoice.soundId,
                voiceOn: meditationChoice.voiceOn,
                onComplete: (metricSeconds) => handleMeditationComplete(metricSeconds),
              };
              if (meditationChoice.styleId === 'box') {
                return <BoxBreathingSession key={activeHabitId} {...sharedProps} />;
              }
              if (meditationChoice.styleId === 'bodyscan') {
                return <BodyScanSession key={activeHabitId} {...sharedProps} />;
              }
              return <MeditationSession key={activeHabitId} {...sharedProps} streakInfo={streakInfo} />;
            })()
          ) : null}
        </View>
      </Modal>

      <MoodCheckIn
        visible={!!moodGate}
        habitText={moodGate ? moodGate.habit.text : ''}
        onSelect={resolveMood}
        onCancel={skipMood}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  optionalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  optionalRowText: { color: INK, fontSize: 14.5, fontWeight: '600' },
  optionalRowToggle: { color: DIM, fontSize: 13, fontWeight: '700' },
  paceChip: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  paceChipActive: { backgroundColor: GOLD, borderColor: GOLD },
  paceChipText: { color: DIM, fontSize: 13, fontWeight: '700' },
  paceChipTextActive: { color: '#1a1512' },
  feelBtn: {
    flex: 1,
    backgroundColor: '#1f1a15',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 10,
    marginRight: 8,
    alignItems: 'center',
  },
  feelBtnText: { color: INK, fontSize: 12, fontWeight: '700' },
  growthFormCard: { marginTop: 12, marginBottom: 8 },
  growthInput: {
    backgroundColor: '#1f1a15',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: INK,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  rowText: { fontSize: 15, fontWeight: '600', color: INK },
  rowMeta: { fontSize: 11, color: DIM, marginTop: 3 },
  // Completed habits stay visible but visibly spent, so it's
  // obvious at a glance what's already been done today.
  rowDone: { opacity: 0.45 },
  rowTextDone: { color: DIM, textDecorationLine: 'line-through' },
  noReminder: { fontSize: 11, color: ROSE, marginTop: 3, fontWeight: '600' },
  alarmBtn: {
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  alarmBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  alarmHint: { color: DIM, fontSize: 11, marginTop: 8, lineHeight: 16 },
  clockLink: { alignItems: 'center', paddingVertical: 8 },
  clockLinkText: { color: GOLD, fontSize: 12, fontWeight: '600' },
  streakText: { fontSize: 12, fontWeight: '700', color: GOLD },
  todayBadge: { fontSize: 10, color: DIM, marginTop: 4, fontWeight: '600' },
  todayBadgeDone: { color: '#2e9e5b' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: INK, marginBottom: 6 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 16 },
  statBox: {
    flex: 1,
    backgroundColor: '#232d3a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statNum: { fontSize: 22, fontWeight: '800', color: INK },
  statLabel: { fontSize: 11, color: DIM, marginTop: 2 },
  toggleBtn: {
    backgroundColor: '#232d3a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: GOLD,
  },
  toggleBtnDone: { backgroundColor: GOLD },
  toggleBtnText: { color: INK, fontSize: 14, fontWeight: '700' },
  autoStatusText: {
    fontSize: 13,
    color: DIM,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  levelBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 10,
  },
  levelBarFill: { height: '100%', borderRadius: 4, backgroundColor: GOLD },
  levelBarMeta: { color: DIM, fontSize: 12, marginTop: 6 },
  rankBlurb: { color: DIM, fontSize: 12, marginTop: 4, lineHeight: 17 },
  readingLinkNote: { color: GOLD, fontSize: 12, fontWeight: '600', marginTop: 10, lineHeight: 18 },
  rankBlock: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10, marginTop: 10 },
  rankHead: { flexDirection: 'row', alignItems: 'center' },
  rankLock: { fontSize: 14, width: 26 },
  rankName: { color: INK, fontSize: 15, fontWeight: '700' },
  rankLocked: { color: DIM },
  rankVolume: { color: DIM, fontSize: 11, marginTop: 1 },
  rankCount: { color: GOLD, fontSize: 13, fontWeight: '800' },
  rankLockedMsg: { color: DIM, fontSize: 12, marginTop: 8, marginLeft: 26, lineHeight: 17 },
  techRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, marginLeft: 26 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: GOLD,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxDone: { backgroundColor: GOLD },
  checkMark: { color: '#fff', fontSize: 11, fontWeight: '700' },
  techName: { color: INK, fontSize: 14, fontWeight: '600' },
  techNameLocked: { color: DIM, fontSize: 14, fontWeight: '600' },
  techLockIcon: { fontSize: 15, marginRight: 12, marginTop: 2 },
  techNameDone: { color: DIM, textDecorationLine: 'line-through' },
  techNote: { color: DIM, fontSize: 12, marginTop: 3, lineHeight: 17 },
  techBody: { marginLeft: 56, marginTop: 8, marginBottom: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  stepNum: { color: GOLD, fontSize: 12, fontWeight: '800', width: 18, marginTop: 1 },
  stepText: { flex: 1, color: '#c3ccd6', fontSize: 13, lineHeight: 19 },
  techPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 8,
    backgroundColor: '#0c1117',
  },
  photoRemove: { color: ROSE, fontSize: 12, fontWeight: '600', marginTop: 8 },
  photoBtn: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  photoBtnText: { color: GOLD, fontSize: 12, fontWeight: '700' },
  boardBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: GOLD },
  boardBtnText: { color: GOLD },
  lessonListBox: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 4, marginTop: 14,
  },
  lessonRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  lessonMark: { fontSize: 15, width: 26 },
  lessonName: { color: INK, fontSize: 13.5, fontWeight: '600', flex: 1 },
  lessonNameDone: { color: DIM },
  lessonNameLocked: { color: DIM },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  historyDate: { fontSize: 13, color: DIM },
  historySeconds: { fontSize: 13, color: INK, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600', color: DIM, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#232d3a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: INK,
  },
  timeBtn: {
    backgroundColor: '#232d3a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  timeBtnText: { fontSize: 15, color: INK, fontWeight: '600' },
  clearTimeBtn: { alignItems: 'center', marginTop: 6, marginBottom: 4 },
  clearTimeBtnText: { fontSize: 12, color: DIM },
  currentVideoCard: {
    backgroundColor: 'rgba(217,164,65,0.18)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  currentVideoLabel: { fontSize: 11, color: GOLD, fontWeight: '700', marginBottom: 4 },
  currentVideoTitle: { fontSize: 14, color: INK, fontWeight: '600' },
  watchBtn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  watchBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  linkBtn: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  linkBtnText: { color: GOLD, fontSize: 14, fontWeight: '700' },
  linkError: { color: ROSE, fontSize: 12, marginTop: 8 },
  saveBtn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 2 },
  cancelBtnText: { color: DIM, fontSize: 14 },
  videoScreen: { flex: 1, backgroundColor: '#000' },
  videoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  videoHeaderTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', marginRight: 12 },
  videoCloseX: { color: '#fff', fontSize: 22 },
  videoFloatingClose: {
    position: 'absolute',
    top: 46,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

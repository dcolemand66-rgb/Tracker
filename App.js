import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveChunked,
  loadChunked,
  snapshot,
  recoverySources,
  restoreFrom,
  repairMeta,
} from './chunkedStorage';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import CalendarScreen from './CalendarScreen';
import RoadmapsScreen from './RoadmapsScreen';
import PlacesScreen from './PlacesScreen';
import BuylistScreen from './BuylistScreen';
import TrackerScreen from './TrackerScreen';
import PriorityScreen from './PriorityScreen';
import RecipesScreen from './RecipesScreen';
import SavingsScreen from './SavingsScreen';
import InformationScreen from './InformationScreen';
import RestaurantsScreen from './RestaurantsScreen';
import SettingsScreen from './SettingsScreen';
import TravelScreen from './TravelScreen';
import HabitsDetailScreen from './HabitsDetailScreen';
import SideQuestsScreen from './SideQuestsScreen';
import IdleonTrackerScreen from './IdleonTrackerScreen';
import { ensureNotificationPermissions, resyncAllHabitNotifications } from './notifications';
import { GOLD, INK, DIM, CARD, BORDER, BLUE, ROSE, glowRose } from './theme';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { signInToFirebaseWithGoogle, pushBackupToCloud, pullBackupFromCloud } from './firebaseSync';
import { migrateBase64PhotosToFiles, convertBase64PhotosToFilesInPlace } from './photoMigration';
import ErrorBoundary from './ErrorBoundary';

const STORAGE_KEY = 'tracker_expo_data_v12';

// Chess is a purpose-built habit with its own "tap to start" session
// screen (board + lessons), same as Reading/Self Care/Cardistry/Workout -
// that only works when sessionType is 'chess'. Older data (or a payload
// restored from before this was wired up) can have a Chess habit missing
// that field, which makes Calendar fall back to a plain manual checkbox
// instead. Normalize it on every load so it's never stuck that way.
function normalizeHabits(list) {
  return (list || []).map((h) =>
    h.text === 'Chess' && h.sessionType !== 'chess' ? { ...h, sessionType: 'chess' } : h
  );
}

const NAV_ITEMS = [
  { key: 'tracker', label: 'Tracker', icon: '🎬' },
  { key: 'priority', label: 'Priority', icon: '🎯' },
  { key: 'roadmaps', label: 'Roadmaps', icon: '🚩' },
  { key: 'buylist', label: 'Buylist', icon: '🛍️' },
  { key: 'habits', label: 'Habits', icon: '🔥' },
  { key: 'information', label: 'Information', icon: 'ℹ️' },
  { key: 'savings', label: 'Money', icon: '💰' },
  { key: 'calendar', label: 'Calendar', icon: '📅' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

const TAB_LABELS = {
  tracker: 'Tracker',
  priority: 'Priority',
  roadmaps: 'Roadmaps',
  buylist: 'Buylist',
  information: 'Information',
  savings: 'Money',
  calendar: 'Calendar',
  recipes: 'Recipes',
  places: 'Places',
  travel: 'Traveling',
  restaurants: 'Restaurants',
  settings: 'Settings',
  habits: 'Habits',
  sidequests: 'Side Quests',
  'idleon-tracker': 'Idleon',
};

const DRAWER_WIDTH = 280;

function MainApp() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('calendar');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [inventory, setInventory] = useState([]);
  const [cards, setCards] = useState([]);
  const [datingPlaces, setDatingPlaces] = useState([]);
  const [travelPlaces, setTravelPlaces] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [gardenItems, setGardenItems] = useState([]);
  const [preservedItems, setPreservedItems] = useState([]);
  const [stats, setStats] = useState([]);
  const [level, setLevel] = useState({ level: 1, xp: 0 });
  const [rewardPoints, setRewardPoints] = useState(0);
  const [rewardItems, setRewardItems] = useState([]);
  const [rewardHistory, setRewardHistory] = useState([]);
  const [buylist, setBuylist] = useState([]);
  const [buylistCategories, setBuylistCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [groceries, setGroceries] = useState([]);
  // Recurring "must-have" groceries (eggs, milk, etc.) - separate from
  // the regular one-off shopping list in `groceries` above, so a staple
  // you're currently stocked on doesn't need to be re-added every time;
  // you just flip it back to "need it" once it runs out.
  const [groceryStaples, setGroceryStaples] = useState([]);
  const [todoItems, setTodoItems] = useState([]);
  const [habits, setHabits] = useState([]);
  const [hero, setHero] = useState({ weaponTier: 0, armorTier: 0, energy: 0, minionsDefeated: 0 });
  const [googleUser, setGoogleUser] = useState(null);
  const [customColors, setCustomColors] = useState([]);
  const [trips, setTrips] = useState([]);
  // Side Quests - a lightweight, separate passion-tracking list on the
  // Calendar screen. Deliberately not tied to Roadmaps: those are
  // structured goal cards with tasks/lessons, this is meant to be a much
  // lower-friction "things I'm into" list you can jot down and check off.
  const [sideQuests, setSideQuests] = useState([]);
  // Data for Side Quests entries that are full trackers (categories +
  // items) rather than a simple checklist line - keyed by trackerId, e.g.
  // idleonTracker for the 'idleon' entry.
  const [idleonTracker, setIdleonTracker] = useState({ categories: [], links: [] });
  const [farmingProgress, setFarmingProgress] = useState({});
  const [pendingHabitId, setPendingHabitId] = useState(null);
  const [pendingLesson, setPendingLesson] = useState(null); // { guideId, courseId, lessonId } from a Calendar quest tap
  const [saveError, setSaveError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveBytes, setSaveBytes] = useState(0);
  const [cloudSyncError, setCloudSyncError] = useState(null);
  const [calendarViewMode, setCalendarViewMode] = useState('agenda');
  const [meditationSettings, setMeditationSettings] = useState({
    breathCount: 5,
    tempoId: 'medium',
    totalRounds: 1,
    soundOn: true,
  });
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [bills, setBills] = useState([]);
  const [debts, setDebts] = useState([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [bodyWorkouts, setBodyWorkouts] = useState([]);
  const [bodyRoutines, setBodyRoutines] = useState([]);
  const [bodyInventory, setBodyInventory] = useState([]);
  const [bodyExercises, setBodyExercises] = useState([]);
  const [infoCategories, setInfoCategories] = useState([]);
  // Link entries per Information category — { [categoryId]: [{id, title, url, notes}] }.
  // Keyed by category id so any category (built-in or custom, including
  // the seeded Idleon/Soul-Arena ones) can hold its own saved links.
  const [infoLinks, setInfoLinks] = useState({});
  const [ingredientLinkMemory, setIngredientLinkMemory] = useState({});
  const [placesKind, setPlacesKind] = useState('dating');
  const [trackerFilter, setTrackerFilter] = useState('all');
  const [buylistFilter, setBuylistFilter] = useState('all');
  const [drawerSubmenu, setDrawerSubmenu] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const hasHydrated = useRef(false);

  // Always-current refs for the AppState background-push effect below.
  // Mobile OSes don't reliably let async work finish once a process is
  // actually being terminated, so instead of trying to catch "full
  // close" directly (not reliably possible), this pushes to the cloud
  // the moment the app is backgrounded - which always happens before a
  // full close, whether the user swipes it away or the OS kills it
  // later. Refs (not the raw state values) so the AppState listener,
  // which subscribes once on mount, always reads the latest data
  // instead of a stale closure from whenever it first subscribed.
  const latestPayloadRef = useRef(null);
  const googleUserRef = useRef(null);
  useEffect(() => {
    googleUserRef.current = googleUser;
  }, [googleUser]);

  function drawerSubmenuFor(currentTab) {
    return null;
  }

  function openDrawer() {
    setDrawerSubmenu(drawerSubmenuFor(tab));
    setDrawerOpen(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function closeDrawer() {
    Animated.timing(slideAnim, {
      toValue: -DRAWER_WIDTH,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setDrawerOpen(false));
  }

  function selectTab(key) {
    setTab(key);
    closeDrawer();
  }

  function selectSubmenuItem(item) {
    item.action();
    closeDrawer();
  }

  function getFullPayload() {
    return {
      inventory,
      cards,
      datingPlaces,
      travelPlaces,
      restaurants,
      gardenItems,
      preservedItems,
      stats,
      level,
      buylist,
      buylistCategories,
      items,
      categories,
      recipes,
      groceries,
      groceryStaples,
      rewardPoints,
      rewardItems,
      rewardHistory,
      todoItems,
      savingsGoals,
      bills,
      debts,
      monthlyIncome,
      bodyWorkouts,
      bodyRoutines,
      bodyInventory,
      bodyExercises,
      infoCategories,
      infoLinks,
      ingredientLinkMemory,
      habits,
      hero,
      googleUser,
      customColors,
      trips,
      sideQuests,
      idleonTracker,
      farmingProgress,
      calendarViewMode,
      meditationSettings,
    };
  }

  async function applyFullPayload(p) {
    // Cloud backups now carry photos as inline base64 (see
    // photoCloudSync.js) precisely so a restore isn't left holding
    // file:// paths to a photos folder that doesn't exist on this
    // device/after this reset. Write them back out to real local files
    // before anything below reads `p.*` into state, reusing the exact
    // same conversion the one-time base64 migration already uses.
    await convertBase64PhotosToFilesInPlace(p);
    setInventory(p.inventory || []);
    setCards(p.cards || []);
    setDatingPlaces(p.datingPlaces || []);
    setTravelPlaces(p.travelPlaces || []);
    setStats(p.stats || []);
    setLevel(p.level || { level: 1, xp: 0 });
    setBuylist(p.buylist || []);
    setBuylistCategories(p.buylistCategories || []);
    setItems(p.items || []);
    setCategories(p.categories || []);
    setRecipes(p.recipes || []);
    setGroceries(p.groceries || []);
    setGroceryStaples(p.groceryStaples || []);
    setRewardPoints(p.rewardPoints || 0);
    setRewardItems(p.rewardItems || []);
    setRewardHistory(p.rewardHistory || []);
    setTodoItems(p.todoItems || []);
    setSavingsGoals(p.savingsGoals || []);
    setBills(p.bills || []);
    setMonthlyIncome(p.monthlyIncome || 0);
    setBodyWorkouts(p.bodyWorkouts || []);
    setBodyRoutines(p.bodyRoutines || []);
    setBodyInventory(p.bodyInventory || []);
    setBodyExercises(p.bodyExercises || []);
    setInfoCategories(p.infoCategories || []);
    setInfoLinks(p.infoLinks || {});
    setIngredientLinkMemory(p.ingredientLinkMemory || {});
    setHabits(normalizeHabits(p.habits || []));
    setHero(p.hero || { weaponTier: 0, armorTier: 0, energy: 0, minionsDefeated: 0 });
    setGoogleUser(p.googleUser || null);
    setCustomColors(p.customColors || []);
    setTrips(p.trips || []);
    setSideQuests(p.sideQuests || []);
    setIdleonTracker(p.idleonTracker || { categories: [], links: [] });
    setFarmingProgress(p.farmingProgress || {});
    setCalendarViewMode(p.calendarViewMode || 'agenda');
    setMeditationSettings(p.meditationSettings || { breathCount: 5, tempoId: 'medium', totalRounds: 1, soundOn: true });
  }

  function handleInfoNavigate(targetTab, kind) {
    if (kind) setPlacesKind(kind);
    setTab(targetTab);
  }

  // Load once on startup: prefer whatever's saved on-device,
  // fall back to the bundled real-data snapshot on first ever run.
  // Genuine empty defaults, never a bundled realData fallback — that
  // fallback (removed here) is what could silently repopulate old,
  // bundled data.js content any time storage came back empty for any
  // reason, with zero indication anything had reverted.
  useEffect(() => {
    async function load() {
      try {
        const saved = (await loadChunked(STORAGE_KEY)) || {};
        // One-time cleanup: convert any photos still stored as base64
        // (from before photos were saved to disk) into files, in place,
        // before any of it is loaded into state below.
        await migrateBase64PhotosToFiles(saved);
        setInventory(saved.inventory || []);
        setCards(saved.cards || []);
        setDatingPlaces(saved.datingPlaces || []);
        setTravelPlaces(saved.travelPlaces || []);
        setRestaurants(saved.restaurants || []);
        setGardenItems(saved.gardenItems || []);
        setPreservedItems(saved.preservedItems || []);
        setStats(saved.stats || []);
        setLevel(saved.level || { level: 1, xp: 0 });
        setBuylist(saved.buylist || []);
        setBuylistCategories(saved.buylistCategories || []);
        setItems(saved.items || []);
        setCategories(saved.categories || []);
        setRecipes(saved.recipes || []);
        setGroceries(saved.groceries || []);
        setGroceryStaples(saved.groceryStaples || []);
        setRewardPoints(saved.rewardPoints != null ? saved.rewardPoints : 0);
        setRewardItems(saved.rewardItems || []);
        setRewardHistory(saved.rewardHistory || []);
        setTodoItems(saved.todoItems || []);
        setHabits(normalizeHabits(saved.habits || []));
        setHero(saved.hero || { weaponTier: 0, armorTier: 0, energy: 0, minionsDefeated: 0 });
        setGoogleUser(saved.googleUser || null);
        setCustomColors(saved.customColors || []);
        setTrips(saved.trips || []);
        setFarmingProgress(saved.farmingProgress || {});
        setCalendarViewMode(saved.calendarViewMode || 'agenda');
        setMeditationSettings(saved.meditationSettings || { breathCount: 5, tempoId: 'medium', totalRounds: 1, soundOn: true });
        setSavingsGoals(saved.savingsGoals || []);
        setBills(saved.bills || []);
        setDebts(saved.debts || []);
        setMonthlyIncome(saved.monthlyIncome || 0);
        setBodyWorkouts(saved.bodyWorkouts || []);
        setBodyRoutines(saved.bodyRoutines || []);
        setBodyInventory(saved.bodyInventory || []);
        setBodyExercises(saved.bodyExercises || []);
        // Idleon and Soul-Arena used to be seeded as Information
        // categories. They've moved to live as Side Quests entries
        // instead — this one-time migration pulls them (seeded or
        // user-created, by name) out of Information and drops them into
        // Side Quests, and seeds them there directly on a fresh install.
        // Never re-added afterward, even if the user later deletes one.
        //
        // NOTE: an earlier version of this migration deleted whatever
        // links had been saved under the old Idleon/Soul-Arena categories
        // instead of carrying them forward - anyone who already ran that
        // version lost those links for good, since the flag below means
        // it never runs a second time. Fixed here so it doesn't happen
        // again: Idleon's old links are now folded into its tracker's
        // Links section below instead of being discarded.
        const existingCats = saved.infoCategories || [];
        const existingLinks = saved.infoLinks || {};
        const existingSideQuests = saved.sideQuests || [];
        const migrateFlagKey = 'tracker_idleon_soularena_to_sidequests_v1';
        const alreadyMigrated = await AsyncStorage.getItem(migrateFlagKey);
        let catsToUse = existingCats;
        let linksToUse = existingLinks;
        let questsToUse = existingSideQuests;
        let idleonLinksToMigrate = [];
        if (!alreadyMigrated) {
          const isIdleonOrSoulArena = (c) => {
            const n = (c.name || '').toLowerCase();
            return n === 'idleon' || n === 'soul-arena';
          };
          const toMigrate = existingCats.filter(isIdleonOrSoulArena);
          const haveQuestText = (t) =>
            existingSideQuests.some((q) => (q.text || '').toLowerCase() === t.toLowerCase());
          if (toMigrate.length) {
            catsToUse = existingCats.filter((c) => !isIdleonOrSoulArena(c));
            linksToUse = { ...existingLinks };
            toMigrate.forEach((c) => {
              if ((c.name || '').toLowerCase() === 'idleon' && Array.isArray(linksToUse[c.id])) {
                idleonLinksToMigrate = [...idleonLinksToMigrate, ...linksToUse[c.id]];
              }
              delete linksToUse[c.id];
            });
            const migratedQuests = toMigrate
              .filter((c) => !haveQuestText(c.name))
              .map((c, i) => ({
                id: 'sq_migrated_' + c.id + '_' + i,
                text: c.name,
                done: false,
                addedAt: Date.now(),
              }));
            questsToUse = [...existingSideQuests, ...migratedQuests];
          } else {
            const seeded = [];
            if (!haveQuestText('Idleon')) {
              seeded.push({ id: 'sq_idleon_seed', text: 'Idleon', done: false, addedAt: Date.now() });
            }
            if (!haveQuestText('Soul-Arena')) {
              seeded.push({ id: 'sq_soularena_seed', text: 'Soul-Arena', done: false, addedAt: Date.now() });
            }
            if (seeded.length) questsToUse = [...existingSideQuests, ...seeded];
          }
          await AsyncStorage.setItem(migrateFlagKey, '1');
        }
        // Idleon's Side Quests entry now opens its own tracker page
        // instead of just toggling done/not-done — normalize whichever
        // entry is "Idleon" (seeded, migrated, or user-added) to that
        // type. Cheap and idempotent, so it just runs on every load
        // rather than needing its own one-time flag.
        questsToUse = questsToUse.map((q) =>
          q.type === 'tracker'
            ? q
            : (q.text || '').toLowerCase() === 'idleon'
            ? { ...q, type: 'tracker', trackerId: 'idleon' }
            : q
        );
        setInfoCategories(catsToUse);
        setInfoLinks(linksToUse);
        setSideQuests(questsToUse);

        // Build the Idleon tracker's saved state, carrying forward any
        // links rescued above, and seeding the account link once (never
        // re-added if the user later deletes it).
        let idleonTrackerToUse = saved.idleonTracker || { categories: [], links: [] };
        if (!Array.isArray(idleonTrackerToUse.links)) idleonTrackerToUse = { ...idleonTrackerToUse, links: [] };
        if (idleonLinksToMigrate.length) {
          const haveUrl = (u) => idleonTrackerToUse.links.some((l) => l.url === u);
          const toAdd = idleonLinksToMigrate.filter((l) => !haveUrl(l.url));
          if (toAdd.length) {
            idleonTrackerToUse = { ...idleonTrackerToUse, links: [...idleonTrackerToUse.links, ...toAdd] };
          }
        }
        const accountLinkFlagKey = 'tracker_idleon_account_link_seeded_v1';
        const accountLinkSeeded = await AsyncStorage.getItem(accountLinkFlagKey);
        if (!accountLinkSeeded) {
          const accountUrl = 'https://demarcus1234.idleonefficiency.com';
          const haveAccountUrl = idleonTrackerToUse.links.some((l) => l.url === accountUrl);
          if (!haveAccountUrl) {
            idleonTrackerToUse = {
              ...idleonTrackerToUse,
              links: [
                ...idleonTrackerToUse.links,
                {
                  id: 'il_account_seed',
                  title: 'My Idleon Efficiency Profile',
                  url: accountUrl,
                  notes: '',
                  image: '',
                  description: '',
                },
              ],
            };
          }
          await AsyncStorage.setItem(accountLinkFlagKey, '1');
        }

        // Seeds the checklist categories to match Idleon Efficiency's own
        // section structure (Worlds 1-7, Master Classes, Account Wide) so
        // there's a real starting scaffold instead of a blank page. Only
        // runs once, and only if no categories exist yet, so it never
        // overwrites categories the user already built out themselves.
        const categoriesSeedFlagKey = 'tracker_idleon_categories_seeded_v1';
        const categoriesSeeded = await AsyncStorage.getItem(categoriesSeedFlagKey);
        if (!categoriesSeeded) {
          if (!idleonTrackerToUse.categories || idleonTrackerToUse.categories.length === 0) {
            const worldCats = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
              id: `ic_world${n}_seed`,
              name: `World ${n}`,
              items: [],
            }));
            idleonTrackerToUse = {
              ...idleonTrackerToUse,
              categories: [
                ...worldCats,
                { id: 'ic_masterclasses_seed', name: 'Master Classes', items: [] },
                {
                  id: 'ic_accountwide_seed',
                  name: 'Account Wide',
                  items: [
                    'Sailing',
                    'Farming',
                    'Construction',
                    'Gaming (Arcade)',
                    'Alchemy',
                    'Cooking',
                    'Sneaking',
                    'Worship',
                    'Summoning',
                    'Post Office',
                  ].map((name, i) => ({
                    id: `ii_accountwide_seed_${i}`,
                    name,
                    status: 'todo',
                    note: '',
                  })),
                },
              ],
            };
          }
          await AsyncStorage.setItem(categoriesSeedFlagKey, '1');
        }
        setIdleonTracker(idleonTrackerToUse);
        setIngredientLinkMemory(saved.ingredientLinkMemory || {});
        // Only reached when the load genuinely succeeded, so this is the
        // only place saving gets enabled.
        hasHydrated.current = true;
        // One good snapshot per launch, taken before any writes.
        snapshot(STORAGE_KEY);
        setLoaded(true);
      } catch (e) {
        // Critically: do NOT fall back to the bundled starter data here.
        // This catch used to reset every piece of state to realData and
        // then mark hydration complete, so the auto-save immediately
        // wrote that fallback over the user's real saved data — which is
        // why changes appeared to save during a session and then vanished
        // on the next launch. Now a failed load leaves state untouched
        // and, by leaving hasHydrated false, blocks saving entirely so
        // whatever is on disk stays recoverable via Backup.
        setLoadError(e && e.message ? e.message : String(e));
        setLoaded(true);
      }
    }
    load();
  }, []);

  // Once loaded, make sure notification permission is granted and every
  // habit's reminder schedule is rebuilt clean (avoids any chance of
  // duplicate/orphaned notifications piling up across app restarts).
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      // Must be awaited: on Android this is what creates the 'habits'
      // notification channel, and scheduling into a channel that does
      // not exist yet means the notification silently never displays.
      // Previously this ran un-awaited alongside the resync below, so
      // on a cold start the two raced and reminders could be dropped.
      await ensureNotificationPermissions();
      const updates = await resyncAllHabitNotifications(habits);
      setHabits((prev) =>
        prev.map((h) =>
          updates[h.id] !== undefined ? { ...h, scheduledNotifications: updates[h.id] } : h
        )
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // Automatic cloud PULL - deliberately narrow: only fires when local
  // storage came back genuinely empty (checked against several core
  // fields at once, not just one, so a user who simply hasn't added
  // habits yet but has other real data doesn't get treated as "empty")
  // AND this device has previously signed in with Google for this app.
  // That second check uses GoogleSignin's own native-level session
  // state rather than the app's `googleUser` state, since that field is
  // ITSELF part of the payload that would be empty in exactly the
  // scenario this exists to catch. Never fires if there's any real
  // local data - auto-pull only ever fills a genuine void, it never
  // overwrites something that already exists.
  useEffect(() => {
    if (!loaded || !hasHydrated.current) return;
    const genuinelyEmpty =
      habits.length === 0 &&
      trips.length === 0 &&
      inventory.length === 0 &&
      items.length === 0 &&
      cards.length === 0;
    if (!genuinelyEmpty) return;

    (async () => {
      try {
        const hasPrior = await GoogleSignin.hasPreviousSignIn();
        if (!hasPrior) return;
        const userInfo = await GoogleSignin.signInSilently();
        const tokens = await GoogleSignin.getTokens();
        await signInToFirebaseWithGoogle(tokens.idToken, tokens.accessToken);
        const cloudData = await pullBackupFromCloud();
        if (cloudData) {
          await applyFullPayload(cloudData);
          if (userInfo && userInfo.data && userInfo.data.user) {
            setGoogleUser({
              name: userInfo.data.user.name,
              email: userInfo.data.user.email,
              photo: userInfo.data.user.photo,
            });
          }
        }
      } catch (e) {
        // Silent - this is a background best-effort recovery attempt,
        // not a user-initiated action, so there's no action for an
        // error message to prompt here. Worst case, local state simply
        // stays at its genuine (empty) value, same as it would without
        // this effect existing at all.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // Auto-save on every change, once initial load is done
  // (so we don't immediately overwrite saved data with empty state).
  useEffect(() => {
    if (!hasHydrated.current) return;
    const payload = {
      inventory,
      cards,
      datingPlaces,
      travelPlaces,
      restaurants,
      gardenItems,
      preservedItems,
      stats,
      level,
      buylist,
      buylistCategories,
      items,
      categories,
      recipes,
      groceries,
      groceryStaples,
      rewardPoints,
      rewardItems,
      rewardHistory,
      todoItems,
      savingsGoals,
      bills,
      debts,
      monthlyIncome,
      bodyWorkouts,
      bodyRoutines,
      bodyInventory,
      bodyExercises,
      infoCategories,
      infoLinks,
      ingredientLinkMemory,
      habits,
      hero,
      googleUser,
      customColors,
      trips,
      sideQuests,
      idleonTracker,
      farmingProgress,
      calendarViewMode,
      meditationSettings,
    };
    latestPayloadRef.current = payload;
    // This used to be `.catch(() => {})`, which silently swallowed every
    // storage failure. On Android AsyncStorage has a per-item size limit,
    // and the bundled starter photos push the payload close to it — so
    // writes were failing with no error and nothing persisted between
    // launches, while everything still looked fine in memory. Failures
    // are now surfaced instead of hidden.
    saveChunked(STORAGE_KEY, payload)
      .then((bytes) => {
        setSaveBytes(bytes);
        setSaveError(null);
        // Automatic cloud push - safe to do unconditionally on every
        // successful local save, since pushing your OWN current data TO
        // the cloud can never destroy anything locally. Silent/
        // best-effort: a cloud hiccup shouldn't interrupt anything or
        // show the local save-error banner, which is specifically for
        // local save failures (the thing that actually risks losing
        // work). Only attempted when actually signed in.
        if (googleUser) {
          pushBackupToCloud(payload)
            .then(() => setCloudSyncError(null))
            .catch((e) => {
              // Local save already succeeded, which is what matters most -
              // this doesn't interrupt anything. But unlike before, the
              // failure is now visible in Settings instead of vanishing
              // silently, especially now that it can mean "payload too
              // large to sync" rather than just a network hiccup.
              setCloudSyncError(e && e.message ? e.message : String(e));
            });
        }
      })
      .catch((e) => {
        setSaveError(e && e.message ? e.message : String(e));
      });
  }, [
    inventory,
    cards,
    datingPlaces,
    travelPlaces,
    restaurants,
    gardenItems,
    preservedItems,
    stats,
    level,
    buylist,
    buylistCategories,
    items,
    categories,
    recipes,
    groceries,
    groceryStaples,
    rewardPoints,
    rewardItems,
    rewardHistory,
    todoItems,
    savingsGoals,
    bills,
    debts,
    monthlyIncome,
    bodyWorkouts,
    bodyRoutines,
    bodyInventory,
    bodyExercises,
    infoCategories,
    infoLinks,
    ingredientLinkMemory,
    habits,
    hero,
    googleUser,
    customColors,
    trips,
    sideQuests,
    idleonTracker,
    farmingProgress,
    calendarViewMode,
    meditationSettings,
  ]);

  // Push to the cloud the moment the app is backgrounded (see the refs
  // above for why this is the right hook instead of trying to catch a
  // literal "full close"). Subscribes once on mount; reads via refs so
  // it's never working with stale data regardless of when it fires.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'background') return;
      if (!googleUserRef.current) return; // not signed in - nothing to push to
      if (!latestPayloadRef.current) return; // haven't hydrated/saved yet this session
      pushBackupToCloud(latestPayloadRef.current)
        .then(() => setCloudSyncError(null))
        .catch((e) => {
          // Best-effort, same as the push after a normal local save - a
          // failure here shouldn't block or interrupt backgrounding, but
          // it's now visible in Settings instead of vanishing silently.
          setCloudSyncError(e && e.message ? e.message : String(e));
        });
    });
    return () => sub.remove();
  }, []);

  const data = { inventory, cards, datingPlaces };

  if (!loaded) {
    return (
      <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: DIM }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const activeLabel = TAB_LABELS[tab] || 'Tracker';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.hamburgerBtn}>
          <Text style={styles.hamburgerIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{activeLabel}</Text>
        <View style={{ width: 40 }} />
      </View>

      {saveError ? (
        <TouchableOpacity
          style={styles.saveErrorBanner}
          onPress={() => setTab('settings')}
        >
          <Text style={styles.saveErrorText} numberOfLines={2}>
            ⚠️ Your last change didn't save: {saveError} — tap for recovery options
          </Text>
        </TouchableOpacity>
      ) : null}

      {!saveError && cloudSyncError ? (
        <TouchableOpacity
          style={styles.cloudSyncErrorBanner}
          onPress={() => setTab('settings')}
        >
          <Text style={styles.saveErrorText} numberOfLines={2}>
            ⚠️ Cloud backup failed: {cloudSyncError} — tap for details
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={{ flex: 1 }}>
        <ErrorBoundary key={tab} label={activeLabel} onReset={() => setTab('calendar')}>
        {tab === 'calendar' && (
          <CalendarScreen
            data={data}
            habits={habits}
            setHabits={setHabits}
            level={level}
            setLevel={setLevel}
            rewardPoints={rewardPoints}
            setRewardPoints={setRewardPoints}
            hero={hero}
            setHero={setHero}
            cards={cards}
            setCards={setCards}
            stats={stats}
            setStats={setStats}
            guideProgress={farmingProgress}
            trackerItems={items}
            calendarViewMode={calendarViewMode}
            todoItems={todoItems}
            setTodoItems={setTodoItems}
            bodyRoutines={bodyRoutines}
            setBodyRoutines={setBodyRoutines}
            bills={bills}
            onOpenDating={() => {
              setPlacesKind('dating');
              setTab('places');
            }}
            onOpenHabit={(id) => {
              setPendingHabitId(id);
              setTab('habits');
            }}
            onOpenSideQuests={() => setTab('sidequests')}
            onOpenRoadmaps={() => setTab('roadmaps')}
            onOpenLesson={(guideId, courseId, lessonId) => {
              setPendingLesson({ guideId, courseId, lessonId });
              setTab('roadmaps');
            }}
          />
        )}
        {tab === 'sidequests' && (
          <SideQuestsScreen
            sideQuests={sideQuests}
            setSideQuests={setSideQuests}
            onBack={() => setTab('calendar')}
            onOpenTracker={(trackerId) => setTab(trackerId === 'idleon' ? 'idleon-tracker' : 'sidequests')}
          />
        )}
        {tab === 'idleon-tracker' && (
          <IdleonTrackerScreen
            tracker={idleonTracker}
            setTracker={setIdleonTracker}
            onBack={() => setTab('sidequests')}
          />
        )}
        {tab === 'roadmaps' && (
          <RoadmapsScreen
            cards={cards}
            setCards={setCards}
            stats={stats}
            setStats={setStats}
            level={level}
            setLevel={setLevel}
            rewardPoints={rewardPoints}
            setRewardPoints={setRewardPoints}
            rewardItems={rewardItems}
            setRewardItems={setRewardItems}
            rewardHistory={rewardHistory}
            setRewardHistory={setRewardHistory}
            habits={habits}
            setHabits={setHabits}
            hero={hero}
            setHero={setHero}
            customColors={customColors}
            guideProgress={farmingProgress}
            setGuideProgress={setFarmingProgress}
            onGoToCalendar={() => setTab('calendar')}
            pendingLesson={pendingLesson}
            onPendingLessonHandled={() => setPendingLesson(null)}
          />
        )}
        {tab === 'travel' && <TravelScreen trips={trips} setTrips={setTrips} />}
        {tab === 'places' && (
          <PlacesScreen
            datingPlaces={datingPlaces}
            setDatingPlaces={setDatingPlaces}
            travelPlaces={travelPlaces}
            setTravelPlaces={setTravelPlaces}
            initialKind={placesKind}
          />
        )}
        {tab === 'buylist' && (
          <BuylistScreen
            buylist={buylist}
            setBuylist={setBuylist}
            buylistCategories={buylistCategories}
            setBuylistCategories={setBuylistCategories}
            initialFilter={buylistFilter}
          />
        )}
        {tab === 'tracker' && (
          <TrackerScreen
            items={items}
            setItems={setItems}
            categories={categories}
            setCategories={setCategories}
            initialFilter={trackerFilter}
          />
        )}
        {tab === 'priority' && (
          <PriorityScreen
            habits={habits}
            items={items}
            categories={categories}
            setItems={setItems}
            onOpenHabit={(id) => {
              setPendingHabitId(id);
              setTab('habits');
            }}
            onOpenTrackerItem={() => setTab('tracker')}
          />
        )}
        {tab === 'recipes' && (
          <RecipesScreen
            recipes={recipes}
            setRecipes={setRecipes}
            groceries={groceries}
            setGroceries={setGroceries}
            groceryStaples={groceryStaples}
            setGroceryStaples={setGroceryStaples}
            inventory={inventory}
            setInventory={setInventory}
            ingredientLinkMemory={ingredientLinkMemory}
            setIngredientLinkMemory={setIngredientLinkMemory}
            gardenItems={gardenItems}
            setGardenItems={setGardenItems}
            preservedItems={preservedItems}
            setPreservedItems={setPreservedItems}
          />
        )}
        {tab === 'restaurants' && (
          <RestaurantsScreen restaurants={restaurants} setRestaurants={setRestaurants} />
        )}
        {tab === 'savings' && (
          <SavingsScreen
            savingsGoals={savingsGoals}
            setSavingsGoals={setSavingsGoals}
            bills={bills}
            setBills={setBills}
            debts={debts}
            setDebts={setDebts}
            monthlyIncome={monthlyIncome}
            setMonthlyIncome={setMonthlyIncome}
            groceries={groceries}
            buylist={buylist}
            trips={trips}
          />
        )}
        {tab === 'information' && (
          <InformationScreen
            infoCategories={infoCategories}
            setInfoCategories={setInfoCategories}
            infoLinks={infoLinks}
            setInfoLinks={setInfoLinks}
            onNavigate={handleInfoNavigate}
          />
        )}
        {tab === 'settings' && (
          <SettingsScreen
            googleUser={googleUser}
            setGoogleUser={setGoogleUser}
            applyFullPayload={applyFullPayload}
            getLatestPayload={() => latestPayloadRef.current}
            setLevel={setLevel}
            setStats={setStats}
            setRewardPoints={setRewardPoints}
            setRewardHistory={setRewardHistory}
            setHero={setHero}
            customColors={customColors}
            setCustomColors={setCustomColors}
            calendarViewMode={calendarViewMode}
            setCalendarViewMode={setCalendarViewMode}
            habits={habits}
            setHabits={setHabits}
            saveError={saveError}
            loadError={loadError}
            saveBytes={saveBytes}
            cloudSyncError={cloudSyncError}
            meditationSettings={meditationSettings}
            setMeditationSettings={setMeditationSettings}
            storageBreakdown={{
              Recipes: recipes,
              Groceries: groceries,
              'Grocery Staples': groceryStaples,
              Inventory: inventory,
              Buylist: buylist,
              Restaurants: restaurants,
              'Garden/Preserving': [...gardenItems, ...preservedItems],
              'Tracker (movies/shows/games)': items,
              Travel: trips,
              Places: [...datingPlaces, ...travelPlaces],
              'Roadmap Cards': cards,
            }}
          />
        )}
        {tab === 'habits' && (
          <HabitsDetailScreen
            habits={habits}
            setHabits={setHabits}
            level={level}
            setLevel={setLevel}
            rewardPoints={rewardPoints}
            setRewardPoints={setRewardPoints}
            hero={hero}
            setHero={setHero}
            cards={cards}
            setCards={setCards}
            stats={stats}
            setStats={setStats}
            meditationSettings={meditationSettings}
            bodyWorkouts={bodyWorkouts}
            setBodyWorkouts={setBodyWorkouts}
            bodyExercises={bodyExercises}
            pendingHabitId={pendingHabitId}
            onPendingHandled={() => setPendingHabitId(null)}
            bodyRoutines={bodyRoutines}
            setBodyRoutines={setBodyRoutines}
            bodyInventory={bodyInventory}
            setBodyInventory={setBodyInventory}
          />
        )}
        </ErrorBoundary>
      </View>

      <Modal
        visible={drawerOpen}
        transparent
        animationType="none"
        onRequestClose={closeDrawer}
      >
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Animated.View
            style={[
              styles.drawer,
              { paddingTop: insets.top + 20, transform: [{ translateX: slideAnim }] },
            ]}
          >
            <LinearGradient
              colors={['#1a1512', '#0c0a0a', '#050403']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            {/* Bold sun-disc motif, built as a plain shape (no image
                asset) - the solid vermilion circle bleeding off the edge
                is the actual recurring graphic element from the
                reference, not a photo standing in for it. */}
            <View style={styles.sunDisc} />
            <Text style={styles.drawerTitle}>TRACKER</Text>
            <View style={styles.drawerTitleRule} />
            {drawerSubmenu ? (
              <>
                <TouchableOpacity
                  style={styles.drawerBackRow}
                  onPress={() => setDrawerSubmenu(null)}
                >
                  <Text style={styles.drawerBackText}>← Main Menu</Text>
                </TouchableOpacity>
                <Text style={styles.drawerSubHeader}>{TAB_LABELS[tab]}</Text>
                {drawerSubmenu.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.drawerItem}
                    onPress={() => selectSubmenuItem(item)}
                  >
                    <Text style={styles.drawerLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              NAV_ITEMS.map((item, i) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.drawerItem,
                    tab === item.key && styles.drawerItemSel,
                  ]}
                  onPress={() => selectTab(item.key)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.drawerIconBadge, tab === item.key && styles.drawerIconBadgeSel]}>
                    <Text style={styles.drawerIcon}>{item.icon}</Text>
                  </View>
                  <Text
                    style={[
                      styles.drawerLabel,
                      tab === item.key && styles.drawerLabelSel,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {tab === item.key ? <View style={styles.drawerSelDot} /> : null}
                </TouchableOpacity>
              ))
            )}
          </Animated.View>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={closeDrawer}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BLUE },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingHorizontal: 8,
    height: 52,
  },
  hamburgerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hamburgerIcon: { fontSize: 22, color: INK },
  headerTitle: { fontSize: 16, fontWeight: '700', color: INK },
  saveErrorBanner: {
    backgroundColor: '#7a2020',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  saveErrorText: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  cloudSyncErrorBanner: {
    backgroundColor: '#7a5a20',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  drawer: {
    width: DRAWER_WIDTH,
    backgroundColor: '#0c0a0a',
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderRightWidth: 1,
    borderRightColor: 'rgba(217,164,65,0.25)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 8, height: 0 },
    elevation: 16,
  },
  drawerTitle: {
    color: GOLD,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 10,
    fontFamily: 'serif',
    textShadowColor: 'rgba(217,164,65,0.35)',
    textShadowRadius: 8,
  },
  drawerTitleRule: {
    height: 2,
    width: 42,
    backgroundColor: ROSE,
    borderRadius: 1,
    marginBottom: 22,
    opacity: 0.9,
  },
  sunDisc: {
    position: 'absolute',
    top: -50,
    right: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: ROSE,
    opacity: 0.85,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(217,164,65,0.14)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  // Hanko-seal treatment for the active tab: a solid rose accent bar on
  // the left (matching the samurai UI convention researched - red/black/
  // gold, a red seal stamp marking what's "chosen") plus a warm
  // background tint, instead of just bolding the text.
  drawerItemSel: {
    backgroundColor: 'rgba(217,164,65,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(217,164,65,0.55)',
    borderLeftWidth: 4,
    borderLeftColor: ROSE,
    paddingLeft: 9,
    ...glowRose,
    shadowOpacity: 0.4,
    elevation: 5,
  },
  drawerIconBadge: {
    width: 36, height: 36, borderRadius: 11, marginRight: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(217,164,65,0.08)', borderWidth: 1, borderColor: 'rgba(217,164,65,0.3)',
  },
  drawerIconBadgeSel: { borderColor: ROSE, backgroundColor: 'rgba(234,90,95,0.18)' },
  drawerIcon: { fontSize: 17, textAlign: 'center' },
  drawerLabel: { color: '#c7c0b5', fontSize: 16, fontWeight: '500', letterSpacing: 0.3, flex: 1 },
  drawerLabelSel: { color: GOLD, fontWeight: '700' },
  drawerSelDot: {
    width: 7, height: 7, borderRadius: 3.5, backgroundColor: ROSE, marginLeft: 6,
  },
  drawerBackRow: { paddingVertical: 10, marginBottom: 4 },
  drawerBackText: { color: GOLD, fontSize: 14, fontWeight: '700' },
  drawerSubHeader: {
    color: '#8a8474',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 1,
  },
});

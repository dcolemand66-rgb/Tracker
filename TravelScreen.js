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
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { shared, GOLD, ROSE, INK, DIM, CARD, BORDER } from './theme';
import { pickCompressedImage } from './imagePicker';

function makeId(p = 'tr') {
  return p + Date.now() + Math.random().toString(36).slice(2, 8);
}

function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const TRIP_CATEGORIES = [
  { id: 'flights', name: 'Flights', icon: '✈️', unit: 'total', tint: '#3b82c4' },
  { id: 'hotels', name: 'Stays', icon: '🏨', unit: 'per night', tint: '#8b5fbf' },
  { id: 'transport', name: 'Transport', icon: '🚕', unit: '', tint: '#c99a3b' },
  { id: 'food', name: 'Food', icon: '🍜', unit: 'per person', tint: '#c4633b' },
  { id: 'entertainment', name: 'Things to do', icon: '🎟️', unit: 'per person', tint: '#c43b7f' },
];

const SORTS = [
  { id: 'recent', label: 'Recent' },
  { id: 'price', label: 'Price ↑' },
  { id: 'rating', label: 'Rating' },
];

function Stars({ rating }) {
  const r = Number(rating) || 0;
  if (!r) return null;
  return (
    <View style={styles.starRow}>
      <Text style={styles.starText}>{'★'.repeat(Math.round(r))}</Text>
      <Text style={styles.starNum}>{r.toFixed(1)}</Text>
    </View>
  );
}

// Laid out like a booking site's results page — photo, name, rating,
// price to the right — because that's the shape your eye already knows
// how to scan. The data behind it is all yours: prices you log by hand,
// since live inventory needs a commercial API this app has no key for.
export default function TravelScreen({ trips, setTrips }) {
  const list = trips || [];
  const [openTripId, setOpenTripId] = useState(list.length ? list[0].id : null);
  const [activeCat, setActiveCat] = useState('flights');
  const [sortBy, setSortBy] = useState('recent');
  // 'overview' = the existing booking-comparison view (Flights/Stays/etc,
  // browse + compare prices). 'itinerary' = a day-by-day plan, closer to
  // what a dedicated trip-planning doc looks like: stops grouped by day,
  // in order, with a time and an optional note on the gap to the next
  // stop. Same trip, same items - just a second way to look at them.
  const [viewMode, setViewMode] = useState('overview');
  const [selectedDay, setSelectedDay] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');

  const [tripModal, setTripModal] = useState(false);
  const [tripDraft, setTripDraft] = useState({ name: '', start: '', end: '', budget: '' });

  const [itemModal, setItemModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [detailItemId, setDetailItemId] = useState(null);
  const [itemDraft, setItemDraft] = useState({
    name: '', sub: '', address: '', price: '', rating: '', notes: '', link: '', image: null,
    day: '', time: '', travelNote: '',
  });

  const [priceModal, setPriceModal] = useState(false);
  const [priceTargetId, setPriceTargetId] = useState(null);
  const [priceDraft, setPriceDraft] = useState('');

  const trip = list.find((t) => t.id === openTripId);
  const items = trip ? trip.items || [] : [];
  const cat = TRIP_CATEGORIES.find((c) => c.id === activeCat) || TRIP_CATEGORIES[0];
  const detailItem = items.find((i) => i.id === detailItemId) || null;
  const detailCat = detailItem
    ? TRIP_CATEGORIES.find((c) => c.id === detailItem.category) || TRIP_CATEGORIES[0]
    : null;

  function latestPrice(item) {
    const h = item.priceHistory || [];
    return h.length ? Number(h[h.length - 1].price) || 0 : 0;
  }

  const catItems = items
    .filter((i) => i.category === activeCat)
    .sort((a, b) => {
      if (sortBy === 'price') return latestPrice(a) - latestPrice(b);
      if (sortBy === 'rating') return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      return (b.addedAt || 0) - (a.addedAt || 0);
    });

  const bookedTotal = items.filter((i) => i.booked).reduce((n, i) => n + latestPrice(i), 0);
  const budget = trip ? Number(trip.budget) || 0 : 0;

  // Itinerary days are whatever day labels items actually carry (free
  // text the person typed - "Sat 3/21", "Day 1", whatever), in the order
  // they were first used, plus "Unscheduled" for anything with no day
  // set yet. No date parsing/math, so it never breaks on a label that
  // isn't a real date.
  const itineraryDays = [];
  items.forEach((i) => {
    const d = (i.day || '').trim();
    if (d && !itineraryDays.includes(d)) itineraryDays.push(d);
  });
  const hasUnscheduled = items.some((i) => !(i.day || '').trim());
  const dayTabs = hasUnscheduled ? [...itineraryDays, 'Unscheduled'] : itineraryDays;
  const currentDay = selectedDay && dayTabs.includes(selectedDay) ? selectedDay : dayTabs[0] || null;
  const dayItems = currentDay
    ? items
        .filter((i) => (currentDay === 'Unscheduled' ? !(i.day || '').trim() : (i.day || '').trim() === currentDay))
        .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0))
    : [];

  function setItemDay(it, day) {
    setTrips((prev) =>
      (prev || []).map((t) =>
        t.id === openTripId
          ? { ...t, items: (t.items || []).map((i) => (i.id === it.id ? { ...i, day } : i)) }
          : t
      )
    );
  }

  function saveTripNotes() {
    setTrips((prev) =>
      (prev || []).map((t) => (t.id === openTripId ? { ...t, notes: notesDraft } : t))
    );
  }

  useEffect(() => {
    setNotesDraft(trip ? trip.notes || '' : '');
    setSelectedDay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTripId]);

  function saveTrip() {
    const name = tripDraft.name.trim();
    if (!name) {
      Alert.alert('Name required', 'Where are you going?');
      return;
    }
    const t = {
      id: makeId('trip'),
      name,
      start: tripDraft.start.trim(),
      end: tripDraft.end.trim(),
      budget: Number(tripDraft.budget) || 0,
      items: [],
    };
    setTrips((prev) => [...(prev || []), t]);
    setOpenTripId(t.id);
    setTripDraft({ name: '', start: '', end: '', budget: '' });
    setTripModal(false);
  }

  function openItemAdd() {
    setEditingItemId(null);
    setItemDraft({
      name: '', sub: '', address: '', price: '', rating: '', notes: '', link: '', image: null,
      day: viewMode === 'itinerary' && currentDay && currentDay !== 'Unscheduled' ? currentDay : '',
      time: '', travelNote: '',
    });
    setItemModal(true);
  }

  function openItemEdit(it) {
    setEditingItemId(it.id);
    setItemDraft({
      name: it.name,
      sub: it.sub || '',
      address: it.address || '',
      price: String(latestPrice(it) || ''),
      rating: String(it.rating || ''),
      notes: it.notes || '',
      link: it.link || '',
      image: it.image || null,
      day: it.day || '',
      time: it.time || '',
      travelNote: it.travelNote || '',
    });
    setItemModal(true);
  }

  async function pickItemPhoto() {
    const result = await pickCompressedImage();
    if (result.error === 'permission') {
      Alert.alert('Photo access needed', 'Allow photo library access to add a photo.');
      return;
    }
    if (result.canceled || !result.uri) return;
    setItemDraft((d) => ({ ...d, image: result.uri }));
  }

  function saveItem() {
    const name = itemDraft.name.trim();
    if (!name) {
      Alert.alert('Name required', 'Give this option a name.');
      return;
    }
    const price = Number(itemDraft.price) || 0;
    setTrips((prev) =>
      (prev || []).map((t) => {
        if (t.id !== openTripId) return t;
        if (editingItemId) {
          return {
            ...t,
            items: (t.items || []).map((i) => {
              if (i.id !== editingItemId) return i;
              const hist = i.priceHistory || [];
              const changed = !hist.length || Number(hist[hist.length - 1].price) !== price;
              return {
                ...i,
                name,
                sub: itemDraft.sub.trim(),
                address: itemDraft.address.trim(),
                rating: Number(itemDraft.rating) || 0,
                notes: itemDraft.notes.trim(),
                link: itemDraft.link.trim(),
                image: itemDraft.image,
                day: itemDraft.day.trim(),
                time: itemDraft.time.trim(),
                travelNote: itemDraft.travelNote.trim(),
                priceHistory: changed ? [...hist, { date: todayKey(), price }] : hist,
              };
            }),
          };
        }
        return {
          ...t,
          items: [
            ...(t.items || []),
            {
              id: makeId('item'),
              category: activeCat,
              name,
              sub: itemDraft.sub.trim(),
              address: itemDraft.address.trim(),
              rating: Number(itemDraft.rating) || 0,
              notes: itemDraft.notes.trim(),
              link: itemDraft.link.trim(),
              image: itemDraft.image,
              day: itemDraft.day.trim(),
              time: itemDraft.time.trim(),
              travelNote: itemDraft.travelNote.trim(),
              booked: false,
              addedAt: Date.now(),
              priceHistory: price ? [{ date: todayKey(), price }] : [],
            },
          ],
        };
      })
    );
    setItemModal(false);
  }

  function deleteItem() {
    setTrips((prev) =>
      (prev || []).map((t) =>
        t.id === openTripId
          ? { ...t, items: (t.items || []).filter((i) => i.id !== editingItemId) }
          : t
      )
    );
    setItemModal(false);
  }

  function toggleBooked(it) {
    setTrips((prev) =>
      (prev || []).map((t) =>
        t.id === openTripId
          ? {
              ...t,
              items: (t.items || []).map((i) => (i.id === it.id ? { ...i, booked: !i.booked } : i)),
            }
          : t
      )
    );
  }

  function logPrice() {
    const price = Number(priceDraft) || 0;
    if (!price) return;
    setTrips((prev) =>
      (prev || []).map((t) =>
        t.id === openTripId
          ? {
              ...t,
              items: (t.items || []).map((i) =>
                i.id === priceTargetId
                  ? { ...i, priceHistory: [...(i.priceHistory || []), { date: todayKey(), price }] }
                  : i
              ),
            }
          : t
      )
    );
    setPriceDraft('');
    setPriceModal(false);
  }

  function trend(item) {
    const h = item.priceHistory || [];
    if (h.length < 2) return null;
    const first = Number(h[0].price) || 0;
    const last = Number(h[h.length - 1].price) || 0;
    if (last === first) return null;
    return { dir: last > first ? 'up' : 'down', diff: Math.abs(last - first) };
  }

  if (!list.length) {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <LinearGradient colors={['#1a4a6e', '#0d2438']} style={styles.welcomeHero}>
          <Text style={styles.welcomeIcon}>✈️</Text>
          <Text style={styles.welcomeTitle}>Plan your next trip</Text>
          <Text style={styles.welcomeBody}>
            Track flights, stays, and things to do in one place - with the
            prices you find, tracked over time so you know if you're
            waiting for a deal or missing one.
          </Text>
        </LinearGradient>

        <View style={styles.welcomeFeatures}>
          {[
            { icon: '💺', title: 'Flights & stays', body: 'Save every option you\'re considering, side by side.' },
            { icon: '📈', title: 'Price history', body: 'Every price you log is kept, so you can see which way it\'s moving.' },
            { icon: '💰', title: 'Budget at a glance', body: 'Set a budget once and watch it fill up as you book.' },
          ].map((f) => (
            <View key={f.title} style={styles.welcomeFeatureRow}>
              <View style={styles.welcomeFeatureIcon}>
                <Text style={{ fontSize: 18 }}>{f.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.welcomeFeatureTitle}>{f.title}</Text>
                <Text style={styles.welcomeFeatureBody}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <TouchableOpacity style={styles.saveBtn} onPress={() => setTripModal(true)}>
            <Text style={styles.saveBtnText}>✈️ Plan a Trip</Text>
          </TouchableOpacity>
        </View>
        <TripModal />
      </ScrollView>
    );
  }

  function TripModal() {
    return (
      <Modal visible={tripModal} transparent animationType="slide" onRequestClose={() => setTripModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>New Trip</Text>
            <Text style={styles.label}>Where to?</Text>
            <TextInput
              style={styles.input}
              value={tripDraft.name}
              onChangeText={(v) => setTripDraft((d) => ({ ...d, name: v }))}
              placeholder="Thailand"
              placeholderTextColor="#9aa5b1"
            />
            <Text style={styles.label}>Dates</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={tripDraft.start}
                onChangeText={(v) => setTripDraft((d) => ({ ...d, start: v }))}
                placeholder="Depart"
                placeholderTextColor="#9aa5b1"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={tripDraft.end}
                onChangeText={(v) => setTripDraft((d) => ({ ...d, end: v }))}
                placeholder="Return"
                placeholderTextColor="#9aa5b1"
              />
            </View>
            <Text style={styles.label}>Budget</Text>
            <TextInput
              style={styles.input}
              value={tripDraft.budget}
              onChangeText={(v) => setTripDraft((d) => ({ ...d, budget: v.replace(/[^0-9.]/g, '') }))}
              placeholder="0"
              placeholderTextColor="#9aa5b1"
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveTrip}>
              <Text style={styles.saveBtnText}>Create Trip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setTripModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const pct = budget > 0 ? Math.min(100, Math.round((bookedTotal / budget) * 100)) : 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero */}
        <LinearGradient colors={['#1a4a6e', '#0d2438']} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>TRIP</Text>
              <Text style={styles.heroTitle}>{trip ? trip.name : ''}</Text>
              {trip && (trip.start || trip.end) ? (
                <Text style={styles.heroDates}>
                  {trip.start}
                  {trip.end ? `  →  ${trip.end}` : ''}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.heroAdd} onPress={() => setTripModal(true)}>
              <Text style={styles.heroAddText}>+</Text>
            </TouchableOpacity>
          </View>

          {list.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {list.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tripPill, openTripId === t.id && styles.tripPillSel]}
                  onPress={() => setOpenTripId(t.id)}
                >
                  <Text
                    style={[styles.tripPillText, openTripId === t.id && styles.tripPillTextSel]}
                  >
                    {t.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.heroBudget}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroBudgetLabel}>Booked</Text>
              <Text style={styles.heroBudgetValue}>{money(bookedTotal)}</Text>
            </View>
            {budget > 0 ? (
              <View style={{ flex: 1.4 }}>
                <View style={styles.heroBar}>
                  <View
                    style={[
                      styles.heroBarFill,
                      { width: `${pct}%`, backgroundColor: bookedTotal > budget ? ROSE : GOLD },
                    ]}
                  />
                </View>
                <Text style={styles.heroBudgetMeta}>
                  {bookedTotal > budget
                    ? `${money(bookedTotal - budget)} over budget`
                    : `${money(budget - bookedTotal)} of ${money(budget)} left`}
                </Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        {/* Overview / Itinerary toggle */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, viewMode === 'overview' && styles.modeBtnSel]}
            onPress={() => setViewMode('overview')}
          >
            <Text style={[styles.modeBtnText, viewMode === 'overview' && styles.modeBtnTextSel]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, viewMode === 'itinerary' && styles.modeBtnSel]}
            onPress={() => setViewMode('itinerary')}
          >
            <Text style={[styles.modeBtnText, viewMode === 'itinerary' && styles.modeBtnTextSel]}>
              Itinerary
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'itinerary' ? (
          <View style={{ paddingHorizontal: 16 }}>
            <View style={styles.notesCard}>
              <Text style={styles.notesCardTitle}>📝 Notes</Text>
              <TextInput
                style={styles.notesInput}
                value={notesDraft}
                onChangeText={setNotesDraft}
                onBlur={saveTripNotes}
                placeholder="Weather, transport, tipping, anything worth remembering..."
                placeholderTextColor="#9aa5b1"
                multiline
              />
            </View>

            {dayTabs.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No stops planned yet</Text>
                <Text style={styles.emptyBody}>
                  Add something below and give it a day - "Sat 3/21", "Day 1",
                  whatever makes sense to you - and it'll show up here in order.
                </Text>
              </View>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  {dayTabs.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dayTab, currentDay === d && styles.dayTabSel]}
                      onPress={() => setSelectedDay(d)}
                    >
                      <Text style={[styles.dayTabText, currentDay === d && styles.dayTabTextSel]}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.dayCount}>
                  {dayItems.length} stop{dayItems.length === 1 ? '' : 's'}
                </Text>

                {dayItems.map((it, idx) => (
                  <View key={it.id}>
                    <TouchableOpacity style={styles.stopRow} onPress={() => setDetailItemId(it.id)}>
                      <View style={styles.stopPin}>
                        <Text style={styles.stopPinText}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.stopName} numberOfLines={1}>{it.name}</Text>
                          {it.time ? (
                            <View style={styles.timeBadge}>
                              <Text style={styles.timeBadgeText}>{it.time}</Text>
                            </View>
                          ) : null}
                        </View>
                        {it.sub || it.notes ? (
                          <Text style={styles.stopSub} numberOfLines={2}>{it.sub || it.notes}</Text>
                        ) : null}
                      </View>
                      {it.image ? <Image source={{ uri: it.image }} style={styles.stopThumb} /> : null}
                    </TouchableOpacity>
                    {it.travelNote ? (
                      <View style={styles.travelNoteRow}>
                        <Text style={styles.travelNoteText}>🚶 {it.travelNote}</Text>
                      </View>
                    ) : null}
                    {currentDay === 'Unscheduled' && dayTabs.some((d) => d !== 'Unscheduled') ? (
                      <TouchableOpacity
                        style={styles.assignBtn}
                        onPress={() =>
                          Alert.alert(
                            'Assign to a day',
                            'Pick a day for this stop.',
                            [
                              ...dayTabs
                                .filter((d) => d !== 'Unscheduled')
                                .map((d) => ({ text: d, onPress: () => setItemDay(it, d) })),
                              { text: 'Cancel', style: 'cancel' },
                            ]
                          )
                        }
                      >
                        <Text style={styles.assignBtnText}>+ Assign to a day</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </>
            )}
          </View>
        ) : (
          <>
        {/* Category tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catScroll}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {TRIP_CATEGORIES.map((c) => {
            const n = items.filter((i) => i.category === c.id).length;
            const on = activeCat === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.catTab, on && styles.catTabSel]}
                onPress={() => setActiveCat(c.id)}
              >
                <View style={[styles.catIconWrap, { backgroundColor: on ? 'rgba(255,255,255,0.22)' : `${c.tint}33` }]}>
                  <Text style={styles.catIcon}>{c.icon}</Text>
                </View>
                {on ? (
                  <Text style={styles.catLabelSel}>
                    {c.name}
                    {n ? ` · ${n}` : ''}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sort row */}
        <View style={styles.sortRow}>
          <Text style={styles.resultCount}>
            {catItems.length} option{catItems.length === 1 ? '' : 's'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            {SORTS.map((so) => (
              <TouchableOpacity key={so.id} onPress={() => setSortBy(so.id)}>
                <Text style={[styles.sortText, sortBy === so.id && styles.sortTextSel]}>
                  {so.label}
                </Text>
                {sortBy === so.id ? <View style={styles.sortUnderline} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Listings */}
        <View style={{ paddingHorizontal: 16 }}>
          {catItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing saved in {cat.name}</Text>
              <Text style={styles.emptyBody}>
                Found something on a booking site? Save it here with its price
                and check back — the card shows you which way it has moved.
              </Text>
            </View>
          ) : (
            catItems.map((it) => {
              const tr = trend(it);
              return (
                <TouchableOpacity
                  key={it.id}
                  style={styles.listing}
                  activeOpacity={0.85}
                  onPress={() => setDetailItemId(it.id)}
                >
                  {it.image ? (
                    <Image source={{ uri: it.image }} style={styles.listingPhoto} />
                  ) : (
                    <View style={[styles.listingPhoto, styles.listingPhotoEmpty, { backgroundColor: `${cat.tint}22` }]}>
                      <Text style={{ fontSize: 34 }}>{cat.icon}</Text>
                    </View>
                  )}
                  {it.booked ? (
                    <View style={styles.bookedBadge}>
                      <Text style={styles.bookedBadgeText}>BOOKED</Text>
                    </View>
                  ) : null}
                  <View style={styles.listingCardBody}>
                    <Text style={styles.listingName} numberOfLines={1}>
                      {it.name}
                    </Text>
                    {it.address ? (
                      <Text style={styles.listingSub} numberOfLines={1}>📍 {it.address}</Text>
                    ) : it.sub ? (
                      <Text style={styles.listingSub} numberOfLines={1}>{it.sub}</Text>
                    ) : null}
                    <View style={styles.listingCardFoot}>
                      <Stars rating={it.rating} />
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.price}>{money(latestPrice(it))}</Text>
                        {tr ? (
                          <Text style={[styles.trend, tr.dir === 'up' ? styles.up : styles.down]}>
                            {tr.dir === 'up' ? '▲' : '▼'} {money(tr.diff)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        </>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openItemAdd}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <TripModal />

      <Modal visible={itemModal} transparent animationType="slide" onRequestClose={() => setItemModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>
                {editingItemId ? 'Edit' : `Add to ${cat.name}`}
              </Text>

              <TouchableOpacity style={styles.photoPick} onPress={pickItemPhoto}>
                {itemDraft.image ? (
                  <Image source={{ uri: itemDraft.image }} style={styles.photoPreview} />
                ) : (
                  <Text style={styles.photoPickText}>📷 Add a photo</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={itemDraft.name}
                onChangeText={(v) => setItemDraft((d) => ({ ...d, name: v }))}
                placeholder="Bangkok — AirAsia, or Riverside Hotel"
                placeholderTextColor="#9aa5b1"
              />

              <Text style={styles.label}>Detail line</Text>
              <TextInput
                style={styles.input}
                value={itemDraft.sub}
                onChangeText={(v) => setItemDraft((d) => ({ ...d, sub: v }))}
                placeholder="Direct · 11h 20m  /  Sukhumvit, near BTS"
                placeholderTextColor="#9aa5b1"
              />

              <Text style={styles.label}>Address (optional)</Text>
              <TextInput
                style={styles.input}
                value={itemDraft.address}
                onChangeText={(v) => setItemDraft((d) => ({ ...d, address: v }))}
                placeholder="123 Sukhumvit Rd, Bangkok"
                placeholderTextColor="#9aa5b1"
              />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Price</Text>
                  <TextInput
                    style={styles.input}
                    value={itemDraft.price}
                    onChangeText={(v) => setItemDraft((d) => ({ ...d, price: v.replace(/[^0-9.]/g, '') }))}
                    placeholder="0"
                    placeholderTextColor="#9aa5b1"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Rating (0–5)</Text>
                  <TextInput
                    style={styles.input}
                    value={itemDraft.rating}
                    onChangeText={(v) => setItemDraft((d) => ({ ...d, rating: v.replace(/[^0-9.]/g, '') }))}
                    placeholder="4.5"
                    placeholderTextColor="#9aa5b1"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <Text style={styles.hint}>
                Changing the price adds a dated entry to its history rather than
                overwriting the old one.
              </Text>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, { height: 70 }]}
                value={itemDraft.notes}
                onChangeText={(v) => setItemDraft((d) => ({ ...d, notes: v }))}
                placeholder="Baggage included, free cancellation..."
                placeholderTextColor="#9aa5b1"
                multiline
              />

              <Text style={styles.label}>Link</Text>
              <TextInput
                style={styles.input}
                value={itemDraft.link}
                onChangeText={(v) => setItemDraft((d) => ({ ...d, link: v }))}
                placeholder="https://..."
                placeholderTextColor="#9aa5b1"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Itinerary (optional)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1.4 }}>
                  <TextInput
                    style={styles.input}
                    value={itemDraft.day}
                    onChangeText={(v) => setItemDraft((d) => ({ ...d, day: v }))}
                    placeholder="Day, e.g. Sat 3/21"
                    placeholderTextColor="#9aa5b1"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    value={itemDraft.time}
                    onChangeText={(v) => setItemDraft((d) => ({ ...d, time: v }))}
                    placeholder="7:00am"
                    placeholderTextColor="#9aa5b1"
                  />
                </View>
              </View>
              <TextInput
                style={styles.input}
                value={itemDraft.travelNote}
                onChangeText={(v) => setItemDraft((d) => ({ ...d, travelNote: v }))}
                placeholder="Gap to next stop, e.g. 5 min walk · 0.4mi"
                placeholderTextColor="#9aa5b1"
              />

              <TouchableOpacity style={styles.saveBtn} onPress={saveItem}>
                <Text style={styles.saveBtnText}>{editingItemId ? 'Save' : 'Add'}</Text>
              </TouchableOpacity>
              {editingItemId ? (
                <TouchableOpacity style={styles.deleteBtn} onPress={deleteItem}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setItemModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={priceModal} transparent animationType="slide" onRequestClose={() => setPriceModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Log today's price</Text>
            <TextInput
              style={styles.input}
              value={priceDraft}
              onChangeText={(v) => setPriceDraft(v.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              placeholderTextColor="#9aa5b1"
              keyboardType="decimal-pad"
              autoFocus
            />
            <TouchableOpacity style={styles.saveBtn} onPress={logPrice}>
              <Text style={styles.saveBtnText}>Log</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setPriceModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!detailItem}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailItemId(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { padding: 0, overflow: 'hidden' }]}>
            <ScrollView bounces={false}>
              {detailItem && detailItem.image ? (
                <Image source={{ uri: detailItem.image }} style={styles.detailPhoto} />
              ) : (
                <View
                  style={[
                    styles.detailPhoto,
                    styles.listingPhotoEmpty,
                    { backgroundColor: detailCat ? `${detailCat.tint}22` : CARD },
                  ]}
                >
                  <Text style={{ fontSize: 46 }}>{detailCat ? detailCat.icon : ''}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setDetailItemId(null)}>
                <Text style={styles.detailCloseBtnText}>✕</Text>
              </TouchableOpacity>
              {detailItem && detailItem.booked ? (
                <View style={[styles.bookedBadge, { top: 14, right: 14, left: undefined }]}>
                  <Text style={styles.bookedBadgeText}>BOOKED</Text>
                </View>
              ) : null}

              <View style={{ padding: 20 }}>
                <Text style={styles.detailName}>{detailItem ? detailItem.name : ''}</Text>
                {detailItem && detailItem.sub ? (
                  <Text style={styles.detailSub}>{detailItem.sub}</Text>
                ) : null}

                <View style={styles.detailPriceRow}>
                  <View>
                    <Text style={styles.detailPrice}>
                      {detailItem ? money(latestPrice(detailItem)) : ''}
                    </Text>
                    {detailCat && detailCat.unit ? (
                      <Text style={styles.priceUnit}>{detailCat.unit}</Text>
                    ) : null}
                  </View>
                  {detailItem ? <Stars rating={detailItem.rating} /> : null}
                </View>

                {detailItem && detailItem.address ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>📍 Address</Text>
                    <Text style={styles.detailRowValue}>{detailItem.address}</Text>
                  </View>
                ) : null}

                {detailItem && detailItem.day ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>🗓️ Day</Text>
                    <Text style={styles.detailRowValue}>
                      {detailItem.day}{detailItem.time ? ` · ${detailItem.time}` : ''}
                    </Text>
                  </View>
                ) : null}

                {detailItem && detailItem.notes ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>📝 Notes</Text>
                    <Text style={styles.detailRowValue}>{detailItem.notes}</Text>
                  </View>
                ) : null}

                {detailItem && detailItem.link ? (
                  <TouchableOpacity
                    style={styles.detailRow}
                    onPress={() => Linking.openURL(detailItem.link).catch(() => {})}
                  >
                    <Text style={styles.detailRowLabel}>🔗 Link</Text>
                    <Text style={[styles.detailRowValue, { color: GOLD }]} numberOfLines={1}>
                      {detailItem.link}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <Text style={styles.histText}>
                  {detailItem && (detailItem.priceHistory || []).length > 1
                    ? `${detailItem.priceHistory.length} price checks since ${detailItem.priceHistory[0].date}`
                    : 'No price history yet'}
                </Text>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                  <TouchableOpacity
                    style={[styles.miniBtn, { flex: 1, alignItems: 'center' }]}
                    onPress={() => {
                      setPriceTargetId(detailItem.id);
                      setPriceDraft('');
                      setPriceModal(true);
                    }}
                  >
                    <Text style={styles.miniBtnText}>Log price</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.miniBtn, detailItem && detailItem.booked && styles.miniBtnOn, { flex: 1, alignItems: 'center' }]}
                    onPress={() => toggleBooked(detailItem)}
                  >
                    <Text style={[styles.miniBtnText, detailItem && detailItem.booked && styles.miniBtnTextOn]}>
                      {detailItem && detailItem.booked ? 'Booked' : 'Book'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: '#232d3a' }]}
                  onPress={() => {
                    setDetailItemId(null);
                    openItemEdit(detailItem);
                  }}
                >
                  <Text style={styles.saveBtnText}>Edit details</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 2,
    backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 2,
  },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  modeBtnSel: { backgroundColor: GOLD },
  modeBtnText: { color: DIM, fontSize: 13, fontWeight: '700' },
  modeBtnTextSel: { color: '#fff' },
  notesCard: {
    backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    padding: 14, marginTop: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  notesCardTitle: { color: INK, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  notesInput: { color: INK, fontSize: 13, lineHeight: 19, minHeight: 60, textAlignVertical: 'top' },
  dayTab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER, marginRight: 8,
  },
  dayTabSel: { backgroundColor: GOLD, borderColor: GOLD },
  dayTabText: { color: DIM, fontSize: 12.5, fontWeight: '700' },
  dayTabTextSel: { color: '#fff' },
  dayCount: { color: DIM, fontSize: 12, marginTop: 10, marginBottom: 6 },
  stopRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, padding: 12, marginTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 2,
  },
  stopPin: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: GOLD,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  stopPinText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  stopName: { color: INK, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  stopSub: { color: DIM, fontSize: 12, marginTop: 3, lineHeight: 16 },
  stopThumb: { width: 44, height: 44, borderRadius: 8, marginLeft: 10 },
  timeBadge: { backgroundColor: 'rgba(217,164,65,0.15)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  timeBadgeText: { color: GOLD, fontSize: 11, fontWeight: '700' },
  travelNoteRow: { paddingLeft: 22, paddingVertical: 4 },
  travelNoteText: { color: DIM, fontSize: 11.5, fontStyle: 'italic' },
  assignBtn: { paddingLeft: 36, paddingBottom: 4 },
  assignBtnText: { color: GOLD, fontSize: 12, fontWeight: '700' },
  welcomeHero: {
    paddingTop: 64, paddingHorizontal: 24, paddingBottom: 30, alignItems: 'center',
  },
  welcomeIcon: { fontSize: 40, marginBottom: 10 },
  welcomeTitle: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  welcomeBody: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13.5, textAlign: 'center', marginTop: 10,
    lineHeight: 19, maxWidth: 320,
  },
  welcomeFeatures: { paddingHorizontal: 16, paddingVertical: 20, gap: 14 },
  welcomeFeatureRow: { flexDirection: 'row', alignItems: 'flex-start' },
  welcomeFeatureIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  welcomeFeatureTitle: { color: INK, fontSize: 14, fontWeight: '700' },
  welcomeFeatureBody: { color: DIM, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  hero: { paddingTop: 54, paddingHorizontal: 16, paddingBottom: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 2 },
  heroDates: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
  heroAdd: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },
  heroAddText: { color: '#fff', fontSize: 22, fontWeight: '400', marginTop: -2 },
  tripPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)', marginRight: 8,
  },
  tripPillSel: { backgroundColor: '#fff' },
  tripPillText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tripPillTextSel: { color: '#14324a', fontWeight: '800' },
  heroBudget: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 18, gap: 14 },
  heroBudgetLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700' },
  heroBudgetValue: { color: '#fff', fontSize: 24, fontWeight: '800' },
  heroBar: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden',
  },
  heroBarFill: { height: '100%', borderRadius: 3 },
  heroBudgetMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 6 },
  catScroll: { marginTop: 12 },
  catTab: {
    flexDirection: 'row', alignItems: 'center', width: 40, height: 40, paddingHorizontal: 0,
    marginRight: 8, borderRadius: 20,
    backgroundColor: 'transparent', borderWidth: 1, borderColor: 'transparent',
    overflow: 'hidden',
  },
  catTabSel: {
    width: undefined, height: 36, paddingLeft: 3, paddingRight: 12,
    backgroundColor: GOLD, borderColor: GOLD,
  },
  catIconWrap: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
  },
  catIcon: { fontSize: 15 },
  catLabelSel: { color: '#fff', fontSize: 12.5, fontWeight: '700', marginLeft: 6 },
  sortRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginTop: 10, marginBottom: 8,
  },
  resultCount: { color: DIM, fontSize: 12, fontWeight: '700' },
  sortText: { color: DIM, fontSize: 12.5, fontWeight: '600', paddingBottom: 4 },
  sortTextSel: { color: GOLD, fontWeight: '800' },
  sortUnderline: { height: 2, borderRadius: 1, backgroundColor: GOLD, marginTop: -3 },
  emptyCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  emptyTitle: { color: INK, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  emptyBody: { color: DIM, fontSize: 13, lineHeight: 19 },
  listing: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    marginBottom: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  listingPhoto: { width: '100%', height: 150, backgroundColor: '#0c1117' },
  listingPhotoEmpty: { alignItems: 'center', justifyContent: 'center' },
  bookedBadge: {
    position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(79,158,92,0.9)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  bookedBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  listingCardBody: { padding: 12 },
  listingCardFoot: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8,
  },
  detailPhoto: { width: '100%', height: 220, backgroundColor: '#0c1117' },
  detailCloseBtn: {
    position: 'absolute', top: 14, left: 14, width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  detailCloseBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  detailName: { color: INK, fontSize: 21, fontWeight: '800' },
  detailSub: { color: DIM, fontSize: 13, marginTop: 4 },
  detailPriceRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    marginTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  detailPrice: { color: INK, fontSize: 26, fontWeight: '800' },
  detailRow: { marginTop: 14 },
  detailRowLabel: { color: DIM, fontSize: 11.5, fontWeight: '700', marginBottom: 3 },
  detailRowValue: { color: INK, fontSize: 14, lineHeight: 19 },
  listingMain: { flexDirection: 'row', padding: 10 },
  thumb: { width: 92, height: 92, borderRadius: 10, backgroundColor: '#0c1117' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  listingBody: { flex: 1, paddingHorizontal: 10, justifyContent: 'center' },
  listingName: { color: INK, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  listingSub: { color: DIM, fontSize: 12, marginTop: 3 },
  starRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  starText: { color: GOLD, fontSize: 12, letterSpacing: 1 },
  starNum: { color: DIM, fontSize: 11, fontWeight: '700', marginLeft: 5 },
  bookedTag: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(79,158,92,0.2)',
    borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, marginTop: 6,
  },
  bookedTagText: { color: '#4f9e5c', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  priceCol: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 74 },
  price: { color: INK, fontSize: 19, fontWeight: '800' },
  priceUnit: { color: DIM, fontSize: 10, marginTop: 1 },
  trend: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  up: { color: ROSE },
  down: { color: '#4f9e5c' },
  listingFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingBottom: 10, paddingTop: 2,
  },
  histText: { color: DIM, fontSize: 10, flex: 1 },
  miniBtn: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, backgroundColor: '#232d3a',
  },
  miniBtnOn: { backgroundColor: GOLD, borderColor: GOLD },
  miniBtnText: { color: INK, fontSize: 11, fontWeight: '700' },
  miniBtnTextOn: { color: '#fff' },
  fab: {
    position: 'absolute', right: 20, bottom: 90,
    width: 56, height: 56, borderRadius: 28, backgroundColor: GOLD,
    alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 30, marginTop: -2 },
  photoPick: {
    height: 130, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    backgroundColor: '#232d3a', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 4,
  },
  photoPickText: { color: GOLD, fontSize: 13, fontWeight: '700' },
  photoPreview: { width: '100%', height: '100%' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, maxHeight: '90%',
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: INK, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: DIM, marginTop: 12, marginBottom: 6 },
  hint: { fontSize: 11, color: DIM, marginTop: 6, lineHeight: 16 },
  input: {
    backgroundColor: '#232d3a', borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 15, color: INK,
  },
  saveBtn: {
    backgroundColor: GOLD, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deleteBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  deleteBtnText: { color: ROSE, fontSize: 14, fontWeight: '600' },
  cancelBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 2 },
  cancelBtnText: { color: DIM, fontSize: 14 },
});

